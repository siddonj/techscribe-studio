#!/usr/bin/env bash

set -euo pipefail

REPO="${REPO:-siddonj/techscribe-studio}"
PROJECT_TITLE="${PROJECT_TITLE:-TechScribe Studio Phase 2}"

OWNER="${REPO%%/*}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_command gh

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

project_permission_help() {
  cat >&2 <<'EOF'
GitHub Projects V2 access is not available for the current CLI authentication context.

This usually means one of the following:
- the current token does not have the `project` scope
- the current token is a GitHub App or integration token that cannot manage Projects V2
- the authenticated account does not have permission to create projects for this owner

Try one of these fixes:
1. Refresh GitHub CLI auth with project scope:
   gh auth refresh -s project

2. If that still fails, log in with a personal account/token that can manage Projects V2:
   gh auth logout
   gh auth login

3. Verify you can create a project manually on GitHub for this owner:
   https://github.com/users/<owner>/projects

After fixing auth, rerun:
  bash scripts/create_phase2_github_project.sh
EOF
}

run_project_command() {
  local output
  if ! output="$("$@" 2>&1)"; then
    if grep -qi "Resource not accessible by integration\|createProjectV2\|projectsV2" <<< "$output"; then
      echo "$output" >&2
      project_permission_help
      exit 1
    fi

    echo "$output" >&2
    exit 1
  fi

  printf '%s\n' "$output"
}

get_project_number() {
  run_project_command gh project list \
    --owner "$OWNER" \
    --limit 100 \
    --format json \
    --jq '(.projects // .)[] | [.number, .title] | @tsv' | awk -F'\t' -v title="$PROJECT_TITLE" '$2 == title { print $1; exit }'
}

get_latest_untitled_project_number() {
  local default_title="@${OWNER}'s untitled project"

  run_project_command gh project list \
    --owner "$OWNER" \
    --limit 100 \
    --format json \
    --jq '(.projects // .)[] | [.number, .title] | @tsv' | awk -F'\t' -v title="$default_title" '$2 == title { print $1 }' | sort -n | tail -n 1
}

rename_project() {
  local project_number="$1"

  run_project_command gh project edit "$project_number" \
    --owner "$OWNER" \
    --title "$PROJECT_TITLE" >/dev/null
}

create_project_if_missing() {
  local project_number

  project_number="$(get_project_number || true)"
  if [[ -n "$project_number" ]]; then
    echo "Using existing project: $PROJECT_TITLE (#$project_number)" >&2
    printf '%s\n' "$project_number"
    return 0
  fi

  echo "Creating project: $PROJECT_TITLE" >&2
  run_project_command gh project create \
    --owner "$OWNER" \
    --title "$PROJECT_TITLE" >/dev/null

  project_number="$(get_project_number || true)"
  if [[ -z "$project_number" ]]; then
    project_number="$(get_latest_untitled_project_number || true)"
    if [[ -n "$project_number" ]]; then
      echo "Renaming untitled project #$project_number to: $PROJECT_TITLE" >&2
      rename_project "$project_number"
      project_number="$(get_project_number || true)"
    fi
  fi

  if [[ -z "$project_number" ]]; then
    echo "Failed to resolve project number after creation." >&2
    exit 1
  fi

  echo "Created project: $PROJECT_TITLE (#$project_number)" >&2
  printf '%s\n' "$project_number"
}

collect_issue_numbers() {
  {
    gh issue list \
      --repo "$REPO" \
      --state open \
      --label "phase-2" \
      --limit 200 \
      --json number \
      --jq '.[].number'

    gh issue list \
      --repo "$REPO" \
      --state open \
      --label "backlog" \
      --limit 200 \
      --json number \
      --jq '.[].number'
  } | awk 'NF { print $1 }' | sort -n | uniq
}

add_issue_to_project() {
  local project_number="$1"
  local issue_number="$2"
  local issue_url="https://github.com/$REPO/issues/$issue_number"

  if gh project item-add "$project_number" --owner "$OWNER" --url "$issue_url" >/dev/null 2>&1; then
    echo "Added issue #$issue_number to project"
  else
    echo "Skipped issue #$issue_number (already added or unsupported)"
  fi
}

echo "Preparing Phase 2 project for $REPO"
project_number="$(create_project_if_missing)"

issue_numbers="$(collect_issue_numbers)"
if [[ -z "$issue_numbers" ]]; then
  echo "No open issues found with labels phase-2 or backlog in $REPO" >&2
  exit 1
fi

echo "Adding issues to project #$project_number"
while IFS= read -r issue_number; do
  [[ -n "$issue_number" ]] || continue
  add_issue_to_project "$project_number" "$issue_number"
done <<< "$issue_numbers"

echo "Done. Review the project at: https://github.com/users/$OWNER/projects"
echo "Project title: $PROJECT_TITLE"
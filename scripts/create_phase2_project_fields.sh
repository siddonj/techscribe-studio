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

run_command() {
  local output
  if ! output="$("$@" 2>&1)"; then
    echo "$output" >&2
    exit 1
  fi

  printf '%s\n' "$output"
}

get_project_number() {
  run_command gh project list \
    --owner "$OWNER" \
    --limit 100 \
    --format json \
    --jq '(.projects // .)[] | [.number, .title] | @tsv' | awk -F'\t' -v title="$PROJECT_TITLE" '$2 == title { print $1; exit }'
}

get_field_names() {
  local project_number="$1"

  run_command gh project field-list "$project_number" \
    --owner "$OWNER" \
    --format json \
    --jq '(.fields // .)[] | .name'
}

field_exists() {
  local project_number="$1"
  local field_name="$2"

  get_field_names "$project_number" | grep -Fx "$field_name" >/dev/null 2>&1
}

create_single_select_field() {
  local project_number="$1"
  local field_name="$2"
  local options="$3"

  echo "Creating field: $field_name"
  run_command gh project field-create "$project_number" \
    --owner "$OWNER" \
    --name "$field_name" \
    --data-type SINGLE_SELECT \
    --single-select-options "$options" >/dev/null
}

project_number="$(get_project_number || true)"
if [[ -z "$project_number" ]]; then
  echo "Could not find project titled '$PROJECT_TITLE' for owner '$OWNER'." >&2
  echo "Run bash scripts/create_phase2_github_project.sh first." >&2
  exit 1
fi

echo "Configuring project fields for $PROJECT_TITLE (#$project_number)"

if field_exists "$project_number" "Status"; then
  echo "Using existing built-in field: Status"
else
  echo "Built-in Status field was not detected. Skipping custom Status creation to avoid conflicts."
fi

if field_exists "$project_number" "Sprint"; then
  echo "Field already exists: Sprint"
else
  create_single_select_field "$project_number" "Sprint" "Sprint 1,Sprint 2,Sprint 3,Sprint 4,Backlog"
fi

if field_exists "$project_number" "Priority"; then
  echo "Field already exists: Priority"
else
  create_single_select_field "$project_number" "Priority" "P0 Critical,P1 High,P2 Medium,P3 Low"
fi

echo "Done. Review the project at: https://github.com/users/$OWNER/projects/$project_number"
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
require_command jq

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
    --format json | jq -r --arg title "$PROJECT_TITLE" '(.projects // .)[] | select(.title == $title) | .number' | head -n 1
}

project_number="$(get_project_number || true)"
if [[ -z "$project_number" ]]; then
  echo "Could not find project titled '$PROJECT_TITLE' for owner '$OWNER'." >&2
  echo "Run bash scripts/create_phase2_github_project.sh first." >&2
  exit 1
fi

project_json="$(run_command gh project view "$project_number" --owner "$OWNER" --format json)"
project_id="$(jq -r '.id // .project.id // empty' <<< "$project_json")"

if [[ -z "$project_id" ]]; then
  echo "Could not resolve project node ID for project #$project_number." >&2
  exit 1
fi

fields_json="$(run_command gh project field-list "$project_number" --owner "$OWNER" --format json)"
items_json="$(run_command gh project item-list "$project_number" --owner "$OWNER" --limit 200 --format json)"

get_field_id() {
  local field_name="$1"
  jq -r --arg name "$field_name" '(.fields // .)[] | select(.name == $name) | .id' <<< "$fields_json" | head -n 1
}

get_option_id() {
  local field_name="$1"
  local option_name="$2"

  jq -r --arg field "$field_name" --arg option "$option_name" '
    (.fields // .)[]
    | select(.name == $field)
    | (.options // [])[]
    | select(.name == $option)
    | .id
  ' <<< "$fields_json" | head -n 1
}

SPRINT_FIELD_ID="$(get_field_id "Sprint")"
PRIORITY_FIELD_ID="$(get_field_id "Priority")"
STATUS_FIELD_ID="$(get_field_id "Status")"

if [[ -z "$SPRINT_FIELD_ID" || -z "$PRIORITY_FIELD_ID" ]]; then
  echo "Sprint and Priority fields must exist before assigning defaults." >&2
  echo "Run bash scripts/create_phase2_project_fields.sh first." >&2
  exit 1
fi

SPRINT_1_OPTION_ID="$(get_option_id "Sprint" "Sprint 1")"
SPRINT_2_OPTION_ID="$(get_option_id "Sprint" "Sprint 2")"
SPRINT_3_OPTION_ID="$(get_option_id "Sprint" "Sprint 3")"
SPRINT_4_OPTION_ID="$(get_option_id "Sprint" "Sprint 4")"
SPRINT_BACKLOG_OPTION_ID="$(get_option_id "Sprint" "Backlog")"

PRIORITY_P1_OPTION_ID="$(get_option_id "Priority" "P1 High")"
PRIORITY_P2_OPTION_ID="$(get_option_id "Priority" "P2 Medium")"
PRIORITY_P3_OPTION_ID="$(get_option_id "Priority" "P3 Low")"

STATUS_TODO_OPTION_ID="$(get_option_id "Status" "Todo")"
STATUS_BACKLOG_OPTION_ID="$(get_option_id "Status" "Backlog")"

set_single_select_value() {
  local item_id="$1"
  local field_id="$2"
  local option_id="$3"
  local description="$4"

  if [[ -z "$field_id" || -z "$option_id" ]]; then
    return 0
  fi

  run_command gh project item-edit \
    --id "$item_id" \
    --project-id "$project_id" \
    --field-id "$field_id" \
    --single-select-option-id "$option_id" >/dev/null

  echo "$description"
}

sprint_option_for_title() {
  local title="$1"

  case "$title" in
    "Phase 2 Sprint 1: Structured tool handoffs"|"Create structured handoff registry"|"Extract reusable parsing utilities for structured tool output"|"Build shared handoff card UI for structured results"|"Add Outline Generator to Article Writer handoff"|"Add Headline Generator downstream handoff actions"|"Document supported tool handoffs")
      printf '%s\n' "$SPRINT_1_OPTION_ID"
      ;;
    "Phase 2 Sprint 2: Calendar workspace expansion"|"Add planner view switcher for list and week modes"|"Implement weekly board layout for scheduled content"|"Add fast reschedule interactions in calendar workspace"|"Unify planner filters across list and week views"|"Update planner summary metrics to reflect filtered state")
      printf '%s\n' "$SPRINT_2_OPTION_ID"
      ;;
    "Phase 2 Sprint 3: Publishing workflow expansion"|"Define richer publish state model across workflow surfaces"|"Expand editable publish metadata for WordPress drafts"|"Add retry and recovery UX for publish failures"|"Decide and implement publish scheduling ownership model"|"Surface publish state in planner and archive summaries")
      printf '%s\n' "$SPRINT_3_OPTION_ID"
      ;;
    "Phase 2 Sprint 4: Deployment and operations hardening"|"Write production deployment guide for self-hosted installs"|"Add recovery guide for common runtime and integration failures"|"Define backup and persistence expectations for SQLite data"|"Add manual smoke-test checklist for critical workflows"|"Document upgrade and migration expectations for self-hosted installs")
      printf '%s\n' "$SPRINT_4_OPTION_ID"
      ;;
    *)
      printf '%s\n' "$SPRINT_BACKLOG_OPTION_ID"
      ;;
  esac
}

priority_option_for_item() {
  local title="$1"
  local labels="$2"

  case "$title" in
    "Phase 2 Sprint 1: Structured tool handoffs"|"Phase 2 Sprint 2: Calendar workspace expansion"|"Phase 2 Sprint 3: Publishing workflow expansion"|"Phase 2 Sprint 4: Deployment and operations hardening"|"Create structured handoff registry"|"Add planner view switcher for list and week modes"|"Define richer publish state model across workflow surfaces"|"Write production deployment guide for self-hosted installs")
      printf '%s\n' "$PRIORITY_P1_OPTION_ID"
      ;;
    *)
      if grep -q "backlog" <<< "$labels"; then
        printf '%s\n' "$PRIORITY_P3_OPTION_ID"
      else
        printf '%s\n' "$PRIORITY_P2_OPTION_ID"
      fi
      ;;
  esac
}

status_option_for_item() {
  local labels="$1"

  if grep -q "backlog" <<< "$labels" && [[ -n "$STATUS_BACKLOG_OPTION_ID" ]]; then
    printf '%s\n' "$STATUS_BACKLOG_OPTION_ID"
    return 0
  fi

  printf '%s\n' "$STATUS_TODO_OPTION_ID"
}

echo "Assigning default field values for project #$project_number"

while IFS=$'\t' read -r item_id item_title item_labels; do
  [[ -n "$item_id" ]] || continue

  sprint_option_id="$(sprint_option_for_title "$item_title")"
  priority_option_id="$(priority_option_for_item "$item_title" "$item_labels")"
  status_option_id="$(status_option_for_item "$item_labels")"

  set_single_select_value "$item_id" "$SPRINT_FIELD_ID" "$sprint_option_id" "Set Sprint for: $item_title"
  set_single_select_value "$item_id" "$PRIORITY_FIELD_ID" "$priority_option_id" "Set Priority for: $item_title"
  set_single_select_value "$item_id" "$STATUS_FIELD_ID" "$status_option_id" "Set Status for: $item_title"
done < <(
  jq -r '
    (.items // .)[]
    | [
        .id,
        (.content.title // .title // ""),
        ((.content.labels // .labels // []) | map(.name // .) | join(","))
      ]
    | @tsv
  ' <<< "$items_json"
)

echo "Done. Review the project at: https://github.com/users/$OWNER/projects/$project_number"
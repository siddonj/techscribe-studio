#!/usr/bin/env bash

set -euo pipefail

REPO="${REPO:-siddonj/techscribe-studio}"

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

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force >/dev/null
}

issue_exists() {
  local title="$1"

  gh issue list \
    --repo "$REPO" \
    --state all \
    --search "\"$title\" in:title" \
    --limit 200 \
    --json title \
    --jq '.[].title' | grep -Fx "$title" >/dev/null 2>&1
}

create_issue() {
  local title="$1"
  local labels="$2"
  local body_file

  if issue_exists "$title"; then
    echo "Skipping existing issue: $title"
    cat >/dev/null
    return 0
  fi

  body_file="$(mktemp)"
  cat > "$body_file"

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "$labels" \
    --body-file "$body_file"

  rm -f "$body_file"
}

echo "Creating or updating labels in $REPO"

create_label "phase-2" "1f6feb" "Phase 2 roadmap work"
create_label "handoff" "5319e7" "Structured tool handoff work"
create_label "calendar" "0e8a16" "Calendar and planning workspace"
create_label "publishing" "fbca04" "Publishing workflow and WordPress state"
create_label "ops" "d4c5f9" "Operations and deployment hardening"
create_label "docs" "0075ca" "Documentation updates"
create_label "frontend" "a2eeef" "Frontend implementation"
create_label "backend" "f9d0c4" "Backend or data model implementation"
create_label "automation" "bfdadc" "Automation-related backlog"
create_label "integration" "c2e0c6" "External integration backlog"
create_label "backlog" "ededed" "Deferred work"

echo "Creating Phase 2 epics and issues in $REPO"

create_issue "Phase 2 Sprint 1: Structured tool handoffs" "phase-2,handoff,frontend,backend" <<'EOF'
Goal: turn the current Blog Post Ideas handoff into a reusable workflow system.

Scope:
- Centralize handoff-capable tools and downstream targets
- Reuse parsing and rendering logic
- Add at least 2 more real handoff paths
- Document supported handoffs

Exit criteria:
- At least 3 handoff paths are live
- Shared config drives handoff behavior
- Parsed cards suppress duplicate raw output when parsing succeeds
- Raw output still renders when parsing fails
EOF

create_issue "Create structured handoff registry" "phase-2,handoff,backend" <<'EOF'
Create a shared registry that defines which upstream tools can emit structured results and which downstream tools they can launch.

Scope:
- Add a shared configuration layer for handoff-capable tools
- Remove page-local assumptions tied only to Blog Post Ideas
- Make downstream target mapping declarative

Acceptance criteria:
- Blog Post Ideas uses the shared registry
- A new handoff can be added without duplicating routing logic
- Registry supports multiple downstream actions per upstream tool

Depends on:
- Phase 2 Sprint 1: Structured tool handoffs
EOF

create_issue "Extract reusable parsing utilities for structured tool output" "phase-2,handoff,backend" <<'EOF'
Move parsing logic out of the rendering path so structured outputs can be normalized in one place.

Scope:
- Define a normalized result shape
- Extract parser logic from the tool page
- Keep fallback rendering intact

Acceptance criteria:
- Parsers return a normalized shape with title, summary, keywords, and prefill fields
- Parsing failures do not break output rendering
- Tool page no longer contains one-off parsing logic for a single tool

Depends on:
- Create structured handoff registry
EOF

create_issue "Build shared handoff card UI for structured results" "phase-2,handoff,frontend" <<'EOF'
Render parsed result cards through a reusable UI pattern that can support more than one downstream action.

Scope:
- Standardize card layout
- Standardize action row
- Preserve current no-duplicate-output behavior

Acceptance criteria:
- Structured result cards share the same presentation pattern
- Cards can render multiple downstream actions
- Cards fit the existing shell design system

Depends on:
- Extract reusable parsing utilities for structured tool output
EOF

create_issue "Add Outline Generator to Article Writer handoff" "phase-2,handoff,frontend,backend" <<'EOF'
Use the shared handoff system to support a second real workflow after Blog Post Ideas.

Scope:
- Define parser and target mapping for Outline Generator
- Pass useful prefilled context into Article Writer
- Reuse shared handoff UI

Acceptance criteria:
- Outline Generator produces actionable handoff cards
- Article Writer opens with relevant fields prefilled
- No one-off page logic is added for this flow

Depends on:
- Create structured handoff registry
- Extract reusable parsing utilities for structured tool output
- Build shared handoff card UI for structured results
EOF

create_issue "Add Headline Generator downstream handoff actions" "phase-2,handoff,frontend,backend" <<'EOF'
Let headline results feed downstream writing workflows through the same shared handoff system.

Scope:
- Parse headline results into a structured form
- Add one or more downstream targets
- Reuse shared card behavior

Acceptance criteria:
- Headline Generator supports at least one downstream handoff
- Downstream tool opens with useful context prefilled
- Rendering and fallback behavior match the shared system

Depends on:
- Create structured handoff registry
- Extract reusable parsing utilities for structured tool output
- Build shared handoff card UI for structured results
EOF

create_issue "Document supported tool handoffs" "phase-2,handoff,docs" <<'EOF'
Add documentation for all currently supported upstream and downstream tool flows.

Scope:
- List supported handoffs
- Explain fallback behavior
- Briefly describe how to extend the system

Acceptance criteria:
- README lists current handoff workflows
- README explains fallback rendering when parsing fails
- Documentation matches shipped behavior

Depends on:
- Add Outline Generator to Article Writer handoff
- Add Headline Generator downstream handoff actions
EOF

create_issue "Phase 2 Sprint 2: Calendar workspace expansion" "phase-2,calendar,frontend" <<'EOF'
Goal: upgrade planning from a queue view into a true calendar workspace.

Scope:
- Add alternate planner views
- Keep the current queue workflow intact
- Improve scheduling speed
- Keep filters and metrics consistent

Exit criteria:
- Planner supports at least list and week modes
- Rescheduling is faster than manual per-item editing
- Filters and summary metrics behave consistently across views
EOF

create_issue "Add planner view switcher for list and week modes" "phase-2,calendar,frontend" <<'EOF'
Introduce a planner view control so the current queue view can coexist with a week-based planning view.

Scope:
- Add view mode state
- Preserve existing list behavior
- Avoid breaking selection and editor flows

Acceptance criteria:
- Users can switch between list and week views
- Current list workflow remains fully usable
- Switching views preserves selection and filter state when practical

Depends on:
- Phase 2 Sprint 2: Calendar workspace expansion
EOF

create_issue "Implement weekly board layout for scheduled content" "phase-2,calendar,frontend" <<'EOF'
Build a weekly planning surface with day columns and an unscheduled backlog lane.

Scope:
- Group items by scheduled date
- Render a week board
- Keep unscheduled items visible

Acceptance criteria:
- Scheduled items render in the correct day column
- Unscheduled items appear in a backlog lane
- Layout matches the current shell design language

Depends on:
- Add planner view switcher for list and week modes
EOF

create_issue "Add fast reschedule interactions in calendar workspace" "phase-2,calendar,frontend,backend" <<'EOF'
Make it possible to move content to a different date without opening every item in the editor.

Scope:
- Add a quick reschedule interaction model
- Persist schedule changes
- Reflect updates immediately in the UI

Acceptance criteria:
- Users can move an item to another day with a faster interaction
- Date changes persist correctly
- The detail panel reflects the updated schedule immediately

Depends on:
- Implement weekly board layout for scheduled content
EOF

create_issue "Unify planner filters across list and week views" "phase-2,calendar,frontend" <<'EOF'
Ensure tool, status, and publish-intent filters work consistently in every planner mode.

Scope:
- Reuse one filter state model
- Apply filters to all view modes
- Keep behavior predictable

Acceptance criteria:
- Filters apply consistently in list and week views
- Switching views preserves active filters
- Empty-state behavior is correct for filtered results

Depends on:
- Add planner view switcher for list and week modes
- Implement weekly board layout for scheduled content
EOF

create_issue "Update planner summary metrics to reflect filtered state" "phase-2,calendar,frontend" <<'EOF'
Make top-level planner counts and status strips reflect what the user is actually viewing.

Scope:
- Recompute summary values from filtered data where appropriate
- Keep view state and metrics aligned
- Avoid misleading totals

Acceptance criteria:
- Summary cards reflect active filters
- Status strip values stay consistent across list and week views
- Metric behavior is documented in code comments or implementation notes if needed

Depends on:
- Unify planner filters across list and week views
EOF

create_issue "Phase 2 Sprint 3: Publishing workflow expansion" "phase-2,publishing,frontend,backend" <<'EOF'
Goal: turn draft sync into a fuller publishing workflow.

Scope:
- Model richer publishing states
- Support broader publish metadata
- Improve publish failure recovery
- Clarify ownership of scheduling behavior

Exit criteria:
- Publishing state is visible across tool, planner, and archive views
- Failed publish attempts are retryable without re-generation
- Scheduling behavior is explicit in the product and documentation
EOF

create_issue "Define richer publish state model across workflow surfaces" "phase-2,publishing,frontend,backend" <<'EOF'
Distinguish between unpublished, draft created, draft updated, blocked, failed, and related real workflow states.

Scope:
- Define a shared publish state model
- Apply it across tool, history, and calendar views
- Remove ambiguous or inconsistent state labels

Acceptance criteria:
- The same publish state meanings are used across major surfaces
- Failure states are distinguishable from never-published states
- Existing publish and update flows continue to work

Depends on:
- Phase 2 Sprint 3: Publishing workflow expansion
EOF

create_issue "Expand editable publish metadata for WordPress drafts" "phase-2,publishing,frontend,backend" <<'EOF'
Support more WordPress-oriented metadata before and after generation.

Scope:
- Add support for fields like slug, excerpt, categories, and tags
- Persist metadata where appropriate
- Send metadata through draft create and update flows

Acceptance criteria:
- Core publish metadata can be edited from the app
- Draft creation and update respect expanded metadata
- Linked records retain their publish-related metadata

Depends on:
- Define richer publish state model across workflow surfaces
EOF

create_issue "Add retry and recovery UX for publish failures" "phase-2,publishing,frontend,backend" <<'EOF'
Failed publish actions should be understandable and retryable without forcing re-generation.

Scope:
- Surface publish failure details
- Add retry actions in key surfaces
- Distinguish likely failure categories

Acceptance criteria:
- Publish failures show actionable feedback
- Retry is available from at least tool and history views
- Users can tell whether failure is likely credential, connection, or payload-related

Depends on:
- Define richer publish state model across workflow surfaces
EOF

create_issue "Decide and implement publish scheduling ownership model" "phase-2,publishing,backend,docs" <<'EOF'
Choose whether publish timing is controlled in-app or remains WordPress-owned, then align the product around that decision.

Scope:
- Make an explicit product decision
- Update labels and flows to match the decision
- Implement the chosen behavior clearly

Acceptance criteria:
- Scheduling ownership is clear in the UI
- Implementation matches the chosen model
- README documents the expected behavior

Depends on:
- Define richer publish state model across workflow surfaces
EOF

create_issue "Surface publish state in planner and archive summaries" "phase-2,publishing,frontend" <<'EOF'
Make publish readiness and failure states visible at the overview level, not just in per-item detail.

Scope:
- Add publish state signals to summary areas
- Improve operational visibility
- Keep state presentation consistent

Acceptance criteria:
- Planner and archive summaries expose publish readiness or failure at a glance
- Labels and colors match the shared publish state model
- Overview state does not conflict with detail view state

Depends on:
- Define richer publish state model across workflow surfaces
- Add retry and recovery UX for publish failures
EOF

create_issue "Phase 2 Sprint 4: Deployment and operations hardening" "phase-2,ops,docs" <<'EOF'
Goal: make the app easier to deploy and run as a real self-hosted service.

Scope:
- Improve production documentation
- Document failure recovery
- Clarify persistence and backup expectations
- Add a practical smoke-test checklist

Exit criteria:
- A new operator can deploy the app without reading implementation code
- Persistence and recovery expectations are documented clearly
- The critical workflow can be validated quickly before release
EOF

create_issue "Write production deployment guide for self-hosted installs" "phase-2,ops,docs" <<'EOF'
Document how to run the app in local development and production with clear runtime expectations.

Scope:
- Cover local and production startup
- Document secrets and environment requirements
- Clarify persistence expectations

Acceptance criteria:
- README covers local dev and production build flow
- Secrets and prerequisites are clearly listed
- Durable storage needs are documented

Depends on:
- Phase 2 Sprint 4: Deployment and operations hardening
EOF

create_issue "Add recovery guide for common runtime and integration failures" "phase-2,ops,docs" <<'EOF'
Document how operators should respond to the most likely failures in practice.

Scope:
- Cover missing env vars
- Cover SQLite persistence problems
- Cover WordPress verification and publish failures

Acceptance criteria:
- Recovery steps exist for common startup and integration failures
- Guidance is specific enough to be operationally useful
- The guide fits the current product behavior

Depends on:
- Write production deployment guide for self-hosted installs
EOF

create_issue "Define backup and persistence expectations for SQLite data" "phase-2,ops,docs" <<'EOF'
Make it explicit what data matters, where it lives, and why durable storage matters.

Scope:
- Clarify what is stored in SQLite
- Document the role of the data directory
- Describe backup expectations for self-hosted installs

Acceptance criteria:
- Operators understand what needs persistence
- Data directory expectations are documented clearly
- Backup guidance matches actual app behavior

Depends on:
- Write production deployment guide for self-hosted installs
EOF

create_issue "Add manual smoke-test checklist for critical workflows" "phase-2,ops,docs" <<'EOF'
Create a short validation checklist for the product's critical path.

Scope:
- Cover generate, save, history, planner linkage, settings verification, and draft publishing
- Keep it short enough to run before release
- Align it with current real workflows

Acceptance criteria:
- A practical smoke-test checklist exists
- Checklist covers the core end-to-end flow
- Checklist is short enough to be used regularly

Depends on:
- Write production deployment guide for self-hosted installs
EOF

create_issue "Document upgrade and migration expectations for self-hosted installs" "phase-2,ops,docs" <<'EOF'
Clarify what operators should do before updating the app and what risks exist around persistent data.

Scope:
- Document upgrade expectations
- Mention schema-sensitive or persistence-sensitive changes where relevant
- Align guidance with current storage model

Acceptance criteria:
- Operators have clear guidance for safe upgrades
- Persistence-sensitive updates are called out clearly
- Upgrade guidance is consistent with the current database model

Depends on:
- Define backup and persistence expectations for SQLite data
EOF

create_issue "Post-Phase-2 expansion backlog" "backlog" <<'EOF'
These items are intentionally sequenced after the core Phase 2 workflow is stable.

Scope:
- Automated generation
- External research inputs
- YouTube-to-blog workflow support

Exit criteria:
- Core Phase 2 workflow is stable enough that new external dependencies will not force rework
EOF

create_issue "Add scheduled or automated generation jobs" "backlog,automation" <<'EOF'
Explore and implement automation for recurring or delayed generation tasks after the core planner and publish flows stabilize.

Acceptance criteria:
- Requirements for automated generation are defined
- Automation design does not conflict with planner and publish state models

Depends on:
- Post-Phase-2 expansion backlog
EOF

create_issue "Add external keyword research integrations" "backlog,integration" <<'EOF'
Integrate external keyword sources after the internal planning and writing flows are stable enough to consume them cleanly.

Acceptance criteria:
- External research data can be brought into the planning flow without breaking the current tool model
- Integration scope is defined before implementation begins

Depends on:
- Post-Phase-2 expansion backlog
EOF

create_issue "Add YouTube-to-blog workflow support" "backlog,integration" <<'EOF'
Support turning YouTube inputs into blog planning or drafting workflows once the core handoff and publishing system is mature.

Acceptance criteria:
- Input model and downstream flow are defined
- Workflow reuses the structured handoff system where appropriate

Depends on:
- Post-Phase-2 expansion backlog
EOF

echo "Done. Review the new issues at: https://github.com/$REPO/issues"
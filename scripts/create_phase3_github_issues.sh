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

create_label "phase-3" "9f8fde" "Phase 3: UI Refinement and Readability"
create_label "ui" "a2eeef" "UI/UX design or implementation"
create_label "accessibility" "77ccff" "Accessibility and readability improvements"
create_label "design-system" "c2e0c6" "Design system and theming"

echo "Creating Phase 3 issues in $REPO"

create_issue "Phase 3: UI Refinement - Contrast and Readability" "phase-3,ui,accessibility" <<'EOF'
Improve text readability across all pages by increasing contrast and adjusting text hierarchy.

Current Issues:
- Body text (slate-400) on dark backgrounds fails WCAG AA contrast standards
- Small fonts (11-12px) with low contrast strain readability
- Headers and labels barely stand out from secondary elements

Tasks:
- [ ] Audit all text colors against WCAG AA standards
- [ ] Update base text colors: `slate-400` → `slate-200` for body, `slate-600` → `slate-500` for labels
- [ ] Adjust font sizes: increase base to 14-16px where appropriate
- [ ] Add proper line-height values (min 1.5 for body, 1.3 for headings)
- [ ] Test on actual screens with brightness variations

Acceptance criteria:
- All body text passes WCAG AA contrast ratios (4.5:1 for normal text)
- Text hierarchy is visually clear
- No reading strain on screens of varying brightness
EOF

create_issue "Phase 3: UI Refinement - Card and Panel Visual Separation" "phase-3,ui,design-system" <<'EOF'
Add better visual distinction between cards, panels, and backgrounds to reduce clutter.

Current Issues:
- Too many subtle elements (white/5, white/10 borders) blend together
- Cards lack clear visual separation
- No clear distinction between interactive vs static elements

Tasks:
- [ ] Increase panel padding: `p-4/p-5` → `p-6/p-7`
- [ ] Update border opacity: `border-white/5` → `border-white/15`
- [ ] Create depth levels (primary, secondary, tertiary backgrounds)
- [ ] Add subtle background color variations for cards
- [ ] Improve shadow hierarchy (inset for soft, outset for elevation)
- [ ] Test visual hierarchy on different monitors

Acceptance criteria:
- Each card/panel feels distinctly separated
- Visual hierarchy is intuitive
- Design is not visually fatiguing
EOF

create_issue "Phase 3: UI Refinement - Status and Action Color Coding" "phase-3,ui,design-system" <<'EOF'
Introduce semantic colors for status indicators and interactive elements.

Current Issues:
- Only green accent used throughout
- No status-specific colors (calendar statuses, success/warning/error states)
- Difficult to distinguish different content types at a glance

Tasks:
- [ ] Define color palette for status states: success, warning, error, info, draft
- [ ] Update calendar status badges with distinct colors:
  - backlog → gray
  - planned → blue
  - in-progress → amber/yellow
  - ready → green
  - published → purple
- [ ] Apply semantic colors to buttons (primary, secondary, danger)
- [ ] Add color indicators to history status indicators
- [ ] Update Tailwind config with new semantic colors

Acceptance criteria:
- Status types are immediately visually distinguishable
- Color choices follow accessibility guidelines
- New colors integrate with dark theme
EOF

create_issue "Phase 3: UI Refinement - Sidebar Navigation Clarity" "phase-3,ui,frontend" <<'EOF'
Improve sidebar readability and visual organization of the tool library.

Current Issues:
- Tool library is cramped and difficult to scan
- Category sections lack visual separation
- Limited distinguishing between expanded/collapsed states
- Tool names have insufficient spacing

Tasks:
- [ ] Increase category section padding and margins
- [ ] Use darker backgrounds for category headers
- [ ] Add visual indicators for expanded/collapsed states
- [ ] Increase tool name font size and weight
- [ ] Add brief descriptions or icons for better scanning
- [ ] Improve mobile sidebar visibility

Acceptance criteria:
- Sidebar is easy to scan at a glance
- Tool library hierarchy is visually clear
- Mobile view remains usable at smaller sizes
EOF

create_issue "Phase 3: UI Refinement - Form Input Visibility" "phase-3,ui,frontend,accessibility" <<'EOF'
Enhance input field visibility and focus states across all forms.

Current Issues:
- Input fields blend with backgrounds
- Focus states are not prominent
- Placeholder text visibility varies

Tasks:
- [ ] Update input field background: darker or lighter with clear borders
- [ ] Add stronger focus state with visible border/shadow
- [ ] Ensure placeholder text has sufficient contrast
- [ ] Add visual feedback for validation states (error, success)
- [ ] Increase padding in inputs for better touchability
- [ ] Test form interactions across all pages (calendar, history, settings)

Acceptance criteria:
- Input fields are immediately recognizable as interactive
- Focus states are prominent and clear
- Form usability is improved
EOF

create_issue "Phase 3: UI Refinement - Dashboard Section Spacing" "phase-3,ui,frontend" <<'EOF'
Increase breathing room in dashboard and main content areas.

Current Issues:
- Sections feel compact
- Card content lacks adequate padding/margins
- No clear visual gaps between major sections
- Tool category sections feel crowded

Tasks:
- [ ] Increase section spacing: `space-y-8` → `space-y-10/12`
- [ ] Add consistent margins between major sections
- [ ] Improve spacing between tool cards in grid layouts
- [ ] Adjust header/title margins
- [ ] Update responsive spacing for mobile views

Acceptance criteria:
- Content has comfortable breathing room
- Sections feel organized and not overwhelming
- Mobile layout scales proportionally
EOF

create_issue "Phase 3: UI Refinement - History Page Readability" "phase-3,ui,frontend" <<'EOF'
Improve the complex History page layout with better visual organization.

Current Issues:
- Filter sidebar doesn't stand out from content
- Table/list rows lack visual distinction
- Tag pills and status indicators unclear
- Too many options visible at once

Tasks:
- [ ] Add darker background to filter sidebar for separation
- [ ] Implement alternating row backgrounds in lists
- [ ] Standardize tag pill styling with consistent colors
- [ ] Add icons to status indicators (not just text)
- [ ] Improve filter section layout and spacing
- [ ] Consider collapsible filter sections for reduced clutter

Acceptance criteria:
- History page feels less cluttered
- Filters are visually distinct from content
- Row navigation is easier
EOF

create_issue "Phase 3: UI Refinement - Tool Page Output Display" "phase-3,ui,frontend" <<'EOF'
Enhance visual separation between input and output sections on tool pages.

Current Issues:
- Input and output sections not clearly distinguished
- Output sections lack visual prominence
- Generated content formatting could be improved

Tasks:
- [ ] Add distinct background color to output sections
- [ ] Improve formatting of markdown-rendered content
- [ ] Add visual separators between input/output
- [ ] Enhance code block styling
- [ ] Add copy button styling consistency
- [ ] Improve spacing for parsed result cards

Acceptance criteria:
- Output is visually distinct from input
- Generated content is easy to read and interact with
- Tool pages feel well-organized
EOF

create_issue "Phase 3: UI Refinement - Typography System Review" "phase-3,ui,design-system,docs" <<'EOF'
Establish and document a consistent typography hierarchy.

Current Issues:
- Inconsistent text sizing across components
- Some labels at 11px are too small for comfortable reading
- Line-heights not consistently applied
- Font family usage could be more intentional

Tasks:
- [ ] Define typography scale (headings, body, labels, meta)
- [ ] Create Tailwind text utility classes for each scale
- [ ] Audit and update all existing typography
- [ ] Document typography guidelines
- [ ] Test readability at different zoom levels
- [ ] Verify mobile text sizing and readability

Acceptance criteria:
- Typography hierarchy is clear and consistent
- All text meets readability standards
- System is easy to extend
EOF

echo "Phase 3 project setup complete!"
echo ""
echo "Next steps:"
echo "1. View the project: gh project view --owner $OWNER --limit 200"
echo "2. Add issues to the project board"
echo "3. Prioritize and assign issues for sprint planning"

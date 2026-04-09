# Request Details Modal Design Brief

This document describes the current management-side Request Details modal as implemented in `src/components/requests/RequestDetailSheet.tsx`.

Use this as a designer handoff for the current web behavior, not as a backend contract.

## Scope

- This is the management modal used from the main requests pages.
- It is not the resident request detail screen.
- It is not the owner request detail screen.
- It is not the provider portal request detail screen.
- It is a wide modal/sheet, not a small centered dialog.

## Core Purpose

The modal is trying to do four things in one place:

- show the request identity and current workflow state
- tell management what the next best action is
- keep collaboration visible through comments and attachments
- keep lower-frequency admin and exception tools available, but out of the main path

The current implementation already leans toward a simplified ops workflow:

- essentials stay visible at the top
- collaboration stays visible
- assignment, workflow detail, files, and admin controls sit below in collapsible sections

## Current Web App Color Themes

This modal currently sits inside the broader TowerDesk web theme, so design work should account for both the app-level tokens and the modal's local accents.

### App-wide theme foundation

The current web app is light-first and neutral-first.

- Main page background is white to very light neutral
- Card and sheet surfaces are white
- Primary text is near-black
- Secondary and muted text use zinc/gray tones
- Borders are soft light-gray rather than high-contrast dividers
- Radius is moderately rounded throughout the app

Source references:

- `src/app/globals.css`
- `DESIGN.md`

### Shared semantic color roles across the web app

The broader app design language currently uses:

- Neutral zinc/gray for default chrome, layout, and dense admin surfaces
- Emerald for active states and positive outcomes at the app level
- Blue for informational emphasis, focus, and guidance actions
- Amber for warning and pending states
- Rose/red for destructive, rejected, or blocked states

From `DESIGN.md`, the main reference palette is:

- Page background: `#fafafa` to `#f5f5f5`
- Card background: `#ffffff`
- Primary text: `#18181b`
- Secondary text: `#52525b`
- Muted text: `#71717a`
- Border: `#e4e4e7`
- Brand / active emerald: `#059669`
- Info blue: `#2563eb`
- Warning amber: `#d97706`
- Error rose: `#e11d48`

### Base design tokens currently defined in code

The global token layer in `src/app/globals.css` is currently very neutral:

- `--background`: white
- `--foreground`: very dark neutral
- `--card`: white
- `--primary`: dark neutral, not a saturated brand color
- `--secondary`, `--muted`, `--accent`: very light neutral surfaces
- `--border` and `--input`: soft neutral gray
- `--destructive`: warm red

This means the app's default UI primitives are intentionally quiet, and stronger semantic color is generally added at the component level.

### Current Request Details modal-specific accents

The current modal implementation is not purely emerald-led. It uses the shared neutral system, but the request-details surface now leans on blue for decision emphasis:

- Hero / sheet background uses soft neutral radial gradients
- The top Next Action card uses a cool white-to-blue tint
- Primary CTA uses a dark-to-blue gradient
- Informational workflow emphasis is blue
- Warning and pending banners use amber
- Rejection and destructive states use rose/red
- Most secondary controls stay white with zinc borders

In other words:

- global app identity = calm neutral with emerald available as the positive accent
- current request modal emphasis = calm neutral with blue as the decision/action accent

### Practical design implication for this brief

If this modal is iterated further, it should stay visually compatible with the rest of the web app by preserving:

- white surfaces
- zinc/neutral text hierarchy
- soft gray borders
- restrained shadows
- amber for warning / pending
- rose for rejected / destructive

If a stronger accent is needed, use it intentionally:

- emerald when signaling positive or active system state
- blue when signaling guidance, workflow progression, or the main management decision area

## Modal Structure

The current order is:

1. Key details
2. Activity
3. Assignment accordion
4. Workflow details accordion
5. Files accordion, only when files exist
6. More actions accordion, only when the user has action permissions
7. Nested Revise Estimate dialog, opened only from the rejected-owner-approval path

## What The Modal Shows

This section describes the content structure and visual hierarchy of the modal.

### Always Visible: Key Details

This is the top section and is always visible once the request loads.

#### Header badges

The top badge row can show:

- Queue badge
  - shown when a queue exists
  - queue may come from backend or be derived client-side from owner approval, estimate, status, and assignment data
- Status badge
  - shown only if it has a label and is not duplicating the queue label
- Owner approval badge
  - shown only when `ownerApproval.status != NOT_REQUIRED`
- Estimate badge
  - shown only when estimate status is not `NOT_REQUESTED`, or when the active queue is `NEEDS_ESTIMATE` or `AWAITING_ESTIMATE`
- Overdue badge
  - shown only when backend queue is `OVERDUE`

#### Title and summary

The header body shows:

- request title
- one short summary line

Summary priority is:

- `policy.summary`
- owner rejection summary
- owner pending summary
- estimate workflow summary

#### Next Action card

The right side of the top section has a dedicated Next Action card.

It shows:

- one primary action label
- up to 2 secondary actions
- helper text explaining whether secondary tools exist

It does not show the full control set.

#### Core field grid

The always-visible field grid currently shows:

- Description
- Requested By
- Building
- Unit
- Created
- Priority
- Updated
- Assigned Staff
- Provider, only when a provider exists

#### Always-visible state banners

These banners appear only when relevant:

- Owner Rejected banner
  - purpose: explain the recovery path after owner rejection
- Estimate workflow banner
  - purpose: show estimate state and due date
- Owner approval banner
  - purpose: show owner approval state and deadline or decision time
- Block banner
  - purpose: explain why execution is blocked or why management should coordinate instead of advancing work

Current block messages exist for:

- owner approval rejected
- owner approval pending
- estimate workflow active
- assigned work
- in-progress work

### Always Visible: Activity

This is the second top-level section and is always visible.

Its purpose is operational collaboration.

#### Attachments preview card

This card is always visible.

It shows:

- section label and file count
- empty state when there are no files
- up to 3 attachment links when files exist

It does not show the full file list by default.

#### Comments card

This card is always visible.

It shows:

- section label and comment count
- empty state when no comments exist
- only the latest 2 visible comments by default
- a button to reveal older comments when more than 2 exist
- per-comment author name
- per-comment visibility badge
- per-comment timestamp
- full comment body

#### Add comment composer

This card is always visible.

It shows:

- visibility selector only for management roles that can see internal comments
- comment textarea
- `Post Comment` button

Comment visibility behavior:

- management roles can post `SHARED` or `INTERNAL`
- non-management roles using this component would only be able to post `SHARED`
- non-management roles also do not see internal comments in the thread

### Collapsed Section: Assignment

This accordion is always rendered.

Its purpose is assignment and reassignment.

It shows:

- current staff assignee
- current provider, only when provider exists
- current provider worker, only when provider worker exists
- owner rejection warning, only when owner approval was rejected
- staff assignment dropdown
- provider assignment dropdown
- action buttons for assign or reassign

Dropdown population rules:

- staff list only contains employee-role users in the current building scope
- provider list only contains active providers linked to the current building

Important current behavior:

- there is no web control for assigning a provider worker
- provider worker can be displayed, but not assigned from this modal
- the assignment buttons are explicitly disabled for owner-rejected requests
- owner-pending requests show blocking messaging above, but the assignment accordion still exists

### Collapsed Section: Workflow Details

This accordion is always rendered.

Its purpose is audit visibility and workflow explanation.

It can show:

- Queue
- Status
- Route, only when route exists
- Recommendation badge, only when recommendation exists
- Summary, only when `policy.summary` exists
- Estimate Status, only when estimate badge rules say estimate is relevant
- Estimate Requested At, only when value exists
- Estimate Due At, only when value exists
- Estimate Submitted At, only when value exists
- Owner Approval badge, only when owner approval is relevant
- Owner Approval Deadline, only when value exists
- Owner Decision, only when a decision reason exists
- Approval Amount, only when estimated amount exists
- workflow flags
  - Emergency
  - Like for Like
  - Upgrade
  - Major Replacement
  - Responsibility Disputed
- estimate amount input
- estimate currency input
- rejected-owner guidance banner, only when owner approval is rejected

Important current behavior:

- there is no separate Estimate Details accordion
- estimate inputs currently live inside Workflow Details
- there is no standalone System Decision card
- policy explanation is partly above the fold and partly in this accordion

### Conditional Section: Files

This accordion is shown only when at least 1 attachment exists.

Its purpose is full-file access after the preview card.

It shows:

- every attachment as a link

It is hidden entirely when there are no files.

### Conditional Section: More Actions

This accordion is shown only when the user has at least one of:

- assign permission
- status update permission
- comment permission

Its purpose is fallback, exception, and admin-only intervention.

#### Edit triage inputs

Shows:

- Emergency checkbox
- Like for like checkbox
- Upgrade checkbox
- Major replacement checkbox
- Responsibility disputed checkbox
- `Save Triage` button

Purpose:

- let management change the facts that drive policy routing

#### Owner approval exceptions

Shows:

- Approval Request Reason textarea
- Override Source selector, only for users with owner-approval override permission
- Override Reason textarea, only for users with owner-approval override permission
- `Override Approval` button, only for users with owner-approval override permission

Purpose:

- explain why approval is needed
- support privileged approval override

#### Execution fallback controls

Shows some controls only in certain states:

- `Submit Estimate Fallback`
  - only when active queue is `AWAITING_ESTIMATE`
- `Force Start Work`
  - only when active queue is `ASSIGNED`
  - hidden when owner approval is rejected
- `Force Complete`
  - only when active queue is `IN_PROGRESS`
  - hidden when owner approval is rejected
- `Upload Admin Attachment`
  - available whenever the section is shown and permissions allow

Purpose:

- give management a manual override path when the assigned actor cannot move the request forward directly

#### Provider reassignment tools

This card is shown only when backend queue is `AWAITING_ESTIMATE` or `READY_TO_ASSIGN`.

It can show:

- `Reassign Estimate Provider`
- `Unassign Provider`, only when a provider is currently assigned

Purpose:

- recover estimate and dispatch workflows when the chosen vendor is wrong or unresponsive

#### Request controls

Shows:

- `Send Reminder` or `Re-request Owner Approval`, only when owner approval is pending
- `Cancel Request`

Purpose:

- give management final fallback controls without keeping them in the main action area

### Nested Dialog: Revise Estimate

This is a second dialog inside the request modal.

It opens when:

- owner approval was rejected
- user clicks `Revise Estimate`
- user clicks `Edit Triage` from the rejected path

Its purpose is recovery after owner rejection.

It shows:

- rejected-owner warning
- Estimated Amount input
- Estimated Currency input
- Owner Approval Deadline input
- triage fact checkboxes
- Approval Required Reason textarea
- `Cancel`
- `Submit Revised Estimate`

The backend then decides whether the request:

- stays in owner approval
- goes back to a direct-assign path
- or otherwise reroutes based on the revised facts

### What Is Intentionally Hidden Or Not Surfaced

The current modal intentionally avoids showing some things by default.

#### Hidden by default

- full assignment controls are collapsed
- workflow audit details are collapsed
- full file list is collapsed
- admin and override tools are collapsed
- older comments beyond the latest 2 are collapsed

#### Hidden unless relevant

- provider row in Key Details
- provider row in Assignment
- provider worker row in Assignment
- Files accordion
- owner approval badge
- estimate badge
- owner approval deadline and decision fields
- estimate timestamps
- workflow flags when values are missing
- reminder action when owner approval is not pending
- override controls when permission is missing

#### Not currently shown in this modal

- provider-worker assignment UI
- standard `Start Work` button in the main action area
- standard `Mark Completed` button in the main action area
- generic `Upload Attachment` action in the main content area
- a dedicated System Decision card
- a dedicated Request Summary card
- placeholder rows like `Provider: Unassigned`
- `No estimate` and `No owner approval` badges when those workflows are not relevant

## How The Modal Behaves

These are important behavior details for design, not just content layout.

### Opening and loading

- The request detail opens as a wide modal/sheet.
- It shows a loading spinner while the request payload is loading.
- If the request is missing, it shows a simple `Request not found.` state.
- When the request changes, local form state resets to match the latest request:
  - selected staff
  - selected provider
  - estimate amount / currency
  - approval reason
  - owner approval deadline
  - triage checkboxes
- comment thread collapses back to latest-only view
- revise-estimate dialog closes

### Section jump / scroll behavior

- Some actions automatically open and scroll to the relevant accordion instead of failing silently.
- If `Assign Staff` is triggered without a selected staff member, the modal opens and scrolls to the `Assignment` section.
- If `Assign Provider` is triggered without a selected provider, the modal opens and scrolls to the `Assignment` section.
- If `Request Estimate` is triggered without either:
  - a selected provider
  - or an entered estimate amount
  then the modal opens and scrolls to:
  - `Assignment`
  - `Workflow details`
  and shows an error toast telling the user to select a provider or enter an estimate amount first.
- If estimate fallback is triggered without an estimate amount, the modal opens and scrolls to `Workflow details`.
- `Dispatch Now` is not a separate dispatch flow:
  - if staff is already selected, it assigns staff
- else if provider is selected, it assigns provider
- else it opens and scrolls to `Assignment`

### Next Action card behavior

- The top-right card only surfaces:
  - one primary action
  - up to 2 secondary actions
- Additional exception controls are intentionally hidden lower in the modal.
- Some states intentionally have no normal primary CTA:
  - `AWAITING_ESTIMATE`
  - `ASSIGNED`
- `AWAITING_OWNER` shows an informational disabled primary button: `Waiting for Owner`
- `IN_PROGRESS` uses the primary CTA to drive review behavior, not worker execution behavior:
  - `Review Progress`
  - or `Escalate Progress Review` when overdue
- Clicking review/progress-oriented CTAs does not change the request state directly.
  - It pre-fills the comment box with a suggested message instead.

### Comments behavior

- Comments are sorted newest first.
- Only the latest 2 visible comments are shown initially.
- Clicking `Show older comments` reveals the rest of the thread.
- Clicking `Show fewer comments` collapses back to the latest-only view.
- Internal comments are hidden from non-management viewers.
- Management roles can choose comment visibility:
  - `SHARED`
  - `INTERNAL`
- After a successful comment post:
- a success toast appears
- the comment textarea is cleared

### Attachments behavior

- The always-visible Activity area shows only an attachment preview:
  - empty state if no files exist
  - up to 3 preview links if files exist
- The full file list only appears in the collapsed `Files` accordion.
- `Upload Admin Attachment` lives only in `More actions`.
- After admin attachment upload:
- success toast appears
- the file input is cleared

### Assignment behavior

- The staff dropdown only includes employee-role users in the current building scope.
- The provider dropdown only includes:
  - active providers
  - linked to the current building
- Provider worker can be displayed if it already exists.
- Provider worker cannot be assigned from this modal.
- On owner rejection:
- assignment warning is shown
- assign / reassign buttons are disabled

### Workflow / estimate behavior

- Estimate and owner-approval inputs are seeded from the request when the modal loads.
- Entered estimate amount is validated as a number before submit.
- Owner approval deadline is validated as a real date/time before submit.
- `Request Estimate` behaves in two modes:
  - if amount exists, it submits an estimate
  - if amount does not exist but provider exists, it requests an estimate from provider
- `Request Owner Approval` uses the current workflow inputs:
  - estimate amount
  - currency
  - approval reason
  - triage flags
- deadline
- `Save Triage` updates only the routing facts, not the whole request.

### Revise Estimate dialog behavior

- The nested revise-estimate dialog opens only from the owner-rejected path.
- It can be opened by:
  - `Revise Estimate`
  - `Edit Triage` from that rejected state
- Submitting revised estimate:
  - requires a valid estimate amount
  - reuses the current triage flags and approval reason
- closes the dialog on success
- shows a success toast

### Advanced / fallback controls behavior

- `More actions` only appears if the user has at least one relevant permission:
  - assign
  - status update
  - comment
- Force execution controls are fallback-only:
  - `Force Start Work` only in `ASSIGNED`
  - `Force Complete` only in `IN_PROGRESS`
- Those force controls are hidden when owner approval has been rejected.
- Provider reassignment tools only appear in:
  - `AWAITING_ESTIMATE`
- `READY_TO_ASSIGN`
- Reminder controls only appear when owner approval is pending.

### Toast / feedback behavior

- Most mutations show toast feedback on success and failure.
- This includes:
  - assigning staff
  - assigning provider
  - requesting estimate
  - submitting estimate
  - requesting owner approval
  - saving triage
  - posting comment
  - uploading admin attachment
  - sending reminder
  - overriding approval
- force start / complete
- unassigning provider
- canceling request

### Primary and Secondary Action Logic

This is the current top-card behavior.

| State | Primary action | Secondary actions | Purpose |
| --- | --- | --- | --- |
| Owner approval rejected | `Revise Estimate` | `Edit Triage` | Recovery path after rejection |
| `NEW` + `DIRECT_ASSIGN` | `Assign Staff` | `Assign Provider` | Move simple work into dispatch |
| `NEW` + `EMERGENCY_DISPATCH` | `Dispatch Now` | `Assign Staff`, `Assign Provider` | Fast emergency dispatch |
| `NEW` + `NEEDS_ESTIMATE` | `Request Estimate` | none | Start estimate workflow |
| `NEW` + `OWNER_APPROVAL_REQUIRED` | `Request Owner Approval` | `Edit Triage` | Start owner approval flow |
| `NEEDS_ESTIMATE` | `Request Estimate` | `Assign Provider For Estimate` | Continue estimate routing |
| `AWAITING_ESTIMATE` | none | `Reassign Estimate Provider`, `Add Comment` | Follow-up state, no main CTA |
| `AWAITING_OWNER` | `Waiting for Owner` disabled | `Send Reminder` or `Re-request Owner Approval` | Informational blocked state |
| `READY_TO_ASSIGN` | `Assign Staff` | `Assign Provider` | Dispatch-ready state |
| `ASSIGNED` | none | `Reassign`, `Add Comment` | Coordination, not execution control |
| `IN_PROGRESS` | `Review Progress` or `Escalate Progress Review` if overdue | `Add Comment` | Review and exception handling |

Important current behavior:

- only the first 2 secondary actions are surfaced in the top card
- additional exception tools live lower in the modal
- `Dispatch Now` is not a separate dispatch form
- `Dispatch Now` tries to use a selected staff assignee first, then provider, and otherwise opens the Assignment section

## Design Implications

If design explores a cleaner version, the current implementation suggests these priorities:

- keep request identity, workflow state, and next action above the fold
- keep comments and attachments prominent
- keep policy facts and admin override tools discoverable but visually secondary
- preserve clear blocked-state messaging for owner approval and estimate flows
- treat assigned and in-progress states as coordination views, not execution control panels

## Source Files

- UI: `src/components/requests/RequestDetailSheet.tsx`
- Management page usage: `src/components/requests/RequestsPage.tsx`
- Request detail render expectations: `tests/unit/requestDetailProviderRender.test.ts`

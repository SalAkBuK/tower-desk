Redesign the management-side “Request Details” modal for a service requests system.

Important: do not treat this as a generic CRUD form. Design it as a decision-focused operations modal for management.

The current problem:
- the modal feels too much like a stacked form
- too many bordered boxes make everything feel equally important
- workflow, collaboration, and admin controls are visually competing with the main task
- the UI needs stronger hierarchy and better operational clarity

Main design goal:
Above the fold must answer, in this order:
1. What request is this?
2. What state is it in?
3. What should management do next?

What the improved modal should prioritize:
- request identity and workflow state at the top
- a clear next-action area for management
- collaboration visible and useful
- workflow/audit details available but secondary
- admin and override controls hidden lower and visually separated

Desired layout:

1. TOP COMMAND AREA
Create a dominant top section that feels like an ops command center.

Include:
- large request title
- one short summary line
- compact badge row for only relevant states:
  - queue
  - status if different from queue
  - owner approval when relevant
  - estimate when relevant
  - overdue when relevant
- inline request meta under the title, not large boxes:
  - unit / floor / building
  - requested by
  - assigned staff
  - provider only if it exists

On the right side of this top section:
- a “Next Action” card
- show only:
  - 1 primary action max
  - up to 2 secondary actions
- do not show the full control set here
- this card should visually stand out as the main decision area

2. DETAILS SECTION
Below the command area, show a compact 2-column details grid.

Show:
- description
- requested by
- building
- unit
- created
- updated
- priority
- assigned staff
- provider only if it exists

Important:
- do not render this like giant input fields
- do not make it feel like a form
- make it dense, readable, and fast to scan

3. STATE / BLOCK BANNERS
Support conditional banners directly below the top area or details area.

Examples:
- owner approval rejected
- waiting for owner approval
- estimate workflow active
- execution blocked
- coordination-only state

These banners should:
- appear only when relevant
- be noticeable but not louder than the request title
- clearly explain why the request is blocked or what management should understand

4. ACTIVITY SECTION
This should be always visible and feel like one collaboration workspace.

Do not split collaboration into unrelated separate cards if that hurts flow.

Activity should include:
- attachment preview area
  - empty state when no files
  - up to 3 preview items when files exist
- comments list
  - newest first
  - show latest 2 by default
  - allow expanding older comments
- add comment composer
  - visibility selector when management can choose shared vs internal
  - textarea
  - post comment button

Design this as a unified collaboration area, closer to a timeline/workspace than a set of unrelated cards.

5. ASSIGNMENT SECTION
Keep this in a collapsible section below the always-visible content.

Purpose:
- assignment and reassignment

Show:
- current staff
- current provider if it exists
- current provider worker if it exists, read-only
- assignment controls for staff and provider

Design notes:
- keep this visually secondary
- keep controls clean and compact
- avoid giant empty control panels
- if owner approval is rejected, this section should clearly show that assignment actions are disabled

6. WORKFLOW DETAILS SECTION
Keep this in a collapsible section.

Purpose:
- audit visibility
- workflow explanation

Do not present it like raw backend fields.

Group content in a more human-readable way:
- current workflow state
  - queue
  - status
  - route if relevant
- recommendation / summary
- estimate information
  - estimate state
  - requested at
  - due at
  - submitted at
  - amount
  - currency
- owner approval information
  - status
  - deadline
  - decision
- workflow flags
  - emergency
  - like for like
  - upgrade
  - major replacement
  - responsibility disputed

Make this feel explanatory and scannable, not like a dump of system rows.

7. FILES SECTION
Only show this section if attachments exist.

Keep it collapsed by default.

Purpose:
- full file access

The always-visible activity area should only show the preview, not the full file list.

8. MORE ACTIONS SECTION
Keep this collapsed and visually separated as advanced / fallback / admin-only controls.

Possible content:
- edit triage inputs
- owner approval exceptions / overrides
- execution fallback actions
- provider reassignment tools
- request controls like reminder or cancel request

Design notes:
- this is not part of the normal happy path
- it should feel secondary and slightly more cautionary
- visually separate it from normal operational actions

VERY IMPORTANT INTERACTION RULES:
- not every state should have a primary action
- some states intentionally have no primary CTA
- assigned and in-progress states are coordination views, not worker execution screens
- do not automatically add generic “Start Work” or “Mark Complete” buttons
- the top action area should respect state-based logic and avoid offering invalid actions
- some top actions should open or scroll to lower sections instead of doing everything inline

VISUAL DIRECTION:
- modern SaaS admin interface
- calm, clean, operational
- light theme
- rounded corners
- soft borders, subtle shadows
- strong typography hierarchy
- reduced visual noise
- fewer big stacked boxes
- more intentional section rhythm
- primary content clearly more prominent than secondary content

ANTI-PATTERNS TO AVOID:
- do not make every section look like the same card
- do not use oversized bordered rows for simple key/value details
- do not make workflow details visually equal to request identity
- do not promote admin override controls to the same level as normal actions
- do not split collaboration so much that comments and attachments feel disconnected
- do not design this like a long settings page

The final result should feel like:
- top = command and decision
- middle = context and collaboration
- bottom = secondary details and exceptions

Return a polished request-details modal with realistic sample data and strong hierarchy, especially in the first screenful.
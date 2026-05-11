# Owner Pages UI Brief

This brief summarizes the current owner-related product surfaces so a designer can redesign them with the right information architecture, workflows, states, and content hierarchy.

It covers:

- Internal owner management page for management/admin users
- Owner portal dashboard
- Owner portal requests
- Owner portal messages
- Owner portal notifications

It does not define final visual style. It defines product structure, required content, and behavior.

## 1. Big Picture

There are two different owner experiences in the product:

### A. Org-side owner management

Audience:

- Admin
- Org admin
- Manager

Purpose:

- Manage the organization’s owner registry
- Create and edit org-local owner records
- Grant or revoke owner portal access
- Review owner access grant history

Scope model:

- Org-scoped only
- A management user is always working inside one organization
- Cross-org owner management is not allowed

Route:

- `/portal/owners`

### B. Owner portal

Audience:

- Logged-in owner users

Purpose:

- See owned units across all active grants
- Review maintenance requests that need owner visibility or approval
- Message management or tenants
- See notifications

Scope model:

- Cross-org by default
- One owner user can have access to units in multiple organizations and buildings
- The UI must always show `orgName` and `buildingName` on owner-facing request and message surfaces

Routes:

- `/portal/dashboard`
- `/portal/requests`
- `/portal/messages`
- `/portal/notifications`

## 2. Core Product Rules

These rules matter to layout and information hierarchy:

### Cross-org owner runtime

- Owner portal data is aggregated across all active owner access grants.
- A single owner may see units from multiple orgs and buildings.
- Org and building context should never be hidden on owner request and conversation screens.

### Org-scoped management

- The management-side owners page is only for the current organization.
- It should feel like a registry + access-control tool, not like the owner’s personal portal.

### Access grant logic

- Granting owner access by email is the primary management flow.
- If the email belongs to an existing active user with `mustChangePassword=false`, the grant becomes `ACTIVE`.
- If the email belongs to an existing active user with `mustChangePassword=true`, the grant becomes `PENDING` and the backend sends the setup email.
- If the email is new, the backend creates a portal user, creates a `PENDING` grant, and sends setup email.
- If the owner already has an active representative, invite flow fails with a conflict.

### Read/unread behavior

- Owner request comments: opening the comments thread marks visible comments as read.
- Owner request comments: posting a comment also clears the unread state for that thread.
- Owner conversations: opening a conversation does not automatically mark it read by local UI logic; frontend explicitly calls the read endpoint after thread load.
- Owner notifications: unread counts come from dedicated unread-count endpoints, not from partial list math.

## 3. Main Entities

These are the main data objects the designer should understand.

### Owner

Org-local owner profile fields:

- `id`
- `name`
- `email`
- `phone`
- `address`
- `isActive`
- `createdAt`
- `updatedAt`

Identity / registry fields:

- `partyId`
- `party.type`
- `party.displayNameEn`
- `party.displayNameAr`
- `identifier.type`
- `identifier.value`
- `identifier.maskedValue`
- `identifier.countryCode`
- `identifier.issuingAuthority`

Org-specific overrides:

- `displayNameOverride`
- `contactEmailOverride`
- `contactPhoneOverride`
- `notes`

Important:

- Org-local editable fields are different from global/legal identity fields.
- Management can edit `name`, `email`, `phone`, `address`, and `isActive` on the org-side route.
- Party identity and access grants are separate concerns.

### Owner Access Grant

Fields:

- `id`
- `ownerId`
- `userId`
- `status` = `PENDING`, `ACTIVE`, `DISABLED`
- `inviteEmail`
- `invitedAt`
- `acceptedAt`
- `disabledAt`
- `verificationMethod`
- `linkedUser.name`
- `linkedUser.email`
- `linkedUser.isActive`

### Owner Access Grant History

Fields:

- `action`
- `fromStatus`
- `toStatus`
- `actorUser`
- `inviteEmail`
- `verificationMethod`
- `createdAt`

Best represented as:

- Audit timeline
- Event log
- Activity feed

### Owner Portfolio Summary

Fields:

- `unitCount`
- `orgCount`
- `buildingCount`

### Owner Portfolio Unit

Fields:

- `ownerId`
- `orgId`
- `orgName`
- `buildingId`
- `buildingName`
- `unitId`
- `unitLabel`

### Owner-visible Request

Fields:

- `id`
- `orgId`
- `orgName`
- `buildingId`
- `buildingName`
- `unit.label`
- `title`
- `description`
- `status`
- `priority`
- `type`
- `createdAt`
- `updatedAt`
- `createdBy`
- `assignedTo`
- `attachments`
- `ownerApproval`

Owner approval fields:

- `status`
- `requestedAt`
- `deadlineAt`
- `decidedAt`
- `reason`
- `requiredReason`
- `estimatedAmount`
- `estimatedCurrency`
- `decisionSource`

### Owner Conversation

Fields:

- `id`
- `subject`
- `orgName`
- `buildingName`
- `participants`
- `lastMessage`
- `unreadCount`
- `createdAt`
- `updatedAt`

### Owner Notification

Fields:

- `id`
- `orgId`
- `type`
- `title`
- `body`
- `readAt`
- `dismissedAt`
- `createdAt`

## 4. Internal Management Page

File reference:

- [OwnersManagementPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owners/OwnersManagementPage.tsx)

### Page goal

This page is an internal admin tool for owner records and owner portal access.

It currently combines:

- Owner registry
- Owner creation
- Owner profile editing
- Owner access grants
- Owner access grant history
- Fallback support tools

### Top-level structure

Current structure:

1. Page header
2. Stats cards
3. Searchable owner directory table
4. Create owner side sheet
5. Grant access modal
6. Edit owner modal
7. Owner detail side sheet

### Header content

- Title: `Owners`
- Short explanatory subtitle
- Primary CTA: `Add Owner`

### Stats cards

Current summary metrics:

- Total owners
- With email
- With phone
- With identifier

Design note:

- These are lightweight metrics, more for orientation than analytics.
- They should not overpower the directory.

### Owner directory table

Columns:

- Owner
- Party
- Contact
- Identifier
- Address
- Actions

Search behavior:

- Search by owner name, email, phone, or address

Row actions:

- `Grant Access`
- `Open`

Potential redesign direction:

- A denser data table for desktop
- A stacked card list for smaller breakpoints
- Stronger row hierarchy around owner identity and access state

### Create owner flow

Current UI is a large side sheet with four sections:

1. Basic details
2. Identity check
3. Profile details
4. Org-specific overrides

#### Basic details

Fields:

- Owner name
- Owner type: `INDIVIDUAL` or `COMPANY`
- Email
- Phone

#### Identity check

Purpose:

- Check if this owner already exists before creating a duplicate

Fields:

- Legal identifier type
- Legal identifier value
- Country code
- Issuing authority

Behavior:

- Optional
- Calls a “resolve owner party” flow
- Can return an existing matched owner
- If a match is found, user can open that existing owner instead of creating a new one

#### Profile details

Fields:

- Display name (EN)
- Arabic name
- Address
- Notes

#### Org-specific overrides

Fields:

- Display name override
- Contact email override
- Contact phone override

Design note:

- This form is powerful but heavy.
- A redesign could split “minimum required” from “advanced / optional”.
- It should feel safe for everyday admin use and not like a technical registry tool.

### Edit owner flow

Current UI is a modal.

Editable fields:

- Owner name
- Email
- Phone
- Address
- Is active

Important:

- This edits only org-local owner fields.
- It must not look like editing legal identity, party identity, or access grants.

### Owner detail sheet

Current structure:

1. Summary stat cards
2. Left column: owner details
3. Right column with tabs:
   - Access Grants
   - Grant History

#### Summary cards

Current cards:

- Party
- Status
- Email
- Phone
- Identifier

#### Owner details block

Current fields:

- Org-local owner name
- Display names
- Address
- Updated
- Created

CTA:

- `Edit profile`

### Access grants tab

Purpose:

- Manage whether and how this owner gets portal access

Current blocks:

1. Grant owner access by email
2. Existing grants list
3. Fallback tools

#### Grant by email

Important product rule:

- This is the primary flow
- Management should usually only enter the owner’s email

What the UI needs to explain:

- Existing active user with `mustChangePassword=false` => active immediately
- Existing active user with `mustChangePassword=true` => pending invite + setup email
- New user email => pending invite + setup email
- Conflict case => owner already has an active representative

#### Existing grants list

Each grant currently shows:

- Person name or email
- Grant status
- Grant ID
- User ID
- Invite email
- Verification method
- Invited date
- Accepted date
- Status explanation

Actions depending on state:

- Pending:
  - Show `Invite pending` / `Password setup required`
  - Resend invite
  - Fallback activation only for support-reviewed cases where the linked user is not still setup-required
- Active or pending:
  - Disable grant
- Active:
  - Message owner
  - Resend setup email only when `linkedUser.mustChangePassword=true`

#### Fallback admin tools

These are support/recovery tools, not default flows:

- Link existing user manually
- Activate pending grant manually with `MANUAL_REVIEW`; never send `EMAIL_MATCH` from frontend manual activation
- Disable grant

Design note:

- These should be visually secondary
- They should read as support tools or “advanced admin tools”
- They should not compete with the primary email-based flow

### Grant history tab

Purpose:

- Auditability
- Who changed what, when

Best format:

- Vertical timeline
- Clear event chips
- Before/after status transitions
- Actor identity

## 5. Owner Portal Dashboard

File reference:

- [OwnerDashboardPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerDashboardPage.tsx)

### Page goal

Give the owner a cross-org overview of:

- Portfolio size
- Requests needing attention
- Recent activity
- Unread communication

### Current structure

1. Hero / overview header
2. KPI cards
3. Recent request activity
4. Portfolio units list

### KPI cards

Current metrics:

- Units
- Organizations
- Buildings
- Requests
- Unread comments
- Unread notifications

Plus a separate line for:

- Conversation unread count

Design note:

- Designer could consolidate communication metrics into one communication cluster
- Current layout is functional but not especially elegant

### Recent request activity

Current content:

- Latest few requests across owner portfolio
- Shows status badge, org badge, building badge, title, unit label, updated date

### Portfolio units

Current content:

- Unit label
- Org name
- Building name

Important:

- This page must reinforce that owner access can span multiple orgs

## 6. Owner Requests Page

File reference:

- [OwnerRequestsPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerRequestsPage.tsx)

### Page goal

Let owners:

- Review all visible maintenance requests across their portfolio
- Approve or reject pending owner approvals
- Read and post owner-visible comments

### Current structure

1. Requests header + summary cards
2. Left column: searchable/filterable request list
3. Right column: selected request detail

### Header summary cards

Current metrics:

- Visible requests
- Pending approval
- Unread comments

### Request list

Filters:

- Search
- Status tabs:
  - All
  - Pending
  - Assigned
  - In Progress
  - Completed

Each list item currently shows:

- Status badge
- Priority badge
- Title
- Org/building
- Unit label
- Updated date

Important:

- Org and building context are required because this is cross-org

### Request detail panel

Current sections:

1. Top badges and request heading
2. Request detail card
3. Approval decision card
4. Owner comments thread

#### Request header

Shows:

- Status
- Priority
- Owner approval badge when present
- Title
- Org/building/unit
- Updated timestamp

#### Request detail card

Shows:

- Description
- Reported by
- Assigned to
- Created date
- Attachments list

#### Approval decision card

Current behavior:

- Approve with optional reason
- Reject with required reason
- Buttons only active when owner approval status is `PENDING`

Important UX states:

- Pending approval
- Already approved
- Already rejected
- No owner approval required

#### Owner comments

Shows:

- Only comments visible to the owner
- Thread list
- Composer to reply to management

Important backend behavior:

- Opening this thread marks visible comments as read
- Posting a comment also clears unread state

Design note:

- The unread logic is meaningful enough that the layout should visibly connect comments to unread counts

## 7. Owner Messages Page

File reference:

- [OwnerMessagesPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerMessagesPage.tsx)

### Page goal

Allow owners to:

- Review conversations across orgs/buildings
- Start a new conversation with management
- Start a new conversation with a tenant
- Reply to existing threads

### Current structure

1. Header with unread badge
2. Left column:
   - Search
   - Conversation list
   - “Start a conversation” composer
3. Right column:
   - Selected conversation detail
   - Reply composer

### Conversation list

Each item currently shows:

- Subject
- Unread count
- Org name
- Building name
- Last message preview

Important:

- Threads come from multiple orgs
- This page needs strong context labels

### New conversation composer

Modes:

- Management
- Tenant

Fields:

- Conversation type
- Unit selector
- Tenant user ID when messaging tenant
- Subject
- Message

Design note:

- Current tenant flow exposes raw `tenantUserId`, which is not ideal for final product UX
- Designer should likely envision a better “select tenant for this unit” flow

### Conversation detail

Shows:

- Subject
- Org/building
- Message thread
- Reply box

Important backend rule:

- Viewing a conversation does not auto-mark it read locally
- Frontend explicitly calls a read endpoint after load

Designer implication:

- Unread behavior should feel reliable and intentional

## 8. Owner Notifications Page

File reference:

- [OwnerNotificationsPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerNotificationsPage.tsx)

### Page goal

Allow owners to:

- Review notification feed across current owner scope
- Filter notifications
- Mark one or all as read
- Dismiss and restore notifications

### Current structure

1. Header with unread count + mark all read
2. Filter section
3. Notifications list

### Filters

Current controls:

- Type text filter
- Page size
- Unread-only toggle
- Include-dismissed toggle
- Type chips based on known values in current result set

### Notification list item

Current content:

- Notification icon
- Title
- Body
- Date
- Unread badge
- Dismissed badge
- Type badge

Actions:

- Mark read
- Dismiss / undismiss

Design note:

- This is a classic activity-feed surface
- It can support grouping by org if desired, but backend returns a single cross-org stream

## 9. Permissions and Access

### Management-side permissions

- `owners.read`
- `owners.write`
- `owner_registry.resolve`
- `owner_access_grants.read`
- `owner_access_grants.write`
- `messaging.write`

### Owner-side access

- Uses owner runtime access
- Not org RBAC
- Owner pages should not expose management admin affordances

### Empty/blocked states that must exist

- No permission to view owners
- No owner portfolio access
- No owners found
- No access grants yet
- No grant history
- No owner-visible requests
- No comments yet
- No conversations yet
- No notifications

## 10. Critical UX States

These states should be explicitly designed.

### Management-side states

- Loading owners
- Search with no results
- Create owner success
- Resolve owner identity success with matched owner
- Resolve owner identity success with no match
- Edit owner success/error
- Grant access success: active immediately
- Grant access success: pending invite
- Grant access conflict: active representative already exists
- Missing permission for access-grant read/write
- Access grants empty
- Access grant history empty

### Owner portal states

- Owner logged in but no accessible portfolio
- Request approval pending
- Request already approved
- Request rejected
- No owner approval required
- Comments unread
- Conversation unread
- Notification unread/dismissed

## 11. Information Architecture Recommendations

These are not strict requirements, but they are strongly aligned with the product model.

### Management-side IA

Recommended structure:

1. Owners list page
2. Owner detail page/sheet
3. Inside detail:
   - Profile
   - Access
   - History

Strong separation:

- Profile = owner record
- Access = who can act as owner in portal
- History = audit

### Owner portal IA

Recommended main nav:

- Dashboard
- Requests
- Messages
- Notifications

Potential future addition:

- Profile / Settings

Note:

- Backend already supports owner runtime profile routes, but current UI does not yet expose a dedicated owner profile page

## 12. Design Priorities

If the designer redesigns these pages from scratch, the most important product truths to preserve are:

1. Owner portal is cross-org and must always show org/building context.
2. Org management owners page is not the same thing as the owner portal.
3. Grant-by-email is the main owner-access action.
4. Legal identity data and org-local profile data should feel clearly separated.
5. Owner approval is the key decision moment on the owner requests page.
6. Request comments, conversations, and notifications all have different unread/read behaviors and should not be visually merged into one vague “activity” system.

## 13. Suggested Designer Deliverables

Ask the designer for:

1. Internal owners registry list page
2. Internal owner detail page or side sheet
3. Create/edit owner flows
4. Access grants management UI
5. Grant history timeline
6. Owner portal dashboard
7. Owner requests master-detail page
8. Owner messages master-detail page
9. Owner notifications feed
10. Empty, loading, error, and conflict states for all of the above

## 14. Useful Code References

- [OwnersManagementPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owners/OwnersManagementPage.tsx)
- [OwnerDashboardPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerDashboardPage.tsx)
- [OwnerRequestsPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerRequestsPage.tsx)
- [OwnerMessagesPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerMessagesPage.tsx)
- [OwnerNotificationsPage.tsx](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/components/owner-portal/OwnerNotificationsPage.tsx)
- [ownerPortal.ts](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/lib/api/ownerPortal.ts)
- [owners.ts](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/lib/api/owners.ts)
- [ownerPortal.ts](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/lib/queries/ownerPortal.ts)
- [owners.ts](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/lib/queries/owners.ts)
- [types.ts](/c:/Users/saleh/Documents/TowerDesk/tower-desk/src/lib/types.ts)
- [FRONTEND_OWNER_APIS_GUIDE.md](/c:/Users/saleh/Documents/TowerDesk/tower-desk/Ins/FRONTEND_OWNER_APIS_GUIDE.md)

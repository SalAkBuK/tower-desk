You are an expert frontend engineer. Implement an improved “Parking Management” UI that groups parking slots at a unit/resident level and scales to buildings with 1,500+ units.

GOAL
The current page lists every parking slot as a separate item. Replace it with a grouped, expandable explorer that:
1) Defaults to grouping by Unit (primary mental model).
2) Allows toggling to grouping by Resident/Occupancy.
3) Shows clear counts (allocated slots per unit/resident) at the group header level.
4) Supports collapse/expand per group (collapsed by default).
5) Handles large datasets efficiently (virtualized lists + lazy loading details).

REQUIREMENTS
A) Views
- Add a view toggle with two modes:
  - “Group by Unit” (default): Unit → resident(s) → slots
  - “Group by Resident”: Resident/Occupancy → unit(s) → slots
- Persist the selected view mode in URL query params and/or local storage.

B) Group headers
- Each group row shows:
  - Group label (Unit label or Resident name)
  - Count of allocated slots
  - Optional: count of residents (unit view) or count of units (resident view)
- Group rows are collapsed by default.
- Clicking the header expands/collapses the group.

C) Scale and performance (1500+ units)
- Use list virtualization (e.g., react-window / react-virtualized) for group rows.
- Do NOT render all child slot rows until a group is expanded.
- Lazy-load group details on expand:
  - Initial load fetch returns ONLY group summary data (ids + counts).
  - On expand, fetch group detail data (residents + slots) for that group.
- Add caching for expanded group details to avoid refetch on re-expand.

D) Search & filtering
- Provide a search box that filters groups by:
  - Unit label (e.g., “12B”) and resident name and slot id
- Implement debounced input.
- Search should operate on group summaries when possible, and optionally query server-side for large datasets.

E) Empty & edge cases
- Units with 0 slots should still appear (if business rules require) and show “0 slots”.
- Vacant units: show “Vacant” resident indicator.
- Handle multiple residents per unit and multi-unit residents (owner/tenant).
- Show loading skeleton/spinner for expanded content fetch.
- Handle errors gracefully (inline error + retry).

DATA / API SHAPE (design if needed)
Assume or implement endpoints like:
- GET /parking/groups?mode=unit|resident&search=&page=&pageSize=
  returns group summaries:
  [
    { groupId, unitId/unitLabel OR residentId/residentName, allocatedSlotsCount, residentsCount/unitsCount }
  ]
- GET /parking/groups/:groupId?mode=unit|resident
  returns expanded details:
  unit-mode: { unitLabel, residents:[...], slots:[...] }
  resident-mode: { residentName, units:[{unitLabel, slots:[...]}] }

UI DETAILS
- Group row: chevron icon + label + counts aligned right.
- Expanded panel: display nested items clearly:
  - Unit mode: residents section + list of slots
  - Resident mode: each unit section with its slots
- Keep the UI clean and scannable; counts should be visible without expanding.
- Ensure keyboard accessibility (Enter/Space toggles expand; focus states).
- Add “Expand all” is NOT required; avoid because of scale.

DELIVERABLES
1) Code changes implementing the new grouped view and toggle.
2) Any new components (GroupList, GroupRow, ExpandedPanel).
3) Data fetching layer with lazy-load + caching.
4) Virtualization setup.
5) Brief notes in the PR description explaining performance decisions and API assumptions.

IMPORTANT
- Optimize for large buildings (1500+ units): virtualization + lazy loading are mandatory.
- Don’t regress existing parking slot CRUD actions: keep “Assign/Unassign/Edit” actions available inside expanded details.
- If you must make assumptions, document them in comments and keep the code adaptable.

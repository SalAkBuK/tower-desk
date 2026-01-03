Target style: clean SaaS admin dashboard (subtle shadows, muted borders, modern typography).

Repo stack:
- Next.js App Router (src/app route groups)
- React + TypeScript
- Tailwind CSS
- shadcn/ui components (src/components/ui/*)
- TanStack React Query
- Zustand auth
- Lucide icons
- Sonner toasts

Objective:
Make the UI significantly more polished and consistent WITHOUT changing business logic, API contracts, auth behavior, or routing semantics.

Hard constraints:
- Do NOT change backend calls, DTO shapes, query keys, or route structure.
- Do NOT remove features.
- Only UI/UX: layout, styling, component composition, accessibility, interaction states.
- Prefer shadcn/ui primitives over custom div soup.
- Keep pages responsive and accessible (labels, focus, keyboard nav, contrast).

Plan (do in this order):

1) UI Audit (quick)
- Identify the 5 most visually inconsistent or “ugly” screens/components.
- For each: list 2–3 concrete issues (spacing, hierarchy, typography, alignment, states, etc.)
- Then proceed to implement fixes iteratively.

2) Establish a baseline “dashboard shell”
- Create a reusable layout wrapper for authenticated dashboard pages:
  - Header (top bar) with app name/logo + user menu
  - Optional sidebar nav (desktop) + mobile nav (sheet/drawer)
  - Main content container with consistent max-width + padding
- Use shadcn/ui: Card, Button, Sheet, DropdownMenu, Separator, ScrollArea as needed.
- Ensure active nav states and good spacing.

3) Create/standardize UI primitives (reusable)
- Buttons: primary/secondary/outline/ghost/destructive + consistent sizes.
- Form fields: label + input + helper/error text, consistent spacing.
- PageHeader component: title, description, right-side actions.
- SectionCard component: consistent Card header/body spacing.
- EmptyState component: icon + title + description + CTA.
- DataState wrappers: LoadingSkeleton, ErrorState with retry.
(Keep them small and local in src/components, don’t over-abstract.)

4) Typography + spacing consistency
- Ensure every page uses a consistent hierarchy:
  - Page title: text-2xl/3xl font-semibold
  - Section title: text-lg font-medium
  - Body: text-sm/base with muted foreground
- Use muted borders, subtle shadows, rounded-xl/2xl for cards.
- Standardize paddings: page p-4 md:p-6, card p-4/6.

5) Tables and lists (if present)
- Convert messy lists into shadcn/ui Table where appropriate.
- Add:
  - row hover
  - zebra or subtle separators
  - sticky header for long tables (if easy)
  - empty state in table body
- Add consistent action menus (DropdownMenu) using Lucide icons.

6) UX states everywhere
- Loading: skeletons (shadcn Skeleton)
- Empty: EmptyState component
- Error: inline error with retry + Sonner toast where already used
- Disable buttons during mutations, show spinner icon.

7) Accessibility + polish
- Ensure forms have proper labels
- Focus rings visible
- Buttons and inputs have consistent focus states
- Use aria-labels for icon-only buttons
- Avoid low-contrast text

Deliverables:
- Summary of changes (bullet list)
- List of new/updated reusable components
- Mention which screens were improved

Implementation details:
- Prefer shadcn/ui tokens and Tailwind classes.
- If you introduce new components, place them in src/components (or an existing pattern).
- Keep diffs readable and minimal per screen; don’t rewrite unrelated code.

Priority screens (in order):
admin/buildings -- the cards are not 100% responsive in mobile mode
admin/buildings/:id
admin --- Add Unit Modal
admin --- Add Unit Modal that contains multiple mini modals for adding Unit Type & Owner
admin -- Review unit details and specifications modal.
admin -- Add Resident Modal

no need to rush, do each screen at a time.

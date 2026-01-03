Refine and polish the full Add Unit flow UI (CreateUnitSheet.tsx and its related mini-modals), keeping all business logic and data flow exactly the same.

Target style:
Clean SaaS admin dashboard — tight hierarchy, subtle borders/shadows, modern typography, scannable long-form layout. Prioritize usability for long sheets.

Global constraints:
- Do NOT change validation, form state, API calls, mutations, or modal logic.
- Do NOT rename fields or alter submit behavior.
- Visual/layout changes only.

────────────────────────
SHEET LAYOUT & STRUCTURE
────────────────────────
1) Sheet sizing & density:
   - Increase sheet max width on desktop (approx 860–980px) while remaining responsive.
   - Reduce excessive vertical whitespace; use a tighter rhythm (space-y-4/5).
   - Prefer 2-column grids for simple fields where possible.

2) Sectioning:
   - Ensure clear section headers with descriptions for:
     Basics, Assignments, Specifications, Financials, Utilities, Compliance, Amenities.
   - Add subtle section separation (border-t + padding) for smooth vertical scanning.
   - Keep section spacing consistent across the sheet.

────────────────────────
FORM CONTROLS & CONSISTENCY
────────────────────────
3) Normalize controls:
   - All inputs/selects/triggers use the same height (h-10), full width within grids.
   - Consistent label styling (text-sm font-medium).
   - Helper text uses text-xs text-muted-foreground.
   - Ensure select dropdowns visually match text inputs.

4) Financial fields:
   - Annual Rent, Security Deposit, Service Charge Per Unit:
     - Add a subtle currency affordance (inline prefix or input addon).
     - Maintain clean 2-column layout where appropriate.
     - Ensure spacing and widths feel balanced.

5) Compliance checkboxes:
   - Render Balcony and VAT Applicable as proper checkbox rows:
     - flex items-center layout
     - clickable labels (htmlFor)
     - visually aligned with the rest of the form
   - Avoid making them look like text inputs.

────────────────────────
INLINE ACTIONS & MINI-MODALS
────────────────────────
6) Inline “Add” actions:
   - “Add Unit Type” / “Add Owner” should be small ghost buttons with a plus icon.
   - Align them inline with the section label, not overpowering the form.
   - Keep hierarchy subtle but discoverable.

7) Mini-modals (Add Unit Type / Add Owner):
   - Size modals for readability (not too narrow).
   - Clear header, description, and well-spaced fields.
   - Footer actions aligned consistently (Cancel / Save).

────────────────────────
AMENITIES EXPERIENCE
────────────────────────
8) Amenities selection:
   - Replace the current radio strip with a segmented control or card-style options:
     - “Use defaults”
     - “Select amenities”
     - “None”
   - Make the active state visually obvious (border/background change).

9) Conditional amenities picker:
   - When “Select amenities” is chosen:
     - Render the amenities picker inside a nested sub-card
     - Indented, bordered, and clearly dependent on the selected option
     - Use a 2–3 column checkbox layout with tight spacing
     - Keep styling consistent with the rest of the sheet

────────────────────────
STICKY FOOTER
────────────────────────
10) Sticky footer actions:
    - Add a sticky footer inside the sheet:
      - Left: Cancel (secondary / ghost)
      - Right: Add Unit (primary)
    - Visually separate with border-t and subtle background/backdrop blur.
    - Ensure it remains visible during long scrolls without covering content.

────────────────────────
FINAL NOTES
────────────────────────
- Do not introduce new flows or UI concepts.
- Focus on polish, alignment, and scannability.
- The end result should feel like a mature, production-grade admin form that’s easy to scan and hard to misuse.

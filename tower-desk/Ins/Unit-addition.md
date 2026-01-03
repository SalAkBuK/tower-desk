Convert the Add Unit sheet into a step-by-step wizard inside CreateUnitSheet.tsx.

Goal UX:
When the sheet opens, show ONLY the current step’s fields. User navigates with Back/Next. Final step shows “Add Unit” submit.

Step order + copy (keep these exact headings/descriptions):
1) Basics — “Label, floor, and internal notes.”
2) Assignments — “Connect the unit to a type and owner.”
3) Specifications — “Size, layout, and configuration details.”
4) Financials — “Rent, deposits, and service charges.”
5) Utilities — “Track active meters for the unit.”
6) Compliance — “Additional unit attributes.”
7) Amenities — “Choose how amenities should be applied to this unit.”

Requirements:
- Keep ALL existing form state, validation, and submit logic intact (react-hook-form/etc). Do NOT split into multiple forms.
- Only change presentation + navigation so it feels like a wizard.
- Persist values across steps; stepping forward/back should not reset any fields.
- Add a step indicator at the top (simple horizontal stepper or “Step X of 7” + title). Highlight current step.
- Only render fields for the active step.
- Footer buttons:
  - Left: Back (disabled on first step) + Cancel
  - Right: Next (for steps 1–6) and “Add Unit” (on step 7)
- Next button behavior:
  - On Next, validate ONLY the fields in the current step (not the whole form).
  - If current step has errors, stay on the step and focus/scroll to the first error.
  - If valid, advance to the next step.
- Back button just changes step (no validation).
- Cancel closes the sheet as before.

Field grouping:
- Basics: Unit Label, Floor, Notes/Internal notes (whatever currently lives in Basics)
- Assignments: Unit Type select + “Add Unit Type” modal, Owner select + “Add Owner” modal
- Specifications: unit size, unit size unit, kitchen type, bedrooms, bathrooms, etc (all spec fields)
- Financials: annual rent, security deposit, service charge per unit, etc
- Utilities: electricity meter, water meter, gas meter
- Compliance: balcony, VAT applicable, any other compliance toggles
- Amenities: existing amenities mode (“Use defaults / Select amenities / None”) + picker when applicable

UI polish:
- Keep clean SaaS admin look (shadcn/ui + Tailwind).
- Maintain consistent padding (labels not hugging edges).
- Keep sticky footer actions.
- Keep mini-modals working exactly the same.

Implementation notes:
- Define a steps array with {key, title, description, fields[]} where fields[] are RHF field names for step validation.
- Use form.trigger(step.fields) to validate step-only on Next.
- Use a local state like const [stepIndex, setStepIndex] = useState(0).
- Render content conditionally based on stepIndex.

Do not change API calls, DTO shapes, or submission payload. Only restructure the UI into a wizard with step-based validation.

# TowerDesk Design System & UX Guidelines

This document outlines the design philosophy, visual patterns, and implementation guidelines used to create the premium SaaS experience for TowerDesk. It is intended as a source of truth for AI agents (and human developers) to maintain consistency.

## 1. Core Philosophy: "Premium Utility"

The interface should feel **professional, trustworthy, and calm**.
-   **Less is More**: Avoid clutter. Use whitespace to separate concerns.
-   **Contextual Complexity**: Hide advanced options until needed (progressive disclosure).
-   **Smooth Continuity**: Animations should clarify state changes, not distract.
-   **Data Density**: High-density data (tables/lists) should be scannable, not overwhelming.

## 2. Visual Foundation

### Color Strategy
We primarily use the `zinc` scale for neutrals to achieve a modern, slightly warm gray look.
-   **Backgrounds**:
    -   Page: `bg-zinc-50/50` (Subtle off-white)
    -   Cards/Panels: `bg-white` + `border-zinc-200`
    -   Headers (Sticky): `bg-white/80` or `bg-zinc-50/50` + `backdrop-blur-xl`
-   **Text**:
    -   Primary: `text-zinc-900`
    -   Secondary/Muted: `text-zinc-500`
    -   Tertiary/Placeholders: `text-zinc-400`
-   **Status Colors**:
    -   Success: `emerald` (e.g., `bg-emerald-50 text-emerald-700`)
    -   Warning: `amber` or `orange`
    -   Error: `rose`
    -   Info/Brand: `blue` or `purple`

### Typography
-   **Font Family**: Default Sans (Inter/Geist).
-   **Headers**: `font-semibold` or `font-bold`, `tracking-tight`.
-   **Labels**: `text-sm font-medium`.
-   **Micro-copy**: `text-xs text-zinc-500` (for helper text, sub-labels).

### Spacing & Radius
-   **Radius**: `rounded-xl` or `rounded-2xl` for containers/cards. `rounded-lg` for smaller inputs/buttons.
-   **Padding**: Generous. `p-6` for card bodies, `gap-4` or `gap-6` for grids.

## 3. Component Patterns

### A. The "Stepped Modal" (SlideOver)
Used for complex creation flows (e.g., Create Unit, Add Resident).
-   **Visual Stepper**: Instead of just text, use a horizontal progress bar with Icons.
    -   *Active*: Colored/Highlighted.
    -   *Completed*: Checkmark icon.
    -   *Pending*: Gray/Muted.
-   **Header**: Sticky, with a `backdrop-blur` effect. Contains the stepper.
-   **Body**: Scrollable area.
    -   **Animation**: detailed transitions using `framer-motion`. Slide in from Right (Next) / Left (Back).
-   **Footer**: Sticky at bottom, `bg-white`, clear separation with `border-t`. Contains navigation buttons (Cancel, Back, Next/Save).

### B. Dashboard Cards
Used for "Details" pages (Building Details, etc.).
-   **Tabs**: Use `Tabs` component to organize content (Overview, Lists, Settings). Avoid "Div Soup" long-scrolling pages.
-   **Stats Cards**:
    -   Icon in a colored `bg-opacity-10` rounded box.
    -   Big Number (`text-2xl font-bold`).
    -   Subtext (`text-xs text-zinc-500`).
-   **Data Lists**:
    -   Use `Badge` for status updates.
    -   Hover effects on rows/cards (`hover:bg-zinc-50`).
    -   Empty States: Dashed border box with centered icon and text.

### C. Forms & Inputs
-   **Input Groups**: Use `FormItem` -> `FormLabel` -> `FormControl` -> `FormMessage`.
-   **Optional Fields**: Clearly mark labels with `(Optional)` in `text-zinc-400 font-normal`.
-   **Icons in Inputs**: Place absolute positioned `lucide-react` icons inside inputs for better visual recognition (e.g., Mail icon for email).
-   **Action Buttons**: Small context buttons (e.g., "New Type") should be `variant="outline" size="sm"` and placed strategically near the label or header.

## 4. Animation & Interaction

### Standard Motion Config
Use `framer-motion` for all interactions.

```typescript
const variants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 20 : -20,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 20 : -20,
        opacity: 0,
    }),
};

// Transition Config
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

## 5. Coding Standards for Agents
1.  **Imports**: Group standard React imports, then UI lib imports, then local queries/utils.
2.  **Types**: Define strict Zod schemas for forms. Inference types from schema.
3.  **State**: Keep UI state (modals open/close) local. Use React Query for data state.
4.  **Error Handling**: Wrap mutations in `try/catch` and use `sonner` (`toast.success`/`toast.error`).
5.  **Refactoring**: If a file gets too large (>400 lines), extract sub-components (e.g., `StaffCard`, `StatCard`) but keep them in the same file if they are not reused elsewhere, or move to logically grouped folders.

## 6. Reference Snippets

### Visual Stepper Structure
```tsx
<div className="relative flex items-center justify-between px-2">
    {/* Progress Bar Background */}
    <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-zinc-200" />
    
    {/* Progress Bar Active */}
    <div 
        className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-zinc-900 transition-all duration-500 ease-in-out"
        style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
    />
    
    {/* Steps Loop */}
    {steps.map((step, index) => {
        const isActive = index === stepIndex;
        const isCompleted = index < stepIndex;
        return (
            <div key={step.key} className={/* logic for border/bg colors */}>
                 {isCompleted ? <Check /> : <step.icon />}
            </div>
        );
    })}
</div>
```

---
**Example Prompt to Codex Agent:**
"Refactor the [Component Name] following the 'TowerDesk Design System'. Use a visual stepper with framer-motion animations (spring stiffness 300), zinc-50 style backgrounds, and ensure all optional fields are explicitly marked. Use lucide-react icons for visual cues. Refer to the standard variants in the guidelines."

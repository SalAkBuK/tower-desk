# TowerDesk DESIGN.md

## 1. Visual Theme & Atmosphere

TowerDesk should feel like premium operations software: calm, precise, and highly legible. The UI is light-first, built on soft neutral surfaces with restrained depth, clean typography, and selective emerald accents for active states and positive outcomes.

The closest external references are:
- `awesome-design-md/design-md/vercel`: restraint, card structure, precise monochrome hierarchy
- `awesome-design-md/design-md/notion`: warmth, readable spacing, soft borders
- `awesome-design-md/design-md/linear.app`: useful for dense admin patterns and dark-mode restraint

### Core Principles
- Use whitespace to reduce cognitive load, not to make screens feel empty.
- Prefer calm neutrals over loud brand color.
- Keep data-dense views scannable with strong alignment and muted secondary text.
- Use color functionally: emerald for success/active, blue for informational actions, amber/rose for warnings and errors.
- Motion should explain navigation and state changes, never decorate.

## 2. Color Palette & Roles

### Primary Neutrals
- Page Background: `#fafafa` to `#f5f5f5`
- Card Background: `#ffffff`
- Header / Frosted Surface: `rgba(255,255,255,0.8)`
- Primary Text: `#18181b`
- Secondary Text: `#52525b`
- Muted Text: `#71717a`
- Border: `#e4e4e7`
- Input Background: `#ffffff`
- Subtle Fill: `#f4f4f5`

### Semantic Colors
- Brand / Active Emerald: `#059669`
- Emerald Surface: `#ecfdf5`
- Info Blue: `#2563eb`
- Info Surface: `#eff6ff`
- Warning Amber: `#d97706`
- Warning Surface: `#fffbeb`
- Error Rose: `#e11d48`
- Error Surface: `#fff1f2`

### Dark Mode
- Background: `#18181b`
- Elevated Surface: `#27272a`
- Primary Text: `#fafafa`
- Secondary Text: `#d4d4d8`
- Border: `rgba(255,255,255,0.1)`
- Active Accent: keep emerald but reduce saturation if a section becomes visually noisy

## 3. Typography Rules

### Font Family
- Primary UI Font: `Geist Sans`
- Monospace / Technical Labels: `Geist Mono`

### Hierarchy
| Role | Size | Weight | Line Height | Notes |
|------|------|--------|-------------|-------|
| Page Title | 30-36px | 700 | 1.1 | Tight tracking, used sparingly |
| Section Title | 20-24px | 600 | 1.25 | Cards, page sections |
| Card Title | 16-18px | 600 | 1.35 | Most common heading size |
| Body | 14-16px | 400 | 1.5 | Default content |
| Label | 13-14px | 500 | 1.4 | Form labels, tabs |
| Caption | 12px | 400-500 | 1.4 | Metadata, helper text |
| Numeric Stat | 24-30px | 700 | 1.1 | KPI cards |

### Typography Principles
- Keep headings tight and concise.
- Prefer weight contrast over strong color contrast.
- Use muted text for support copy, never for primary actions.
- Use tabular or mono figures where alignment matters in tables and metrics.

## 4. Component Stylings

### Cards
- Background: white
- Border: `1px solid #e4e4e7`
- Radius: 16px to 20px
- Shadow: very soft, low blur, low opacity
- Use slightly stronger shadows only on dialogs, sheets, and sticky layers

### Buttons
- Primary: dark neutral background with white text for global CTAs
- Secondary: white background with subtle border
- Accent actions: emerald text/icon or emerald-tinted background for positive flows
- Radius: 10px to 12px
- Avoid oversized pill buttons in dashboard contexts

### Inputs
- White or subtle neutral fill
- Border: `#e4e4e7`
- Focus: visible ring with blue or neutral-dark emphasis
- Prefix icons are recommended for search, email, phone, and lookup fields

### Tables and Dense Lists
- Favor clear row separators or soft hover fills over heavy grid lines
- Keep headers compact and slightly muted
- Align actions to the right edge
- Use badges for status, not colored text alone

### Navigation
- Sidebar should feel stable, quiet, and architectural
- Active item: white tile, subtle shadow or ring, stronger text, emerald icon accent
- Inactive item: muted text, clear hover fill
- Topbar: frosted white with blur, minimal chrome

### Sheets and Dialogs
- Rounded corners, high contrast header text, sticky header/footer where flows are long
- Multi-step flows should use a visual stepper and directional motion
- Use `framer-motion` with spring transitions for stepped content changes

## 5. Layout Principles

### Spacing
- Base rhythm: `4, 8, 12, 16, 20, 24, 32`
- Standard card padding: `24px`
- Dense card padding: `16px`
- Grid gap: `16px` or `24px`

### Structure
- Prefer card-based decomposition over long unbroken pages
- Use tabs to separate major task groups
- Keep max content width controlled on marketing-like pages, but let dashboards use full available width

### Whitespace Philosophy
- Surround dense information with generous outer spacing
- Compress inside rows and controls only when needed for scan efficiency
- Use empty space to reveal hierarchy, not to create visual theater

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| 0 | Flat background | Page canvas |
| 1 | Border only | Default cards, tables, panels |
| 2 | Border + soft shadow | Hovered cards, sticky headers |
| 3 | Stronger shadow + blur backdrop | Dialogs, sheets, dropdowns |

### Depth Principles
- Borders do most of the structural work.
- Shadows should be soft and short.
- Avoid high-contrast shadows or glossy effects.

## 7. Do's and Don'ts

### Do
- Use neutral-first surfaces with emerald as a supporting accent.
- Keep layouts crisp and operational.
- Prefer rounded-xl / rounded-2xl containers.
- Use blur and translucency sparingly on sticky UI.
- Keep icons small, consistent, and functional.

### Don't
- Don't flood pages with gradients or decorative color.
- Don't use saturated colors for non-interactive chrome.
- Don't make dashboard UI feel like a marketing site.
- Don't mix too many accent hues in one screen.
- Don't use heavy shadows, giant pills, or noisy border systems.

## 8. Responsive Behavior

### Breakpoints
- Mobile: `<768px`
- Tablet: `768px - 1024px`
- Desktop: `>1024px`

### Rules
- Sidebar collapses cleanly on smaller widths.
- Tables should degrade into stacked cards or horizontally scroll only as a fallback.
- Sticky toolbars and headers should preserve core actions first.
- Tap targets must stay comfortable even in dense admin views.

## 9. Implementation Prompt Guide

### Reusable Prompt
"Design this TowerDesk screen using a premium light SaaS admin style. Use soft zinc surfaces, white cards, subtle borders, restrained shadows, Geist typography, and emerald as the supporting accent. Keep the page highly scannable, avoid decorative gradients, and preserve calm visual hierarchy. For dense views, prioritize table readability, strong sectioning, and muted secondary text."

### Component Prompt
"Build this component in the TowerDesk style: white surface, zinc border, rounded-xl corners, low-contrast shadow, concise heading, muted support copy, and strong alignment. Use emerald only for active or positive states. If the flow is multi-step, add a visual stepper and spring-based directional transitions."

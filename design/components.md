# Component Rules

## General Rules

- Prefer existing ShadCN components.
- If a reusable pattern appears more than once, create a wrapper component.
- Do not invent one-off styles for common UI.

---

## Cards

Use cards as the primary surface wrapper.

Standard card classes:
- `rounded-2xl border border-border bg-card text-card-foreground`

Standard content padding:
- `p-6`

Use cards for:
- metrics
- forms
- tables
- filters
- settings sections
- summaries

Do not use random container styles instead of cards.

---

## Buttons

Use ShadCN Button.

Allowed variants:
- default
- secondary
- outline
- ghost
- destructive only when truly needed

Preferred shape:
- `rounded-xl`

Preferred sizing:
- default ShadCN sizing or consistent custom sizing

Rules:
- primary button = main action only
- secondary/outline = support action
- ghost = quiet action in dense UI

Do not create random button colors.

---

## Inputs

Use ShadCN Input, Textarea, Select, Checkbox, Switch, etc.

Rules:
- labels required
- helper/error text should be consistent
- focus ring required
- spacing between label and field must be consistent

Standard field stack:
- label
- control
- helper/error text

Do not style form controls ad hoc.

---

## Tables

Use ShadCN Table.

Rules:
- tables belong inside cards
- row hover should be subtle
- use muted text for secondary data
- action buttons should be compact and aligned

For dense data:
- use filters above the table
- use consistent column alignment
- avoid clutter

---

## Badges

Use badges for:
- statuses
- tags
- short labels

Rules:
- keep them small and readable
- use semantic theme tokens
- do not overuse bright status colors

---

## Dialogs / Sheets

Use ShadCN Dialog or Sheet.

Rules:
- use smooth entrance animation
- keep content focused
- avoid giant walls of text
- primary actions at the end
- destructive actions visually separated

---

## Navigation

Navigation must be calm and structured.

Sidebar:
- muted background or card-like surface
- active item clearly visible
- icons aligned
- consistent spacing

Topbar:
- simple
- not overcrowded
- search and profile actions aligned cleanly

---

## Empty States

Every empty state should include:
- short title
- brief supporting text
- clear CTA if appropriate

Optional:
- icon

Do not leave blank areas with no guidance.

---

## Loading States

Use skeletons, not spinner-only screens.

Preferred:
- skeleton blocks that match final layout

Do not flash entire layouts unnecessarily.

---

## Status / Feedback

For success, warning, error, info:
- use consistent alert style
- text first, color second
- keep tone calm and clear

Avoid aggressive bright UI.
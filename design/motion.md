# Motion Rules

## Purpose

Motion should improve clarity, not show off.

The UI should feel smooth, responsive, and premium.

---

## Motion Principles

- subtle
- fast
- purposeful
- consistent

Motion should help:
- page entry
- modal entry
- hover feedback
- collapsible sections
- loading transitions

---

## Allowed Motion Types

1. Fade
2. Slight translate on entry
3. Slight scale on hover
4. Smooth expand/collapse
5. Opacity transitions for loading/content swap

---

## Forbidden Motion Types

Do not use:
- bounce
- spin for normal UI transitions
- large slide distances
- elastic/cartoon motion
- long dramatic delays
- constant pulsing except skeleton loading

---

## Timing

Preferred durations:
- micro interactions: 0.12s to 0.18s
- normal transitions: 0.18s to 0.24s
- modal/sheet: 0.2s to 0.28s

Do not use sluggish motion.

---

## Easing

Preferred:
- easeOut
- standard smooth easing

Avoid playful easing.

---

## Page Entry

Recommended page animation:
- opacity from 0 to 1
- y from 8 or 10 to 0
- short duration

This should feel almost invisible.

---

## Hover Motion

Allowed:
- scale up to 1.01 or 1.02 max
- slight y shift if subtle
- soft background/border transition

Do not make buttons jump around.

---

## Modal / Dialog Motion

Dialogs should:
- fade in
- slightly scale from 0.97 or 0.98 to 1
- appear quickly

Backdrop should fade smoothly.

---

## Expand / Collapse

For accordions, filters, and advanced panels:
- animate height and opacity smoothly
- keep timing short
- do not create lag

---

## Reduced Motion

Honor reduced motion when possible.

If reduced motion is enabled:
- reduce transform-heavy transitions
- prefer opacity-only transitions

---

## Motion Enforcement

If motion does not add clarity, do not add motion.
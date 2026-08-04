# Strength 5×5 — Oxide (4a) implementation plan

Handoff plan for the Oxide redesign in the real codebase (React 18 + Tailwind v4 +
Phosphor, `src/`), sourced from option **4a** ("Oxide — 1d's hue, unchanged") on the
`Strength 5x5 Explorations` design canvas: `variant="oxide"` in
[oxide-prototype.dc.html](oxide-prototype.dc.html), which is `Strength5x5Phone.dc.html`
from that canvas. 4a takes 2a's full structure (plate stacks, big numerals, planned load,
full-bleed timer, rep-block set targets) and keeps 1d's warm accent unchanged. **Change
presentation only** — training logic (progression, deload, wall-clock timer, recovery,
Drive sync, i18n, import/export) stays as-is.

## 1. Design tokens (Oxide)

Declared in the `@theme` block of `src/index.css`, plus a `:root[data-theme='light']`
override of the same variable names (there is no separate `-lt` token set):

| Token | Dark | Light | Use |
|---|---|---|---|
| `--color-ground` | `#141310` | `#f7f4ef` | app background |
| `--color-surface` | `#1f1d18` | `#ffffff` | cards, sheets |
| `--color-surface-deep` | `#191713` | `#ece6dd` | timer strip |
| `--color-surface-nav` | `#100f0c` | `#ffffff` | tab bar |
| `--color-ink` | `#ece9e2` | `#191612` | primary text; muted = same at 55/45/38% alpha |
| `--color-accent` | `#c8663a` | `#b4552b` | THE only accent — lines, borders, icons, marks |
| `--color-accent-300` | `#eda175` | `#93401d` | accent-tinted text (weights, active labels) |
| `--color-accent-900` | `#3a2413` | `#f9e9df` | tinted fills (completed sets, active seg) |
| `--color-neutral-tint` | `#433d34` | `#ded7cc` | missed-set badge/fill background |

Rules: **no other hues** (no emerald/rose/amber/indigo/blue/lilac anywhere); font Inter,
max weight 600 (headings 500); one radius scale — 8–10px cards/buttons, set targets are
rounded rectangles (not circles); borders `ink/8–18`; primary buttons are **1px accent
outline on transparent**, never filled; section rules fade at ends via `.rule-fade` /
`.rule-fade-top` in `index.css`. Icons: Phosphor (`@phosphor-icons/react`).

Type scale, radii and component rules are otherwise unchanged from the prior Nocturne
spec — see [docs/design-system.md](../design-system.md) for the full current rulebook.

## 2. App shell

Unchanged from the shipped structure: header (idle only), tab bar that never collapses,
live bar above the nav when a workout is active on another tab. Oxide doesn't touch
navigation — only tokens, the Train screen, and set-target styling change.

## 3. Train — start screen (`TrainScreen.jsx`)

- **Plate stack** (`PlateStrip.jsx`): each idle row carries a small always-visible
  plate-stack preview under its name, scaled from the same `PLATE_STYLES` map
  `BarSetupDiagram` uses for the full bar-load accordion (`src/plateStyles.js`).
- **Big numeral**: `WeightInput`'s `prominent` variant grows from 19px/60px to
  26px/56px, so the weight is the largest thing in its row. The `compact` variant
  (Program tab, Log modal) is untouched.
- **Planned load**: a "PLANNED LOAD" kicker + total kg row sits above Start workout,
  computed by `plannedVolume()` in `utils.js` — `weight × sets × reps` for Standard's
  flat entries, summed per-set for Madcow's ramped entries.

## 4. Train — active session + timer strip

- **Full-bleed timer** (`RestTimer.jsx`): digits grow from 30px to 44px, the progress
  line from 2px to 3px, with matching padding. All existing timer logic (wall-clock
  anchor, expire → stopwatch, sound/vibrate) is unchanged.
- **Rep-block set targets** (`ExerciseCard.jsx`): set targets become
  `aspect-[1.35]` rounded rectangles (`rounded-[10px]`) instead of 62px circles —
  roughly twice the tap area, reading like a loaded bar rather than five dots. Missed
  sets drop the graded dashed-SVG-ring-over-transparent-border technique for a plain
  `1.5px dashed border-ink/50`, still paired with the corner ✕ badge — status stays
  shape-driven, never colour alone. Tap cycle and long-press rep picker are unchanged.

## 5. Program, Log, Stats, Options

Unchanged from the shipped Nocturne structure — 4a's canvas only exercises the Train
and Program screens; the rest inherit the new tokens automatically since they're all
built on the same `--color-*` custom properties.

## 6. Acceptance checklist

- [x] No emerald/rose/amber/indigo/blue/lilac classes remain; single accent
      `#c8663a` dark / `#b4552b` light
- [x] No `font-black`; uppercase only on kickers
- [x] Tab bar visible at all times incl. mid-workout; unchanged from Nocturne
- [x] Timer strip 44px digits / 3px progress line mid-session
- [x] Set targets are rounded rectangles; missed sets show a dashed border + ✕ badge
- [x] No dashed placeholder slots for unused sets
- [x] Idle rows show a plate strip and a planned-load total
- [x] Both light and dark mode use correct accent/fill tokens (previously a bug —
      light mode kept the dark `accent-300`/`accent-900` values)
- [x] All existing tests pass; new tests added for `plannedVolume`, `PlateStrip`, and
      the rep-block/dashed-border set-target styling
- [x] i18n: `workout.plannedLoad` added through `t()` with EN + FR keys

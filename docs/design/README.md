# Oxide redesign handoff

Design handoff for the Oxide (4a) UI/UX redesign of the app. These files are **reference
material for the migration**, not production code to copy.

| File | What it is |
| --- | --- |
| [oxide-implementation-plan.md](oxide-implementation-plan.md) | The spec — tokens, screen-by-screen layout, interaction rules, acceptance checklist. Source of truth. |
| `oxide-prototype.dc.html` | Interactive prototype (`Strength5x5Phone.dc.html` from the `Strength 5x5 Explorations` design canvas). Renders in a design-tool runtime, so read it as reference markup: styles are inline and behavior is in the `Component` class at the bottom. |

The durable rulebook distilled from these — the one to follow after the migration lands —
is [../design-system.md](../design-system.md).

## Ground rules

- **Option 4a ("Oxide")** on the `Strength 5x5 Explorations` canvas is the approved
  design: `variant="oxide"` in the prototype. It takes option 2a's full structure (plate
  stacks, big numerals, planned load, full-bleed timer, rep-block set targets) and keeps
  1d's warm accent (`#c8663a` dark / `#b4552b` light) unchanged. Other variants on the
  same canvas (`forge`, `cold`, `warm`, `gym`, `combined`, `base`, `repair`,
  `weightroom`, `effort`) are exploratory — ignore them.
- **High fidelity.** Colours, type sizes, weights, spacing, radii and copy in the
  prototype are final. Recreate them in the existing React components; do not port the
  prototype's HTML or its inline styles.
- **Presentation only.** Progression, deload, the wall-clock rest timer, workout
  recovery, StrongLifts CSV import, Google Drive sync, i18n and the localStorage schema
  do not change.

## Deviations from the plan as written

The canvas's `Strength5x5Phone.dc.html` component models a fixed Standard-5×5 fixture
(three lifts, always 5×5). The real app also supports Madcow's ramped sets, so two
adaptations apply here:

1. The plate strip and planned-load total use each lift's `topWeightOf(ex)` / the
   generic `plannedVolume()` helper (`src/utils.js`), which branches on whether an
   entry is a flat Standard weight or a ramped Madcow `setWeights` array — the canvas
   only had to handle the flat case.
2. Tailwind v4 tokens go in the `@theme` block of `src/index.css` (no
   `tailwind.config.js`); light mode overrides the **same** `--color-*` variable names
   inside `:root[data-theme='light']` rather than using a second `-lt`-suffixed token
   set.

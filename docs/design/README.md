# Nocturne redesign handoff

Design handoff for the UI/UX redesign of the app. These files are **reference material for
the migration**, not production code to copy.

| File | What it is |
| --- | --- |
| [nocturne-implementation-plan.md](nocturne-implementation-plan.md) | The spec — tokens, screen-by-screen layout, interaction rules, acceptance checklist. Source of truth. |
| `nocturne-prototype.dc.html` | Interactive prototype. Renders in a design-tool runtime, so read it as reference markup: styles are inline and behavior is in the `Component` class at the bottom. |

The durable rulebook distilled from these — the one to follow after the migration lands —
is [../design-system.md](../design-system.md).

## Ground rules

- **Option 1a** (the Android phone frame) is the approved design. Options 1b/1c on the same
  canvas are exploratory — ignore them except where the plan references them.
- **High fidelity.** Colours, type sizes, weights, spacing, radii and copy in the prototype
  are final. Recreate them in the existing React components; do not port the prototype's
  HTML or its inline styles.
- **Presentation only.** Progression, deload, the wall-clock rest timer, workout recovery,
  StrongLifts CSV import, Google Drive sync, i18n and the localStorage schema do not change.

## Deviations from the plan as written

The plan was written against an assumed Tailwind v3 setup. Two corrections apply here:

1. This project is on **Tailwind v4**. Tokens go in the `@theme` block of `src/index.css`,
   not a `tailwind.config.js` (there isn't one). Do not name a token after a stock palette
   entry — `--color-neutral-800` silently overrides Tailwind's own.
2. The plan specifies the **dark** theme only. Light mode is a shipped feature and must keep
   working; derive it from the same structure (invert ground/surface, keep the single accent).

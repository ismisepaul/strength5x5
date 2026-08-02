---
name: nocturne-ui
description: Design rules for any UI work in the Strength 5x5 app — styling, layout, colors, typography, icons, modals, sheets, navigation, or new screens. Use before writing or reviewing JSX/Tailwind in src/, and whenever a change touches how something looks or how a gesture is discovered. Triggers on "style", "restyle", "redesign", "theme", "colors", "dark mode", "layout", "component", "modal", "sheet", "nav", "icon", "spacing".
---

# Nocturne UI

Strength 5x5 uses one design language: **Nocturne** — quiet, single-accent, structural.
Full spec: [docs/design-system.md](../../../docs/design-system.md). Migration spec:
[docs/design/nocturne-implementation-plan.md](../../../docs/design/nocturne-implementation-plan.md).
Visual reference: `docs/design/nocturne-prototype.dc.html` (read as markup; option 1a only).

**The codebase has not been migrated yet.** It still uses slate/indigo/emerald/rose/amber,
`font-black` and mixed radii. New UI follows Nocturne; do not extend the old system.

## Non-negotiables

- **One accent: `#9184d9`.** No emerald, rose, amber, indigo, blue or raw slate. Status is
  never carried by hue — pair it with a shape (dashed ring, hollow dot, corner badge).
- **Inter, weight ≤ 600.** No `font-black`. Uppercase only on kickers (9.5–10px, .12–.14em,
  accent, weight 600).
- **One radius scale:** 8–10px cards/buttons, 12px modals, `14px 14px 0 0` sheets. Set
  targets and adherence dots are circles. Nothing else.
- **Primary buttons are a 1px accent outline on transparent.** Never filled. Secondary =
  `ink/18` outline. Tertiary = plain text.
- **Surfaces:** ground `#161826`, cards `#232532`, 1px `ink/8–18` border, no shadow.
  Muted text is the ink token at 55/45/38% alpha, never a grey.
- **Tab bar never collapses**, including mid-workout. Train always routes to the live
  workout when one is active. A live bar appears above the nav on other tabs.
- **Nothing dead on screen** — no placeholder slots for unprogrammed sets.
- **Gestures are taught.** Long-press, tap cycles, and swipes need a visible caption or a
  help-sheet entry.

## Tokens live in CSS, not a config

Tailwind **v4** — there is no `tailwind.config.js`. Add tokens to the `@theme` block in
[src/index.css](../../../src/index.css) as `--color-*`; they become utilities
automatically. Never name one after a stock palette entry (`--color-neutral-800`), which
silently overrides Tailwind's own.

## Every UI change also

- Routes user-facing strings through `t()` with matching keys in `src/i18n/locales/en.json`
  **and** `fr.json`.
- Keeps `role="dialog"`, `aria-modal="true"` and `aria-label` on dialogs and sheets, and a
  meaningful `aria-label` on icon-only buttons.
- Works in **both** dark and light mode (`isDark` prop). A dark-only change is unfinished.
- Leaves training logic alone — progression, deload, wall-clock timer, recovery, Drive
  sync, import/export, localStorage schema.
- Passes `npm test`, with a test for any new interaction.

## Before finishing

```bash
grep -roE "(bg|text|border|ring|from|to|fill|stroke)-(emerald|rose|amber|indigo|blue|slate)-[0-9]+" src
grep -ro "font-black" src
grep -roE "rounded(-\[[^]]+\]|-[a-z0-9]+)?" src | sed 's/^[^:]*://' | sort | uniq -c
npm test
```

Zero hits on the first two for files you touched; radii confined to the scale above.

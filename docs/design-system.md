# Nocturne Design System

The design language for Strength 5x5. **Every UI change must follow this document.**

Status: **implemented** (issue #18). The dark palette is live across the app; the light
palette below is an interim pass, not the final light-mode redesign (that's a follow-up
issue). Follow these rules for all UI work, including `ErrorBoundary.jsx`'s crash screen,
which was out of scope for the migration and still carries the pre-Nocturne palette.

Source of truth for the migration (retained for history; the plan and prototype describe
the dark theme this document now reflects):

- [docs/design/nocturne-implementation-plan.md](design/nocturne-implementation-plan.md) — screen-by-screen spec
- [docs/design/nocturne-prototype.dc.html](design/nocturne-prototype.dc.html) — interactive prototype
  (option 1a is approved; 1b/1c on the same canvas are exploratory — ignore them).
  It renders in a design-tool runtime, so read it as reference markup: styles are inline
  and behavior is in the `Component` class at the bottom.

---

## 1. Principles

1. **One accent, no other hues.** `#9184d9` carries every piece of emphasis — lines,
   borders, icons, marks, active states. Status is never communicated by hue.
2. **Quiet typography.** Inter, weight 600 maximum. Nothing shouts. Uppercase is
   reserved for kickers.
3. **One radius scale.** 8–10px for cards and buttons. Set targets are the only circles.
4. **Outlined, not filled.** Primary actions are a 1px accent outline on transparent.
   Filled buttons do not exist.
5. **Structure over chrome.** Rows with fading rules instead of nested cards; a border
   at 8–18% alpha instead of a shadow.
6. **Nothing dead on screen.** No placeholder slots for sets that aren't programmed, no
   disabled controls that could simply be absent.
7. **Gestures are taught, not hidden.** Any interaction that isn't a plain tap needs a
   visible caption or a help entry.

---

## 2. Tokens

This project is on **Tailwind CSS v4** — there is no `tailwind.config.js`. Tokens are
declared in the `@theme` block of [src/index.css](../src/index.css) and become utilities
automatically (`--color-accent` → `bg-accent`, `text-accent`, `border-accent`).

```css
@theme {
  --color-ground:        #161826; /* app background */
  --color-surface:       #232532; /* cards, sheets */
  --color-surface-deep:  #1c1e2c; /* timer strip */
  --color-surface-nav:   #141624; /* tab bar */
  --color-ink:           #e9e9ed; /* primary text */
  --color-accent:        #9184d9; /* the only accent */
  --color-accent-300:    #d2cefd; /* accent-tinted text: weights, active labels */
  --color-accent-800:    #423a6a; /* tinted fill: active segment */
  --color-accent-900:    #2b2741; /* tinted fill: completed sets, toasts */
  --color-neutral-tint:  #3f424d; /* missed-set badge background */
}
```

Do not name a token `--color-neutral-800` / `--color-slate-*` etc. — in Tailwind v4 that
silently overrides the stock palette of the same name.

### Alpha, not new colors

Muted text and borders are the ink token at reduced alpha (`text-ink/55`), never a
separate grey. Canonical steps:

| Use | Value |
| --- | --- |
| Secondary text | `text-ink/55` |
| Tertiary text / meta | `text-ink/45` |
| Faint text / captions | `text-ink/38` |
| Inactive tab, disabled label | `text-ink/35` |
| Unlogged set number | `text-ink/40` |
| Card / control border | `border-ink/8` … `border-ink/18` |
| Chart grid | `rgba(233,233,237,.07)` |

### Type scale

| Role | Size / weight |
| --- | --- |
| Page title | 22px / 500 |
| Hero (workout name on Train) | 30px / 500 |
| Card title | 14–15px / 600 |
| Body | 12–13px |
| Meta | 11–11.5px |
| Kicker | 9.5–10px / 600, uppercase, letter-spacing .12–.14em, accent |

**Kickers are the only uppercase text in the app.** Font family is Inter (400/500/600);
never `font-bold`+ beyond 600, never `font-black`.

### Radii

8–10px for cards, buttons and controls. 12px for centred modals, `14px 14px 0 0` for
bottom sheets. Set targets and adherence dots are full circles. Nothing else is round,
and `rounded-2xl` / `rounded-3xl` / `rounded-[2rem]` / `rounded-[2.5rem]` are gone.

### Fading rule

Section separators fade out at both ends instead of running edge to edge:

```css
background: linear-gradient(
    to right,
    transparent,
    rgba(233,233,237,.09) 48px,
    rgba(233,233,237,.09) calc(100% - 48px),
    transparent
  ) bottom / 100% 1px no-repeat;
```

### Icons

**Phosphor** (`@phosphor-icons/react`) — replaces Lucide. Weight `regular` by default;
`fill` for the active tab icon, the brand barbell and play glyphs; `bold` only for the
8px ✕ on a missed-set badge. The full glyph inventory is in the implementation plan.

---

## 3. Component rules

**Buttons.** Primary = 1px accent outline on transparent, accent label. Secondary =
1px `ink/18` outline. Tertiary = plain text button, `ink/45`. Disabled = 35% opacity or
a 12% border with 30% text; never a colour change.

**Cards.** `surface` background, 10px radius, 1px `ink/8` border, no shadow. Do not nest
a card inside a card — use rows with fading rules.

**Rows.** Label left, value right, fading rule underneath. This is the default layout
for lists (exercise lists, options, program editor).

**Set targets.** ~44–52px circles, 16px/600 number.

| State | Treatment |
| --- | --- |
| Unlogged | 1px `ink/18` border, `ink/40` number, shows the target |
| Passed | 1px accent border, `accent-900` fill, `accent-300` number |
| Missed (0 ≤ reps < target) | 1.5px **dashed** `ink/50` border, neutral tint fill, shows reps achieved, plus a 16px corner badge (`neutral-tint` circle, bold 8px ✕) |

Never render a slot for a set the program doesn't include.

**Modals and sheets.** `surface` background, 12px radius centred / `14px 14px 0 0` when
bottom-anchored, outlined primary action, plain-text secondary. Plate calculator, rep
picker and help are **bottom sheets** (`items-end` overlay). Keep `role="dialog"`,
`aria-modal="true"` and `aria-label` on every one.

**Switches.** Custom 38×22 — accent border, `accent-900` track and accent knob when on;
`ink/18` border and neutral knob when off.

**Segmented controls.** Active segment = `accent-900` fill with an inset accent ring;
inactive = transparent, `ink/45` label.

**Toasts.** `accent-900` background, accent border, `accent-300` text, centred above the
nav bar.

**Charts** ([StatsChart.jsx](../src/components/StatsChart.jsx), Recharts stays). Weight
line `#9184d9` 2px with dots; e1RM line `#d2cefd` at 55% alpha, 1.5px dashed; grid
`rgba(233,233,237,.07)`; axis text 9px at 40% alpha. Series toggles are outlined chips
with a colour dot; at least one series is always on.

**Trends are never red or green.** Up = accent, down = neutral, flat = `ink/40`.

---

## 4. Navigation and session rules

- The **tab bar is always visible**, including mid-workout. There is no hamburger, no
  drawer, no collapsed state, no ✕ on the Train tab.
- Tapping **Train** always routes correctly: to the live workout if one is active,
  otherwise to the start screen.
- When a workout is active and the user is on another tab, a 40px accent-outlined
  **live bar** sits above the tab bar: play icon + "Resting · m:ss" (or "Workout in
  progress") + "Return ›". Tapping it returns to Train.
- During an active workout on the Train tab, the **timer strip replaces the header** at
  the top of the screen — it is not docked at the bottom. Header everywhere else.
- The header carries a `?` button that opens the "How it works" bottom sheet.
- The **idle screen's exercise rows are editable**: the same − / + weight steppers as
  `ExerciseCard` (36px buttons) sit beside each weight, adjusting in the exercise's
  program increment (2.5 kg, 5 kg for deadlift) with a floor at the empty 20 kg bar.
  They write to `weights` state directly — there's no active workout yet to hold a
  per-session override — so the change persists into the started workout, Stats, and
  everywhere else `weights` is read, the same as adjusting mid-session.

## 5. Interaction rules

- **Set tap cycle:** unlogged → target → target−1 → … → 1 → 0 → unlogged.
- **450ms long-press** on a set opens the rep-picker bottom sheet (0…target, plus
  "Clear set"). Must work with touch *and* mouse; suppress `contextmenu` on set buttons.
- A missed set shows the dashed ring, the ✕ badge, and a note under the exercise:
  `↳ Missed reps — 62.5 kg holds next session`.
- The first exercise shows a teaching caption until the first set is logged:
  "Tap to log all 5 reps · hold a set to pick an exact count".
- Animation: only `transition: width 1s linear` on the timer progress line and short
  opacity/transform transitions. No confetti, no celebratory motion.

---

## 6. Do not

- Introduce a second hue. No emerald, rose, amber, indigo, blue, or raw slate classes.
- Use `font-black`, or uppercase anything that isn't a kicker.
- Add a filled primary button, a drop shadow, or a radius outside the 8–14px scale.
- Encode state in colour alone — pair it with a shape (dashed ring, hollow dot, badge).
- Hardcode a user-facing string. Every new label goes through `t()` with EN **and** FR keys.
- Change training logic while changing presentation. Progression, deload, the wall-clock
  timer, recovery, Drive sync, import/export and the localStorage schema are untouched by
  design work.

## 7. Light mode

**Light mode stays.** The toggle in Options is a shipped feature and was not removed.

The Nocturne spec defines the **dark** theme; light is an interim derivation of the same
structure (invert ground/surface, keep the single accent, keep every rule in §3–§5), not
yet a from-scratch light redesign. The `isDark` prop and its ternary class strings stay in
place everywhere — every dark token has a `-lt` counterpart and both branches ship in the
same commit.

Interim light palette, declared in the `@theme` block of `src/index.css` alongside the dark
tokens:

| Token | Value | Dark equivalent |
| --- | --- | --- |
| `--color-ground-lt` | `#f5f5f8` | `ground` |
| `--color-surface-lt` | `#ffffff` | `surface` |
| `--color-surface-deep-lt` | `#ececf2` | `surface-deep` |
| `--color-surface-nav-lt` | `#ffffff` | `surface-nav` |
| `--color-ink-lt` | `#1b1c28` | `ink` (same 55/45/38/18/8 alpha steps) |
| `--color-accent-ink-lt` | `#5b4fb0` | `accent-300` for text — `#d2cefd` is unreadable on white |
| `--color-accent-tint-lt` | `#efedfa` | `accent-900`/`accent-800` fills |

`accent` itself (`#9184d9`) is used as-is in both themes for borders and icons. The fading
rule has a light counterpart, `.rule-fade-lt`, at 10% ink-lt alpha instead of 9% ink alpha.

Light mode is expected to look transitional — legible and usable on every screen, never
dark-on-dark or unstyled, but not a polished light-specific design. That polish is a
follow-up issue.

## 8. Checking your work

```bash
# no stray hues (empty except ErrorBoundary.jsx, which predates and is outside the migration)
grep -roE "(bg|text|border|ring|from|to|fill|stroke)-(emerald|rose|amber|indigo|blue|slate)-[0-9]+" src

# no shouting type
grep -ro "font-black" src
grep -ro "uppercase" src   # kickers only

# one radius scale
grep -roE "rounded(-\[[^]]+\]|-[a-z0-9]+)?" src | sed 's/^[^:]*://' | sort | uniq -c

# no nav collapse machinery
grep -rn "navExpanded" src
```

Then run `npm test`.

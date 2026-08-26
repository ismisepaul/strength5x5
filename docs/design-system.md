# Oxide Design System

The design language for Strength 5x5. **Every UI change must follow this document.**

Status: **implemented**. Both the dark and light palettes are live across the app.
Follow these rules for all UI work, including `ErrorBoundary.jsx`'s crash screen, which
was out of scope for the migration and still carries the pre-Oxide palette.

Source of truth for the migration (retained for history; the plan and prototype describe
option 4a, which this document now reflects):

- [docs/design/oxide-implementation-plan.md](design/oxide-implementation-plan.md) — screen-by-screen spec
- [docs/design/oxide-prototype.dc.html](design/oxide-prototype.dc.html) — interactive prototype
  (`variant="oxide"` is approved; the other variants on the same canvas are exploratory —
  ignore them). It renders in a design-tool runtime, so read it as reference markup:
  styles are inline and behavior is in the `Component` class at the bottom.

---

## 1. Principles

1. **One accent, no other hues.** `#c8663a` dark / `#b4552b` light carries every piece of
   emphasis — lines, borders, icons, marks, active states. Status is never communicated
   by hue.
2. **Quiet typography.** Inter for every body string, label and button — weight 600
   maximum, nothing shouts. Titles, weights, set counts and stat figures carry a
   second, structural face (Archivo); kickers, timers, tonnage and dates carry a third,
   mechanical one (Space Mono). See **Typography** in §2. Uppercase is reserved for
   kickers.
3. **One radius scale.** 8–10px for cards and buttons. Set targets are rounded
   rectangles; adherence dots are the only circles.
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
automatically (`--color-accent` → `bg-accent`, `text-accent`, `border-accent`). Light
mode overrides the **same** variable names inside `:root[data-theme='light']` — there is
no separate `-lt`-suffixed token set (see §7).

```css
@theme {
  --color-ground:        #141310; /* app background */
  --color-surface:       #1f1d18; /* cards, sheets */
  --color-surface-deep:  #191713; /* timer strip */
  --color-surface-nav:   #100f0c; /* tab bar */
  --color-ink:           #ece9e2; /* primary text */
  --color-accent:        #c8663a; /* the only accent */
  --color-accent-300:    #eda175; /* accent-tinted text: weights, active labels */
  --color-accent-900:    #3a2413; /* tinted fill: completed sets, toasts, active segment */
  --color-neutral-tint:  #433d34; /* missed-set badge background */
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
| Unlogged set number | `text-ink/85` |
| Card / control border | `border-ink/8` … `border-ink/18` |
| Missed-set border | `border-ink/50` |
| Chart grid | `rgba(236,233,226,.07)` dark / `rgba(25,22,18,.07)` light |

### Type scale

| Role | Size / weight |
| --- | --- |
| Page title | 24px / 500 |
| Hero (workout name on Train) | 32px / 500 |
| Working-weight numeral (`WeightInput` `prominent`) | 26px / 500 |
| Card title | 15–17px / 600 |
| Body | 13.5–15px |
| Meta | 12–12.5px |
| Kicker | 10.5px / 600, uppercase, letter-spacing .14em, accent |
| Tab label | 11px (the one exception below the 12px type floor besides kickers) |

**Kickers are the only uppercase text in the app.** **Type floor is 12px** everywhere
except kickers (10.5px) and tab labels (11px).

### Typography

Three faces, each with a fixed job — see [BarMark.jsx](../src/components/BarMark.jsx) and
the mark it pairs with for the brand rationale:

| Face | Weights loaded | Role |
| --- | --- | --- |
| **Inter** (`font-sans`, the default) | 400 / 500 / 600 | Every body string, label and button. Never `font-bold`+ beyond 600, never `font-black`. |
| **Archivo** (`font-display`) | 500 / 600 / 700 | Screen titles, the header wordmark, exercise names, and every weight / set count / stat figure (paired with `tabular-nums`). Titles take `font-semibold tracking-[-0.025em]`; the header wordmark tightens further (see below). |
| **Space Mono** (`font-mono`) | 400 / 700 | Kickers (`uppercase tracking-[0.14em]`, weight `font-bold` — 600 isn't loaded for this face, so kicker weight is 700 not 600), the rest timer, session clock, tonnage and log dates. |

Only these three families exist in the app — do not add a fourth without updating this
table. `font-display`/`font-mono` weights are capped at what's imported in
[src/main.jsx](../src/main.jsx) (`@fontsource/archivo` 500/600/700,
`@fontsource/space-mono` 400/700); a class like `font-mono font-semibold` silently falls
back to the browser's faux-bold on an unloaded weight, so mono text is always `font-normal`
or `font-bold`, never `font-medium`/`font-semibold`.

The header wordmark lockup gives `Strength` full ink weight and drops `5x5` to
`font-medium text-ink/40`, so the name reads as a word with a qualifier:

```jsx
<h1 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
  {t('app.titleMain')} <span className="font-medium text-ink/40">{t('app.titleSuffix')}</span>
</h1>
```

### Radii

8–10px for cards, buttons and controls. 12px for centred modals, `14px 14px 0 0` for
bottom sheets. Set targets are `aspect-[1.35]` rounded rectangles at `rounded-[10px]`;
adherence dots are the only full circles. `rounded-2xl` / `rounded-3xl` /
`rounded-[2rem]` / `rounded-[2.5rem]` are gone.

### Fading rule

Section separators fade out at both ends instead of running edge to edge:

```css
background: linear-gradient(
    to right,
    transparent,
    rgba(236,233,226,.09) 48px,
    rgba(236,233,226,.09) calc(100% - 48px),
    transparent
  ) bottom / 100% 1px no-repeat;
```

(`.rule-fade` / `.rule-fade-top` in `index.css`; the `:root[data-theme='light']`
overrides use the light ink rgb triple, `25,22,18`, instead.)

### Icons

**Phosphor** (`@phosphor-icons/react`) everywhere except the app mark. Weight `regular`
by default; `fill` for the active tab icon (including Train's `Barbell`) and play glyphs;
`bold` only for the 9px ✕ on a missed-set badge. The full glyph inventory is in the
implementation plan.

The app mark is [BarMark.jsx](../src/components/BarMark.jsx) (`currentColor`, pair with
`text-accent`) — two plates and an outboard collar on a shaft, not a Phosphor glyph. It
sits **beside the title in the header only**; the tab bar keeps Phosphor's `Barbell` for
Train, including its `fill` weight when active. The same mark, on the accent tile, is the
app/favicon (`docs/design/mark.svg` glyph master, `docs/design/icon.svg` tile master,
regenerated into `public/icon-*.png` / `favicon-32.png` / `apple-touch-icon-180.png`) —
those files are the mark alone, not composited with any other UI chrome.

---

## 3. Component rules

**Buttons.** Primary = 1px accent outline on transparent, accent label. Secondary =
1px `ink/18` outline. Tertiary = plain text button, `ink/45`. Disabled = 35% opacity or
a 12% border with 30% text; never a colour change.

**Cards.** `surface` background, 10px radius, 1px `ink/8` border, no shadow. Do not nest
a card inside a card — use rows with fading rules.

**Rows.** Label left, value right, fading rule underneath. This is the default layout
for lists (exercise lists, options, program editor). On Train's idle screen, each row
also carries a small always-visible plate-stack preview under the exercise name
(`PlateStrip.jsx`, decorative/`aria-hidden`) — scaled down from the same `PLATE_STYLES`
map `BarSetupDiagram` uses for the full bar-load diagram (`src/plateStyles.js`).

**Planned load.** A "PLANNED LOAD" kicker + total kg row sits above Start workout on
the idle screen, from `plannedVolume()` in [utils.js](../src/utils.js) — `weight × sets
× reps` for Standard's flat entries, summed per-set for Madcow's ramped entries.

**Set targets.** `aspect-[1.35]` rounded rectangles (`rounded-[10px]`, filling their
flex slot), 20px `font-display font-semibold tabular-nums` number — roughly twice the tap
area of a circle, and the row reads like a loaded bar rather than five dots. Rebalanced so
a logged set is readable at arm's length (mid-workout, this is the number a lifter checks
between sets without picking the phone up):

| State | Treatment |
| --- | --- |
| Unlogged | 2px `ink/42` border, `ink/7` fill, `ink/85` number, shows the target |
| Passed | 2px accent border, **solid accent fill**, `ground`-coloured number, 3px `accent-900` halo (`shadow-[0_0_0_3px_var(--color-accent-900)]`) |
| Missed (0 ≤ reps < target) | 2px **dashed** `ink/50` border, `neutral-tint` fill, shows reps achieved, plus a 19px corner badge (`neutral-tint` circle, bold 9px ✕) |

The same three-state treatment is reused everywhere a logged set renders read-only (the
Log screen's expanded session rows, `EditEntryModal`'s set editor) — one visual language
for "a set and whether it landed," not a Train-tab-only pattern.

Never render a slot for a set the program doesn't include. Never becomes red — status
here is shape (dashed border + badge), not hue.

**Modals and sheets.** `surface` background, 12px radius centred / `14px 14px 0 0` when
bottom-anchored, outlined primary action, plain-text secondary. Rep picker and help are
**bottom sheets** (`items-end` overlay). Keep `role="dialog"`, `aria-modal="true"` and
`aria-label` on every one. There is no plate-calculator modal — the bar-load diagram is
an inline accordion on `ExerciseCard` (see below).

**ExerciseCard warm-up/bar-setup accordions.** Below the set targets (and below the
missed-reps note / teaching caption, when present): a faded top rule (`.rule-fade-top`),
then a `flex justify-between` row of two text-buttons, each ≥36px tall, 12.5px/500 —
"⌄ Warm-up" (caret before label) and "Bar setup ⌄" (caret after). Inactive text is 45%
alpha; the open one brightens to `accent-300` and its caret flips from `CaretDown` to
`CaretUp`. State is `null | 'warm' | 'bar'`, local to the card — opening one closes the
other. The open panel is a recessed block (`bg-ground/60`, 9px radius, ~14px padding)
directly below the footer row:
- **Warm-up:** three rows (13px, tabular) — empty bar (20 kg × 5), prep
  (`round((20 + (weight−20) × 0.6) / 2.5) × 2.5` kg × 3), and working weight
  (`accent-300`, weight kg × reps).
- **Bar setup:** a side-view bar diagram, used on both the start screen and workout
  cards, built from `calculatePlates` (the same greedy 25/20/15/10/5/2.5/1.25-per-side
  breakdown used elsewhere) — shaft, collar, one chip per plate (largest first, tallest
  first), then a sleeve labelled "20". Plate fills are standard muted plate colours
  scoped to this diagram (and the idle-row `PlateStrip`) only, declared in
  [plateStyles.js](../src/plateStyles.js): 25 `#a8403e`, 20 `#37628f`, 15 `#b8971f`
  with `#1a1608` text, 10 `#3a7a53`, 5 `#2a2c38`, 2.5 `#5f636f`, 1.25 `#7c8090`, with
  light `#e9e9ed` text elsewhere. Plate heights are 118/112/100/88/70/56/44px
  respectively (the idle-row strip scales these down by /6). The weight is printed on
  every plate, so colour is never the only cue. Colours here are fixed hex, not theme
  tokens — the diagram reads the same in light and dark mode. A caption below reads
  "Per side · 20 kg bar · {total} total", or "Empty bar · 20 kg" when loaded weight is
  at or below the bar itself.

**Switches.** Custom 46×26 track, 20px knob (`translate-x-[21px]` when on) — accent border,
`accent-900` track and accent knob when on; `ink/18` border and neutral knob when off.
A switch whose parent setting is off takes `disabled` — the row dims to `opacity-35` and
its description says which switch it is waiting on ("Needs Sound alert on"). A dependent
control never sits there reading as on while doing nothing; that is the "nothing dead on
screen" rule applied to settings. Options' "Five-second warning" under "Sound alert" is
the reference case.

**Steppers.** Every − / + control shares one `StepperButton` component: 8px radius,
outlined `ink/18` border. `ProgramEditor` sets/reps use the default 40×40px / 16px icon.
Weight editing (see below) uses the 44×44px / 15px-icon `prominent` variant on Train,
and the 40×40px / 16px-icon `compact` variant on the Program tab and in the Log.
`RestIntervalControl` (see below) uses 44×44px / 16px icons — the same footprint as
`prominent` with `compact`'s icon size, since it flanks a fill track rather than a
typeable number. `StepperButton`'s `dimmed` prop (opacity-35) marks one pressed against
a bound it can't move past without disabling it — the tap still lands and is what
surfaces the explanation for why it won't go further.

**Segmented controls.** Active segment = `accent-900` fill with an inset accent ring
(`shadow-[inset_0_0_0_1px_var(--color-accent)]`, so it re-themes automatically);
inactive = transparent, `ink/45` label.

**Toasts.** `accent-900` background, accent border, `accent-300` text, centred above the
nav bar.

**Charts** ([StatsChart.jsx](../src/components/StatsChart.jsx), Recharts stays). Recharts
consumes stroke/fill colours as literal prop values, not Tailwind classNames, so they
can't re-theme via the CSS custom properties alone — they're computed from `isDark`
instead: weight line `#c8663a` dark / `#b4552b` light, 2px with dots; e1RM line
`#eda175` dark / `#93401d` light at 55% alpha, 1.5px dashed; grid and axis text use the
theme's ink rgb triple (`236,233,226` dark / `25,22,18` light) at 7%/40% alpha; tooltip
text 13.5px. Series toggles are outlined chips with a colour dot; at least one series is
always on.

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
  the top of the screen — it is not docked at the bottom. Header everywhere else. Rest
  **counts up from 0:00** rather than down, and keeps counting past the programmed
  interval instead of resetting there — only the hard 5:00 ceiling (`CUSTOM_REST_MAX`)
  freezes it. The track's **scale is the interval, not a fixed 0–5:00 span**: a 1:30
  rest fills the track exactly, not one thirded away by two-thirds of dead space, and
  the scale only widens to the full 5:00 ceiling once elapsed actually runs past the
  marker — one re-scale, not a gradual expansion, so the room is borrowed, not
  pre-drawn. A 3px accent fill (5px
  once rest is running late — see below) tracks elapsed up to the marker; past it, a
  second segment in `accent-900` with an `accent` left border continues the fill for the
  overtime stretch, reusing the muted/accent pairing already used for "logged but
  missed" elsewhere rather than inventing a one-off darker accent. Faint reference
  hairlines at 1:30 and 3:00 sit on the track, but only when they fall inside the
  current scale and don't coincide with the marker itself (no redundant double-mark at
  the same spot). An accent caret + `m:ss` label floats above the track at the marker's
  position (right-aligned instead of centered once it's within 12% of the right edge, so
  the label can't clip off the strip — which is the normal case before overtime, since
  the marker sits right at the scale's own endpoint), and a muted end label at the right
  edge reads the *current* scale's endpoint, hidden whenever it would just duplicate the
  marker's own label — before overtime starts (scale ends at the marker) and once the
  interval itself is already 5:00. Digits are 44px tabular; kicker reads "Rest"
  until 5 seconds before the marker, "Get ready" for that last stretch, "Lift" once the
  marker passes, and "Time" once the clock hits the 5:00 ceiling — kicker and digits all
  turn `accent-300` for every state past "Rest". Once past the marker, a small
  parenthesized `(+m:ss)` next to the digits reads the delta past the marker — never
  "+m:ss over": the lifter could simply still be lifting, not running late, and "over" is
  a verdict the app has no way to make. Unlike the digits themselves, this bracket is
  **not** subject to the 5:00 ceiling — it keeps counting up off the raw elapsed time
  (`rawRestElapsedFromTimer`) for as long as rest keeps running, rather than freezing at
  whatever delta the ceiling happened to land on. In the last-5-seconds-before-the-marker stretch
  specifically the strip also floods to `accent-900` with a breathing accent wash and a
  1px accent bottom border, and digits grow to 52px; the track itself thickens to 5px for
  that stretch *and* for the whole overtime stretch past the marker. The wash is the
  app's only looping animation, so it is also the only one with a
  `prefers-reduced-motion` answer: the keyframes are redefined to hold a steady `.09`
  rather than the animation being dropped, since the flood still has to read. **The
  strip has no controls while rest is running** — no skip button — the only tap left is
  the "Dismiss" on the exercise/workout-complete banner. The expiry chime is a soft
  wooden marimba (two struck notes, 339.5/679Hz), not a pure tone, and (if the
  "Five-second warning" setting is on, alongside Sound alert) a quiet rising pip marks
  each of those last 5 seconds. Pip scheduling keys off `timer.seconds` alone — the two
  settings are read through a ref, so toggling either mid-window can't replay the
  current second's pip. The session clock in the strip's corner reads off the same
  render pass as the rest digits (not its own independent polling interval)
  specifically so the two numbers can't visibly drift out of phase with each other.
  Changing the rest interval in Settings **retargets a rest already in progress**
  (`useTimer`'s `retarget()`) rather than only taking effect on the next one — the
  marker moves live, and elapsed time is preserved rather than restarting the clock.
  This only applies when the running rest's duration actually came from
  `preferredRest` (App.jsx tracks this per-rest); Madcow's per-set ramp rest and the
  fixed 300s missed-rep rest are untouched by the setting either way, matching how
  they were already sourced independently of it. The compact live bar shown on other
  tabs while a workout is active reads the exact same count-up clock as the Train tab
  strip (continuing past the marker rather than resetting to a fresh stopwatch at that
  point), so switching tabs mid-rest never shows a different number than the strip
  would. Resuming a saved workout rehydrates a rest that was still in flight
  (`useTimer`'s `resume()`), including one whose marker passed while the app was closed
  — the marker and the overtime that accrued offline both come back rather than the
  clock restarting at 0:00, and no chime fires for a moment that already passed. All
  timer logic (wall-clock anchor, expire → stopwatch, sound/vibrate, retargeting,
  resume) lives in `useTimer`/`RestTimer.jsx` and is untouched by presentation
  work.
- The header carries a `?` button that opens the "How it works" bottom sheet.
- **Every editable weight in the app — Train (idle and active), the Program tab's
  Madcow top sets, and the Log's add/edit-entry modal — uses one `WeightInput`
  component.** There is no pencil, no disclosure step, and no separate commit/cancel
  row: a − stepper, the number itself, and a + stepper are all always visible and
  always usable.
  - The number is a bare `<input inputMode="decimal">`, transparent background, a
    1.5px `ink/18` bottom border that turns accent on focus, a muted "kg" suffix
    beside it.
  - Two variants: `prominent` (26px/500 number, 56px wide, 44px steppers / 15px icons
    — Train idle rows and `ExerciseCard`) and `compact` (16px/500 number, 40px
    steppers / 16px icons — Madcow top sets and the Log modal).
  - **Editing is draft-based, but local to each field.** Focusing the input seeds a
    draft from the current value and selects it; typing only mutates that draft.
    It commits on blur or Enter — parsing the draft (comma decimals accepted),
    snapping to *that lift's own increment* via `roundWeight(weight, increment, min)`,
    and clamping to the field's floor — or, if unparseable, reverts to the unchanged
    previous value. Escape reverts without committing. Because the draft is local
    `useState` inside `WeightInput` rather than one shared value, editing one
    exercise's field never discards another's in-progress draft; moving focus away
    just commits the first instead.
  - **Steppers commit immediately** — tapping − or + applies that lift's increment
    to whatever's currently in the field (typed-but-uncommitted or last-committed)
    and writes straight through, no separate confirm step. They use
    `onMouseDown={e => e.preventDefault()}` so tapping one doesn't blur/commit the
    input first.
  - **Rest interval is the app's one number that doesn't use `WeightInput`'s inline
    lockup, because it has no discrete increment to hand a lift** (design 3c, "no
    custom mode at all"). There is one value, `RestIntervalControl.jsx`, always live
    and always adjustable — no segmented control, no "Custom" state, no sheet
    (superseding design 3b's `CustomRestSheet`). The row leads with the label/caption
    pair on the left and the value itself clock-formatted (`0:45`) large on the
    right, then a stepper row: 44px `StepperButton`s (`WeightInput`'s `prominent`
    size, 10s `CUSTOM_REST_STEP`) flank a track that fills left-to-right in
    proportion to `(preferredRest - CUSTOM_REST_MIN) / (CUSTOM_REST_MAX -
    CUSTOM_REST_MIN)` and centres a step/ceiling caption ("10 s steps · max 5:00").
    `REST_PRESETS` render as three plain shortcut buttons below — not a segmented
    control's selected state — that jump straight to a number on tap; a preset
    lights up (accent border + `accent-900` fill) only when the live value happens
    to equal it, and dims back out the moment a stepper tap moves away. Nothing in
    the row ever appears, collapses, or opens — the trade-off this design accepts is
    that the presets lose their persistent "selected" reading in exchange for the
    fewest moving parts.
  - `CUSTOM_REST_MAX` caps the interval at 5:00, the top preset, rather than leaving it
    open-ended — routinely needing longer than that is read as a signal about the
    weight or the rest, not a gap the control should paper over with a bigger number.
    Design 4a ("3c with a hard 5:00 cap") layers live feedback for both ends of the
    range on top of 3c, driven from `RestIntervalControl`'s local `notice` state
    (`'cap' | 'short' | null`, mirroring the prototype's `msgD`):
    - Pressing + while `preferredRest` is already at `CUSTOM_REST_MAX` sets
      `notice = 'cap'` and renders `options.restIntervalCapExplainer` ("Greater than
      5 minutes suggests the weight is too heavy. Deload to continue instead.") in a
      left-accent-bordered callout with a `Warning` (triangle) icon below the
      presets. The + `StepperButton` also gets `dimmed` (opacity-35, still
      clickable — tapping a dimmed stepper is exactly what surfaces the notice) once
      `preferredRest >= CUSTOM_REST_MAX`; − dims the same way at `CUSTOM_REST_MIN`.
    - Stepping (or jumping via a preset) to a value under `REST_SHORT_SECONDS` (60s)
      sets `notice = 'short'` and renders `options.restIntervalShortWarning`
      ("Less than 1 minute rest between sets is not enough to recover.") in the same
      callout style. Below 5:00 there's no upper-bound reading to explain, so `short`
      and `cap` never render at once.
    - Jumping to the 5:00 preset directly does **not** set `notice = 'cap'` — only
      pressing + while already there does. Any interaction that doesn't re-trigger a
      notice's condition clears it, so neither is ever a permanent caption.
  - `restBand()` (`utils.js`) is a second, independent readout: "Typical for: Light
    Set / Medium Set / Heavy Set", mirroring design 4b's own set-intensity reference
    (Light 1:30–2:00, Medium 2:00–3:00, Heavy 3:00–5:00, extended down to 60s so
    there's a band for everything above the "too short to recover" floor). Unlike
    `notice`, the band is not sticky — it's recomputed from `preferredRest` on every
    render, so it can be visible at the same time as a `cap` notice (e.g. "Heavy
    Set" plus the cap explainer, both true at 5:00) but never alongside `short`
    (below 60s there's no band to name).
  - Rest seconds step by 5 and clamp to `CUSTOM_REST_MIN`/`MAX` without snapping to a
    grid — unlike weights, which snap to the lift's own increment, because seconds
    aren't loadable in fixed jumps and snapping would discard a deliberate 8.
  - On Train's idle screen, committing writes to `weights` state directly — there's
    no active workout yet to hold a per-session override — so the change persists
    into the started workout, Stats, and everywhere else `weights` is read, the same
    as committing mid-session.
  - **A Madcow lift's field always edits its top set (`mcTop[id]`), on Train and the
    Program tab alike** — never a flat per-session weight, since Madcow displays a
    computed ramp. This is why, on Workout C ("heavy" day), the big number can differ
    from the day's actual heaviest working set (`top + increment`, i.e. the day's
    attempt): that attempt value is still shown under its own set target and in the
    ramp meta caption, just not as the header number. Every caller — the idle Train
    row, `ExerciseCard` mid-workout, and the Program tab — funnels through one
    `updateMadcowTopSet()` in [madcow.js](../src/madcow.js), so the persisted
    `mcTop`, the mirrored `weights`, and (if that lift is mid-session) its remaining
    ramp never drift apart. A future program with its own stateful mutation logic
    should follow the same pattern: a dedicated `<program>.js`, not inline `App.jsx`
    handlers.

## 5. Interaction rules

- **Set tap cycle:** unlogged → target → target−1 → … → 1 → 0 → unlogged.
- **450ms long-press** on a set opens the rep-picker bottom sheet (0…target, plus
  "Clear set"). Must work with touch *and* mouse; suppress `contextmenu` on set buttons.
- A missed set shows the dashed border, the ✕ badge, and a note under the exercise:
  `↳ Missed reps — 62.5 kg holds next session`.
- The first exercise shows a teaching caption until the first set is logged:
  "Tap to log all 5 reps · hold a set to pick an exact count".
- Animation: only `transition: width 1s linear` on the timer progress line and short
  opacity/transform transitions. No confetti, no celebratory motion.

---

## 6. Do not

- Introduce a second hue. No emerald, rose, amber, indigo, blue, lilac/purple, or raw
  slate classes.
- Use `font-black`, or uppercase anything that isn't a kicker.
- Add a filled primary button, a drop shadow, or a radius outside the 8–14px scale.
- Encode state in colour alone — pair it with a shape (dashed border, hollow dot, badge).
- Hardcode a user-facing string. Every new label goes through `t()` with EN **and** FR keys.
- Change training logic while changing presentation. Progression, deload, the wall-clock
  timer, recovery, Drive sync, import/export and the localStorage schema are untouched by
  design work.

## 7. Light mode

**Light mode stays.** The toggle in Options is a shipped feature and was not removed.

Light is a derivation of the same structure as dark (invert ground/surface, keep the
single accent, keep every rule in §3–§5), not a from-scratch light redesign. The
mechanism is a single `:root[data-theme='light']` block in `src/index.css` that
overrides the **same** `--color-*` variable names declared in the `@theme` block —
there is no second `-lt`-suffixed token set, and no ternary className branching per
component. Every utility built on a token (`text-ink/45`, `bg-surface`,
`border-ink/18`, `text-accent-300`, `bg-accent-900`, …) re-themes automatically once
the variable is overridden. Stamped on `<html>` by `App.jsx`'s `isDark` effect.

```css
:root[data-theme='light'] {
  --color-ground:       #f7f4ef;
  --color-surface:      #ffffff;
  --color-surface-deep: #ece6dd;
  --color-surface-nav:  #ffffff;
  --color-ink:          #191612;
  --color-accent:       #b4552b;
  --color-accent-300:   #93401d;
  --color-accent-900:   #f9e9df;
  --color-neutral-tint: #ded7cc;
}
```

Unlike the prior palette, **`accent` itself is not the same hex in both themes** —
`#c8663a` dark, `#b4552b` light — since a single hex read too weak against white.
Anywhere a literal colour is unavoidable (Recharts props, `manifest.json`,
`index.html`'s `theme-color`), branch on `isDark` / declare both values rather than
reusing one constant across themes; see `StatsChart.jsx` for the pattern.

`.rule-fade` / `.rule-fade-top` also have a `:root[data-theme='light']` override, using
the light ink rgb triple (`25,22,18`) instead of the dark one (`236,233,226`).

## 8. Checking your work

```bash
# no stray hues (empty except ErrorBoundary.jsx, which predates and is outside the migration)
grep -roE "(bg|text|border|ring|from|to|fill|stroke)-(emerald|rose|amber|indigo|blue|slate|violet|purple)-[0-9]+" src

# no shouting type
grep -ro "font-black" src
grep -ro "uppercase" src   # kickers only

# font-mono paired with an unloaded weight (only 400/700 are imported — see Typography in §2)
grep -rno "font-mono[^\"'\`]*font-\(medium\|semibold\)\|font-\(medium\|semibold\)[^\"'\`]*font-mono" src

# one radius scale
grep -roE "rounded(-\[[^]]+\]|-[a-z0-9]+)?" src | sed 's/^[^:]*://' | sort | uniq -c

# no nav collapse machinery
grep -rn "navExpanded" src
```

Then run `npm test`.

# Strength 5×5 — UI/UX redesign implementation plan

Handoff plan for implementing the approved redesign (prototype: `Strength5x5 Redesign.dc.html`, option 1a) in the real codebase (React 18 + Tailwind v3 + Lucide, `src/`). **Change presentation only — do not touch training logic** (progression, deload, wall-clock timer, recovery, Drive sync, i18n, import/export all stay as-is).

## 1. Design tokens (Nocturne)

Add to `tailwind.config` (or CSS vars in `index.css`). Replace all slate/indigo/emerald/rose/amber usage with:

| Token | Value | Use |
|---|---|---|
| `bg` | `#161826` | app ground (dark mode) |
| `surface` | `#232532` | cards, sheets |
| `surface-deep` | `#1c1e2c` | timer strip, nav bar `#141624` |
| `text` | `#e9e9ed` | primary text; muted = same at 55/45/38% alpha |
| `accent` | `#9184d9` | THE only accent — lines, borders, icons, marks |
| `accent-300` | `#d2cefd` | accent-tinted text (weights, active labels) |
| `accent-800/900` | `#423a6a` / `#2b2741` | tinted fills (completed sets, active seg) |
| `neutral-800` | `#3f424d` | neutral tint (missed-set badge bg) |

Rules: **no other hues** (no emerald/rose/amber anywhere); font = Inter, max weight 600 (headings 500); one radius scale — 8–10px cards/buttons, set targets stay circles; borders `rgba(233,233,237,.08–.18)`; primary buttons are **1px accent outline on transparent**, never filled; section rules fade at ends: `linear-gradient(to right, transparent, rgba(233,233,237,.09) 48px, … calc(100%-48px), transparent) bottom / 100% 1px no-repeat`. Icons: swap Lucide → Phosphor (`@phosphor-icons/react`).

Type scale: page titles 22px/500; card titles 14–15px/600; body 12–13px; kickers 9.5–10px uppercase, letter-spacing .12–.14em, accent color, weight 600 — kickers are the ONLY uppercase text. Kill all other uppercase/font-black.

## 2. App shell (`App.jsx`)

- **Header** (idle only): barbell icon + "Strength 5×5" wordmark left; right: streak chip (`flame` icon + "8-week streak", from existing `getWorkoutStats`) + 28px `?` icon button → help sheet (see §8).
- **Header hides during an active workout on the Train tab** and is replaced by the timer strip (§4).
- **Tab bar never collapses.** Delete the hamburger/`navExpanded` drawer entirely. Five tabs (Train, Program, Log, Stats, Options), 21px icons, active = filled Phosphor variant + `accent-300`, inactive = 35% text. **Keep the behavior the user approved: tapping Train always routes correctly — to the live workout if one is active, else to the start screen.** No close/X state on the Train tab.
- **Live bar**: when a workout is active and the user is on another tab, show a 40px accent-outlined bar above the tab bar: play icon + "Resting · m:ss" (or "Workout in progress") + "Return ›". Tap → Train tab. Replaces the old indigo `liveWorkout` banner.
- Modals: restyle all existing dialogs to `surface` bg, 12px radius, outlined primary action, plain-text secondary. Plate calc, rep picker and help become **bottom sheets** (align-end overlay, `border-radius 14px 14px 0 0`).

## 3. Train — start screen

- Kicker "NEXT UP" + "Workout A" 30px/500 + small outlined swap icon-button (`arrows-clockwise`), subtitle listing the day's lifts.
- Exercise list: no cards — rows with fading bottom rules; left: name 14px/500 + "5 × 5" meta 11px; right: weight in `accent-300` tabular.
- Start button: full-width 48px **accent outline** with play icon; disabled state = 35% opacity + "Trained today" label. Footnote: "N of 3 workouts this week".

## 4. Train — active session + timer strip (`RestTimer.jsx` → top strip)

- **Timer strip replaces the header at the top** (not docked at the bottom): left = kicker state ("Rest" muted / "Lifting" accent / "Workout complete" accent) over 24px tabular time, with a **24px skip icon-button (`skip-forward` fill) bottom-aligned to the digits** right beside them; right = stacked "WORKOUT A" kicker over total elapsed 14px muted. 2px progress line under the strip, accent, fading-in from the left, `transition: width 1s linear`. Strip bg `surface-deep`. Keep all existing timer logic (wall-clock anchor, expire → stopwatch, sound/vibrate).
- Exercise cards (`ExerciseCard.jsx`): `surface` bg, 10px radius. Header: name 15px/600 with "Warm-up" (accent text-button w/ caret) and "Plates" (muted text-button) under it; right: − / + 28px outlined steppers around weight 17px `accent-300`. **Delete dashed ✕ placeholders for unused set slots** — render only `ex.sets` targets.
- **Set targets**: circles ~44–52px, 16px/600 number.
  - unlogged: 1px border `rgba(233,233,237,.18)`, 40% text, shows target reps
  - passed: 1px accent border, `accent-900` fill, `accent-300` text
  - missed (0 < reps < target, incl. 0): **1.5px dashed** `rgba(233,233,237,.5)` border, neutral tint fill, shows reps achieved, plus a 16px corner badge (neutral-800 circle, bold ✕ 8px)
  - **Tap cycle: null → target → target−1 → … → 1 → 0 → null** (change from current `1 → null`)
  - Keep 450ms long-press → rep picker, now a bottom sheet: title "Back Squat · Set 3", circles 0…target (target gets a stronger border), caption "5 = passed · fewer means the weight holds next session", "Clear set" + "Cancel".
- When any set of an exercise is missed, show under its targets: `↳ Missed reps — 62.5 kg holds next session`.
- First exercise, until the first set is logged: caption "Tap to log all 5 reps · hold a set to pick an exact count".
- Finish: full-width outline, accent when enabled / 12%-border + 30% text when not. Discard = tiny muted text-button → confirm dialog (primary = "Keep lifting" outline; "Yes, discard" = plain text).
- Completion summary modal: kicker "WORKOUT COMPLETE", per-lift rows "60 kg → 62.5 kg" with trend-up icon, or "stays at 60 kg" muted with arrow-right. No confetti/emerald.

## 5. Log

- Title row + 32px outlined `+` (manual entry — keep existing editor, restyled per §2).
- Adherence line: three 8px dots (accent fill = done, hollow = remaining) + "N to go this week · streak · total". Single muted color, no emerald/rose status text.
- Grouping: 4-option segmented control, Nocturne style (active = `accent-900` fill + inset accent ring, inactive transparent).
- Entry cards: `surface`, type in `accent-300` 12.5/600, meta right; per-lift rows with weight + per-set dots — passed = accent fill, missed = **hollow ring** (was rose).
- Group headers: caret + label + count chip; keep expand/collapse.

## 6. Stats

- Big-3 card: kicker "BIG-3 TOTAL" + 24px value + mono trend icon (`trend-up` accent / `trend-down` neutral-600 / `arrow-right` muted 40%) — **trend never colored red/green**.
- Exercise rows: name + "est. 1RM x kg" sub, trend icon + weight `accent-300` + caret.
- Chart (`StatsChart.jsx`, keep Recharts): weight line `#9184d9` 2px w/ dots; e1RM line `#d2cefd` at 55% alpha, **1.5px dashed** (replaces emerald); grid `rgba(233,233,237,.07)`; axis text 9px at 40%; range = segmented control; series toggles = outlined chips with color dot (accent / accent-300), at least one always on.

## 7. Program (`ProgramEditor.jsx`) — redesigned layout

Per-exercise card:
- Header: name 14/600 left, live summary right: "5 sets of 5 reps" (11.5px muted, pluralized).
- Row "Sets": 36px label → flex 5-segment bar (6px, filled = accent) → stepper `[− 40px] value 17px [+ 40px]`, both buttons − / + (no carets), outlined, accent hover, clamp 1–5.
- Row "Reps": same anatomy; visual = ten 6px dots filled to reps; clamp 1–10.
- Page header: "Program" + outlined "Reset" (counter-clockwise icon). Keep the active-workout warning note, restyled muted.

## 8. Options + Help

- Cards on `surface`: Rest interval (segmented 1:30/3:00/5:00), toggle rows (Sound, Vibration) with **custom 38×22 switch** — accent border + `accent-900` track + accent knob when on; neutral when off. Rows separated by fading rules.
- Backup & sync card: "Backup" (accent outline) + "Restore" (neutral outline) side by side; "Import from StrongLifts" full-width neutral outline below. Keep Drive section behavior; restyle status text muted/accent only.
- Language EN/FR segmented. **Dark/light toggle: keep the feature** — this spec defines dark; derive light from the same structure (invert ground/surface, keep single accent) in a follow-up pass.
- **Help sheet** (from header `?`): bottom sheet "How it works" — 7 rows, 30px accent-outlined icon tiles (barbell, trend-up, pause, trend-down, timer, moon, cloud) + title/body pairs for Program, Progression, Stall, Deload, Rest, Long breaks, Backups (copy in prototype), "Got it" outline button. Reuse existing `showHelp` state; delete old modal styling.
- Toasts: `accent-900` bg, accent border, `accent-300` text, centered above nav.

## 9. Acceptance checklist

- [ ] No emerald/rose/amber/blue classes remain; single accent `#9184d9`
- [ ] No `font-black`; uppercase only on kickers
- [ ] Tab bar visible at all times incl. mid-workout; Train tab returns to live workout; live bar on other tabs
- [ ] Timer strip at top mid-session; header everywhere else; skip icon aligned to digits
- [ ] Set cycle reaches 0 then clears; missed sets show dashed ring + ✕ badge + "holds next session" note
- [ ] Long-press rep picker works with touch + mouse; `contextmenu` suppressed on set buttons
- [ ] No dashed placeholder slots for unused sets
- [ ] Program tab: labeled Sets/Reps rows, 40px steppers, live bar/dot visuals
- [ ] All existing tests pass; add tests for new tap-cycle (→0→null) and nav-during-workout
- [ ] i18n: all new strings through `t()` with EN + FR keys

# App.jsx Refactor Plan

Execution plan for an AI coding agent. Read [AGENTS.md](../AGENTS.md) and
[docs/design-system.md](design-system.md) first — this plan does not restate their rules,
it works inside them.

## Authorisation

AGENTS.md previously said "do not refactor App.jsx into smaller state management without
being asked." **The repo owner has asked** (2026-08-03). Phase 0 amends that line. Until
Phase 0 lands, do not treat the old wording as a blocker.

## Baseline (measured 2026-08-03, commit `571bde3`)

| Metric | Value |
| --- | --- |
| `src/App.jsx` | 1,812 lines |
| `useState` calls in App.jsx | 44 |
| Inline dialogs in App.jsx | 13 |
| `isDark ? … : …` ternaries in App.jsx | 118 |
| `-lt` token references across `src/` | 227 |
| Distinct hardcoded `text-[NNpx]` values | 17 |
| Tests | 421 passing, 24 files |
| Class-name assertions in tests | ~12, of which 2 are theme-coupled |

Re-measure before starting. If these numbers have drifted a lot, the plan's line
references are stale — re-locate by symbol name, not by line number.

## Rules for the whole refactor

1. **Behaviour must not change.** Every phase is a pure move or a mechanical substitution.
   No bug fixes, no copy edits, no new features, no styling "improvements" along the way.
   If you spot a bug, write it down in the phase's PR description and leave it.
2. **`npm test` must pass at the end of every phase**, with the same 421 tests. If a test
   needs editing, that is a signal — stop and explain why before editing it. The only
   pre-approved test edits are the two theme assertions named in Phase 1.
3. **One phase per commit.** Each phase is independently revertible. Do not batch.
4. **Do not introduce Context, Redux, Zustand, or a router.** App.jsx stays the state
   owner; props stay explicit. This is what keeps components testable in isolation.
5. **Do not build generic `Button` / `Card` / `Text` wrappers.** Extract a component only
   when the same thing appears twice with the same meaning.
6. **Do not add dependencies.**
7. **Both themes, every phase.** A dark-only result is unfinished.

## Verification command

Run after every phase:

```bash
npm test && npm run build
```

Plus the phase's own checks.

---

# Phase 0 — Amend the docs

**Goal:** stop the next session from reverting this work.

**Steps**

1. In [AGENTS.md](../AGENTS.md):
   - Replace "App.jsx is the main state manager (~1400 lines). All top-level state lives
     here. This is intentional — do not refactor into Redux/Zustand/context unless asked."
     with a statement that App.jsx owns top-level state and delegates rendering to
     `src/screens/` and `src/components/modals/`, and that external state libraries and
     routers remain off the table.
   - Replace "Do not refactor App.jsx into smaller state management without being asked"
     under **Things to Avoid** with "Do not introduce Redux/Zustand/Context or a router".
   - Add `screens/` and `components/modals/` to the **File Structure** block.
2. In [.claude/skills/oxide-ui/SKILL.md](../.claude/skills/oxide-ui/SKILL.md):
   delete the paragraph beginning "**The codebase has not been migrated yet.**" It is
   false — the migration landed (issue #18) and `grep` finds zero stray hues. It is
   actively misleading agents into thinking they must avoid a palette that is already gone.
3. Link this plan from [docs/architecture.md](architecture.md).

**Done when:** no doc in the repo tells an agent that this refactor is forbidden or that
the design migration is pending.

---

# Phase 1 — Theme tokens (delete the `isDark` className ternary)

**This is the highest-leverage phase. Do it before any file splitting.** Splitting first
means extracting 227 `-lt` references into new files and then editing all of them again.

**Goal:** `text-ink/45` resolves correctly in both themes. The `-lt` token set is deleted.
`isDark` survives only where a *JavaScript* colour value is genuinely needed.

## 1a. Spike first — do not skip

Tailwind v4's `@theme` emits custom properties into `:root`; utilities reference them via
`var()`, so overriding the variable in a later selector re-themes the utility. **`@theme inline`
inlines the literal value and breaks this.** Verify before migrating 227 call sites.

In [src/index.css](../src/index.css), keep dark as the base (matches the existing
`var(--app-page-bg, #161826)` fallback and avoids a light flash before React mounts):

```css
@theme {
  --color-ground: #161826;
  --color-ink:    #e9e9ed;
  /* … existing dark values, unchanged … */
}

:root[data-theme='light'] {
  --color-ground: #f5f5f8;
  --color-ink:    #1b1c28;
  /* … */
}
```

Stamp one element with `data-theme="light"`, confirm a `text-ink/45` child renders dark
ink at 45% alpha. **If the override does not take effect, stop and report** — the rest of
this phase depends on it and there is no cheap fallback.

## 1b. Migrate

1. Move each `-lt` value into the `:root[data-theme='light']` block under its base name.
   Mapping: `ground-lt`→`ground`, `surface-lt`→`surface`, `surface-deep-lt`→`surface-deep`,
   `surface-nav-lt`→`surface-nav`, `ink-lt`→`ink`. Keep `accent-ink-lt` and
   `accent-tint-lt` for now — they have no dark counterpart, so they are a separate
   decision (see Phase 1 open question).
2. In [App.jsx:172-174](../src/App.jsx#L172-L174), change the effect to stamp
   `document.documentElement.dataset.theme = isDark ? 'dark' : 'light'` alongside the
   existing `--app-page-bg` write. Keep `--app-page-bg` — it paints `html`/`body` before
   React mounts.
3. Mechanically collapse the ternaries across `src/`. Every instance of
   `` `${isDark ? 'X' : 'X-lt'}` `` becomes `X`. Work file by file:
   `App.jsx` (118), `ProgramTab.jsx` (23), `StatsChart.jsx` (13), `ExerciseCard.jsx` (8),
   `RepPicker.jsx` (6), `ProgramEditor.jsx` (5), `RestTimer.jsx` (5),
   `ExerciseGuideSheet.jsx` (3), `WeightInput.jsx` (2), `BarSetupDiagram.jsx` (1),
   `StepperButton.jsx` (1).
4. Drop the now-unused `isDark` prop from every component whose only use was className
   ternaries: `BarSetupDiagram`, `StepperButton`, `WeightInput`, `RepPicker`,
   `ExerciseGuideSheet`, `ProgramEditor`, `RestTimer`, `ExerciseCard`, `ProgramTab`
   (and its internal `Kicker` / `Chip` / `Segmented`). Update their tests' render calls.
5. **`StatsChart` is the exception.** [StatsChart.jsx:68,135,136,150,162](../src/components/StatsChart.jsx#L68)
   pass literal colour strings into Recharts inline styles — CSS variables cannot serve
   those. Add `src/hooks/useTheme.js` exposing `{ isDark }` read from the
   `data-theme` attribute, and have StatsChart consume it instead of taking the prop.
   Keep its `mutedClass` on line 67 as a plain `text-ink/45` string.
6. Update the two theme assertions at
   [ui-behavior.test.jsx:166](../src/__tests__/integration/ui-behavior.test.jsx#L166)
   and [:176](../src/__tests__/integration/ui-behavior.test.jsx#L176) — they assert
   `bg-ground` / `bg-ground-lt` on the root. Assert on `documentElement`'s `data-theme`
   instead, which is now the actual mechanism.

**Verify**

```bash
grep -rn -- "-lt" src --include='*.jsx' --include='*.css'   # only accent-ink-lt / accent-tint-lt
grep -rn "isDark" src --include='*.jsx'                     # only App.jsx state + useTheme + StatsChart
npm test && npm run build
```

Then manually check both themes — toggle dark mode in Options and walk all five tabs.
(Per repo convention the owner does UI verification; hand back with a note on what to look at.)

**Done when:** ~150 ternaries gone, `-lt` gone from JSX, both themes render correctly,
421 tests pass.

**Open question for the owner — do not decide alone:** `--color-accent-ink-lt` and
`--color-accent-tint-lt` exist only for light mode. Either give them dark-mode values and
fold them into the base set, or leave them as light-only tokens with a comment. Ask.

---

# Phase 2 — Type and radius tokens

**Goal:** make [docs/design-system.md](design-system.md)'s scale enforceable by `grep`
rather than by memory.

**Steps**

1. Add to `@theme` in [src/index.css](../src/index.css), named for the **role** in
   design-system.md §2, not the pixel value:

   | Token | Value | Role |
   | --- | --- | --- |
   | `--text-kicker` | 10.5px | kicker (uppercase, .14em, accent) |
   | `--text-tab` | 11px | tab label |
   | `--text-meta` | 12px | meta / caption |
   | `--text-body` | 13.5px | body |
   | `--text-card` | 15px | card title, body-large |
   | `--text-title` | 24px | page title |
   | `--text-hero` | 32px | Train workout name |

   And radii: `--radius-control: 10px`, `--radius-modal: 12px`, `--radius-sheet: 14px`.

2. Migrate only the **unambiguous** sizes: `text-[10.5px]`→`text-kicker`,
   `text-[11px]`→`text-tab`, `text-[12px]`→`text-meta`, `text-[13.5px]`→`text-body`,
   `text-[15px]`→`text-card`, `text-[24px]`→`text-title`, `text-[32px]`→`text-hero`.
   That covers 166 of the 242 occurrences.

3. **Do not silently snap the outliers.** `12.5px` (15×), `13px` (15×), `14px` (13×),
   `14.5px` (14×), `15.5px` (2×), `16px` (9×), `17px` (3×), `19px` (3×), `20px` (1×),
   `30px` (1×) sit between the documented roles. Snapping them changes the visual design,
   which is not this refactor's job. Leave them hardcoded, list them in the PR, and ask
   the owner whether to extend the scale or absorb them.

4. Radii need care — the documented rule is a **band** ("8–10px for cards, buttons and
   controls"), and three values currently sit inside it: `rounded-lg` (8px, 62×),
   `rounded-[9px]` (4×), `rounded-[10px]` (17×). All three are compliant. Collapsing them
   to one token is a real, if small, visual change.
   - Safe now: `rounded-xl` on modals → `rounded-modal`, and the bottom-sheet
     `rounded-t-[14px]` → `rounded-t-sheet`. These map 1:1 to documented single values.
   - Ask first: whether `rounded-control` should be 8, 9 or 10px, and therefore which of
     the three existing values move.
   - Leave alone: `rounded-[6px]` and `rounded-[3px]` in
     [BarSetupDiagram.jsx:25,32](../src/components/BarSetupDiagram.jsx#L25) are plate and
     bar-sliver geometry in a diagram, not control chrome — correctly outside the scale.
     `rounded-[7px]` at [RestTimer.jsx:52](../src/components/RestTimer.jsx#L52) is the one
     genuine 1px miss; fold it in with whatever `rounded-control` becomes.

**Verify**

```bash
grep -rhoE 'text-\[[0-9.]+px\]' src --include='*.jsx' | sort | uniq -c   # only the flagged outliers
npm test && npm run build
```

**Done when:** the documented type roles exist as utilities, the seven canonical sizes are
migrated, and every remaining hardcoded size is a listed, owner-visible exception.

---

# Phase 3 — Lift pure logic out of the component

**Goal:** make the logic unit-testable without rendering App. Highest test yield per line
moved, and zero JSX risk.

**Steps**

1. `src/audio/chime.js` — move `playChime` from
   [App.jsx:95-143](../src/App.jsx#L95-L143). It is 50 lines of Web Audio with no React in
   it. Export `createChime()` returning `{ play, resume }` so the `audioCtxRef` /
   `reverbRef` caching stays encapsulated; App holds one ref to the instance.
   [App.jsx:720](../src/App.jsx#L720) resumes a suspended context on timer skip — that
   becomes `chime.resume()`.
2. `src/progression.js` — move `evaluateWorkoutOutcome`
   ([285-309](../src/App.jsx#L285-L309)), `getPendingFailureDeloadsForStart`
   ([311-338](../src/App.jsx#L311-L338)) and `getStartDeloadPrompt`
   ([340-361](../src/App.jsx#L340-L361)). All three are pure functions of their arguments.
   `getStartDeloadPrompt` closes over `longBreakDeloadForDate` and `preset` — pass both as
   explicit parameters. This sits alongside [src/madcow.js](../src/madcow.js), matching the
   precedent AGENTS.md already sets for per-program logic.
3. `src/backup.js` — `applyLocalImport` ([478-509](../src/App.jsx#L478-L509)) and
   `applyDriveRestore` ([603-621](../src/App.jsx#L603-L621)) contain an **identical**
   15-line state-hydration sequence. Extract `hydrateFromBackup(data, setters)` and have
   both call it. Note the one real difference: `applyLocalImport` also calls
   `saveToDriveQuietly` and clears `pendingLocalImport`; keep that at the call site.
   Also move the two `FileReader` bodies from `handleImport`
   ([511-556](../src/App.jsx#L511-L556)) and `handleStrongliftsImport`
   ([558-583](../src/App.jsx#L558-L583)) into `readBackupFile(file)` /
   `readStrongliftsFile(file)` returning promises; App keeps the `onChange` wiring and the
   toast calls.
4. **Add unit tests** for each extracted module under `src/__tests__/`. This is the payoff
   — `evaluateWorkoutOutcome` and the deload prompt logic are currently only reachable
   through a full App render. These are new tests, not edits to existing ones.

**Verify**

```bash
npm test && npm run build
grep -c "useState" src/App.jsx   # still 44 — this phase moves no state
```

**Done when:** App.jsx is ~200 lines shorter, four new modules have direct unit tests, and
the 421 existing tests still pass unchanged.

---

# Phase 4 — Modal shell + `src/components/modals/`

**Goal:** stop copy-pasting the dialog shell 13 times.

**Steps**

1. Build two shells in `src/components/modals/`:
   - `Modal.jsx` — centred. Owns `role="dialog"`, `aria-modal="true"`, the `aria-label`
     prop, the backdrop (`fixed inset-0 … backdrop-blur-sm bg-[rgba(15,16,25,.75)]`), and
     the `rounded-modal` card.
   - `Sheet.jsx` — bottom sheet. Same, but `items-end`, `rounded-t-sheet`, and
     backdrop-click-to-close (`onClick` + inner `stopPropagation`), matching the existing
     `showHelp` and `workoutPicker` behaviour.
2. **Centralise the z-index ladder** in one exported constant. It is currently spread
   across `z-[250]` … `z-[500]` with four dialogs all sharing 500. Preserve the existing
   relative order exactly; do not renumber to "tidy" it.
3. Extract each dialog, in this order (smallest and least entangled first):

   | # | State flag | Lines | New component |
   | --- | --- | --- | --- |
   | 1 | `pendingDriveRestore` | [1739-1748](../src/App.jsx#L1739-L1748) | `StaleBackupModal` |
   | 2 | `pendingLocalImport` | [1750-1759](../src/App.jsx#L1750-L1759) | **same** `StaleBackupModal` |
   | 3 | `showCancelModal` | [1246-1255](../src/App.jsx#L1246-L1255) | `DiscardWorkoutModal` |
   | 4 | `pendingCSVImport` | [1400-1417](../src/App.jsx#L1400-L1417) | `CSVImportModal` |
   | 5 | `showRestorePrompt` | [1294-1309](../src/App.jsx#L1294-L1309) | `RestoreBackupModal` |
   | 6 | `showHelp` | [1703-1733](../src/App.jsx#L1703-L1733) | `HelpSheet` |
   | 7 | `showResumePrompt` | [1311-1346](../src/App.jsx#L1311-L1346) | `ResumeWorkoutModal` |
   | 8 | `pendingFailureDeloads` | [1664-1701](../src/App.jsx#L1664-L1701) | `FailureDeloadModal` |
   | 9 | `deloadAlert` | [1257-1292](../src/App.jsx#L1257-L1292) | `LongBreakDeloadModal` |
   | 10 | `connectSyncPrompt` | [1761-1803](../src/App.jsx#L1761-L1803) | `SyncConflictModal` |
   | 11 | `workoutPicker` | [1358-1398](../src/App.jsx#L1358-L1398) | `WorkoutPickerSheet` |
   | 12 | `completionSummary` | [1604-1662](../src/App.jsx#L1604-L1662) | `CompletionSummaryModal` |
   | 13 | `editingEntry` | [1419-1602](../src/App.jsx#L1419-L1602) | `EditEntryModal` |

   Rows 1 and 2 are the same markup with different data — **one component, two usages.**
   Row 13 is 184 lines and holds the most logic (date conflict, progression-on-save,
   delete confirm); do it last, when the pattern is established.

4. Each dialog takes data + callbacks as props. State stays in App. `showDeleteConfirm`
   is used only by `EditEntryModal` — move that one `useState` inside it.

**Verify**

```bash
grep -c 'role="dialog"' src/App.jsx   # 0
npm test && npm run build
```

**Done when:** App.jsx has no inline dialog markup, ~550 lines lighter, and each modal has
a props-only render path that a component test can drive directly.

**Follow-up worth proposing, not doing here:** with one shell, focus trapping and
Escape-to-close become a single change instead of thirteen. Neither exists today. Raise it
as a separate issue — it is a behaviour change and out of scope.

---

# Phase 5 — Screens

**Goal:** one file per tab. [ProgramTab.jsx](../src/components/ProgramTab.jsx) already
proves the shape: props in, callbacks out, no context.

**Steps**

1. Create `src/screens/` and move, in this order:

   | Tab | Lines | New file | Notes |
   | --- | --- | --- | --- |
   | `progress` | [988-1060](../src/App.jsx#L988-L1060) | `StatsScreen.jsx` | smallest, cleanest |
   | `settings` | [1075-1202](../src/App.jsx#L1075-L1202) | `SettingsScreen.jsx` | pull `Switch` + `Segmented` out first — see step 2 |
   | `history` | [892-986](../src/App.jsx#L892-L986) | `LogScreen.jsx` | `renderEntry` becomes a local sub-component |
   | `workout` | [773-890](../src/App.jsx#L773-L890) | `TrainScreen.jsx` | most props; do last |

   Move `ProgramTab.jsx` → `screens/ProgramScreen.jsx` for consistency. Update its test's
   import path.

2. **Resolve the `Segmented` fork.** Two implementations exist and have drifted:
   [App.jsx:1090](../src/App.jsx#L1090) renders `text-[12px] uppercase tracking-wide`,
   [ProgramTab.jsx:25](../src/components/ProgramTab.jsx#L25) renders `text-[13px] font-medium`.
   They are otherwise identical. **These look different on screen — picking one is a visual
   change.** Extract `src/components/Segmented.jsx` supporting both via a `variant` prop,
   preserving each call site's current appearance exactly, and ask the owner which should
   win. Do the same for `Switch` ([App.jsx:1079](../src/App.jsx#L1079)), which has only one
   implementation and can move as-is.

3. Keep the log-grouping `Segmented` at [App.jsx:948-954](../src/App.jsx#L948-L954) in
   mind — it is a third inline copy of the same control, with its own `onClick` side
   effect on `expandedGroups`. Fold it into the shared component with the side effect
   staying at the call site.

**Verify**

```bash
wc -l src/App.jsx        # target: under 500
npm test && npm run build
```

**Done when:** App.jsx's `<main>` is five `{activeTab === … && <Screen … />}` lines, and
each screen renders from props alone.

---

# Phase 6 — Group the state

**Goal:** 44 `useState` calls → ~10 declarations, without a state library.

**Steps**

1. `src/state/useMadcowState.js` — the seven `mc*` values
   ([App.jsx:46-51](../src/App.jsx#L46-L51) plus `mcPending`) move into one hook returning
   `{ mcTop, mcWeek, mcInterval, mcPress, mcNextDay, mcPending, setters…, hydrate(saved) }`.
   They are already normalised together, persisted together, hydrated together in three
   places, and reset together in `switchProgram`. This is the most cohesive group.
2. `src/state/useSettings.js` — `isDark`, `localBackup`, `preferredRest`, `soundEnabled`,
   `vibrationEnabled`, `logGrouping`. All are `saved.*`-seeded preferences with identical
   lifecycles.
3. Leave `weights`, `program`, `history`, `currentWorkoutType`, `preset`,
   `currentWorkout`, `isWorkoutActive` in App — they are the core domain state and are
   read by nearly every handler. Splitting them buys nothing.
4. Leave the ~20 ephemeral UI flags (`showHelp`, `statsView`, `repPicker`, …) as plain
   `useState`. Several will already have moved into their modal in Phase 4.

**These are still `useState` calls, just relocated.** No reducer, no context, no store.
The hooks return plain objects and App passes the pieces down as props exactly as before.

**Verify**

```bash
grep -c "useState" src/App.jsx   # target: ~10
npm test && npm run build
```

**Done when:** App.jsx reads as a state manifest plus routing, and the Madcow state group
can be tested through `renderHook` without booting the app.

---

# Sequencing and stop conditions

Phases are ordered by leverage-per-risk. **Phases 1 and 2 must precede 4 and 5** — token
migration touches every line of JSX, so doing it after extraction means editing the same
markup twice.

Phase 3 is independent and can run any time after Phase 0.

**Stop and ask the owner if:**

- The Phase 1a spike shows `@theme` overrides do not work.
- Any phase needs an existing test edited beyond the two named theme assertions.
- A "pure move" turns out to need a behaviour change to work.
- You hit an open question flagged above (accent-lt tokens, type-scale outliers,
  off-scale radii, the `Segmented` fork).

**Expected end state:** `src/App.jsx` under 500 lines — state ownership, handler wiring,
tab routing, and the modal manifest. All 421 tests still passing, plus new unit tests for
the Phase 3 modules.

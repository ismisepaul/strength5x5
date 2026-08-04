# AGENTS.md

Instructions for AI coding agents working on this repository.

## Project Overview

Strength 5x5 is a client-side React web app for tracking 5x5 barbell strength training. There is **no backend** — all data lives in localStorage with optional Google Drive backup. It runs as a PWA with full offline support.

**Core philosophy:** privacy-first, no accounts, no subscriptions, user owns their data.

## Tech Stack

- **React 18** with functional components and hooks
- **Vite 8** for build and dev server
- **Tailwind CSS v4** (utility-first, CSS-based config via `@import 'tailwindcss'`)
- **Vitest** + React Testing Library for tests
- **react-i18next** for i18n (English and French)
- **Recharts** for progress charts
- **Phosphor Icons** (`@phosphor-icons/react`) — see Design System below
- **vite-plugin-pwa** for offline/PWA support

## Commands

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start Vite dev server        |
| `npm run build`   | Production build             |
| `npm run preview` | Preview production build     |
| `npm test`        | Run tests once               |
| `npm run test:watch` | Run tests in watch mode   |

## Architecture

- **No backend.** All logic is client-side. Do not introduce server dependencies.
- **Single-page app** with no router — navigation is state-driven with modals/views.
- **App.jsx owns top-level state** and delegates rendering to `src/screens/` (one file per tab) and `src/components/modals/` (one file per dialog/sheet). State stays in App and flows down as explicit props — screens and modals take data and callbacks, they do not read from a store. External state libraries (Redux/Zustand) and a router remain off the table; see [docs/refactor-plan.md](docs/refactor-plan.md) for the decomposition in progress.
- **localStorage** is the persistence layer. Data is stored under `strength5x5_data` with schema versioning (currently v2). Active workouts are stored separately under `strength5x5_active_workout`.
- **Google Drive sync is optional** — the app must work perfectly without it.

## File Structure

```
src/
├── App.jsx              # Main app shell and all top-level state
├── main.jsx             # Entry point (StrictMode + ErrorBoundary)
├── constants.js         # Workout definitions, initial weights, storage keys
├── utils.js             # Pure utilities (plates, 1RM, deload, validation)
├── index.css            # Tailwind imports + custom keyframes
├── screens/              # One file per tab (Train, Log, Stats, Program, Options)
├── components/          # Reusable UI components (PascalCase.jsx)
│   └── modals/           # Dialogs and bottom sheets (Modal/Sheet shells + one file each)
├── hooks/               # Custom hooks (useCamelCase.js)
├── utils/               # Additional utility modules (camelCase.js)
├── i18n/                # i18next config and locale JSON files
├── test/                # Test setup and fixtures
└── __tests__/           # Tests mirroring src/ structure
```

## Naming Conventions

- **Components:** PascalCase files with `.jsx` extension (e.g., `ExerciseCard.jsx`)
- **Hooks:** camelCase prefixed with `use`, `.js` extension (e.g., `useTimer.js`)
- **Utilities:** camelCase functions, `.js` extension
- **Constants:** UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`, `INITIAL_WEIGHTS`)
- **Test files:** `*.test.jsx` or `*.test.js`, placed in `__tests__/` mirroring src structure

## Code Style

- Functional components with hooks (only exception: `ErrorBoundary` uses a class)
- Tailwind utility classes inline — no CSS modules or styled-components
- Dark mode via `isDark` state prop, applied with ternary classNames
- All user-facing strings must use i18n translation keys via `t('key')`
- No `.eslintrc` or `.prettierrc` — follow existing code style

## Design System (Oxide)

**Read [docs/design-system.md](docs/design-system.md) before any UI change.** It is the
authority on colour, type, radii, components, navigation and interaction. Summary of the
rules you cannot break:

- **One accent — `#c8663a` dark / `#b4552b` light.** No emerald, rose, amber, indigo, blue,
  purple/lilac or raw slate. Status is never carried by hue alone; pair it with a shape
  (dashed border, hollow dot, badge).
- **Inter, weight ≤ 600.** No `font-black`. Uppercase only on kickers.
- **One radius scale:** 8–10px cards/buttons, 12px modals, `14px 14px 0 0` bottom sheets.
  Set targets are rounded rectangles; adherence dots are the only circles.
- **Primary buttons are a 1px accent outline on transparent** — never filled, never a
  drop shadow.
- **Surfaces:** ground/surface/deep/nav tokens in `src/index.css`, 1px `ink/8–18` borders.
  Muted text is the ink token at reduced alpha, never a separate grey.
- **Tab bar never collapses**, including mid-workout; Train always routes to a live
  workout when one is active.
- **Nothing dead on screen** (no placeholder slots for unprogrammed sets) and **gestures
  are taught** (long-press and tap cycles need a caption or a help entry).
- **Both themes.** Light mode is a shipped feature — a dark-only change is unfinished.

Tokens are declared in the `@theme` block of `src/index.css` (Tailwind v4 — there is no
`tailwind.config.js`) and become utilities automatically. Light mode overrides the same
variable names inside `:root[data-theme='light']`.

The Oxide migration has landed. `docs/design/oxide-implementation-plan.md` and the
prototype in `docs/design/oxide-prototype.dc.html` are kept for history; the current
rules live in `docs/design-system.md`, including the light palette (§7).
`ErrorBoundary.jsx`'s crash screen was out of scope and still uses the pre-Oxide palette.

## Testing

- **Framework:** Vitest with jsdom environment, globals enabled
- **Setup:** `src/test/setup.js` mocks localStorage, matchMedia, and loads i18n
- **Patterns:** Use `@testing-library/react` with `userEvent.setup()` for interactions
- **Structure:** Unit tests for utils, component tests for UI, integration tests for workflows
- Run `npm test` before submitting changes

```js
// Example test pattern
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Component', () => {
  it('does the thing', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByText('Button'));
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
```

## Key Domain Logic

- **Workouts alternate** between A (squat/bench/row) and B (squat/press/deadlift)
- **Program is customizable** per exercise (1-5 sets, 1-10 reps) via the Program tab; defaults are 5x5, deadlift defaults to 1x5. Stored under `program` in `strength5x5_data`; each history entry snapshots the `sets`/`reps` it was performed against, so editing the program never rewrites past workouts
- **Progression:** +2.5kg per exercise on success (all sets hit the configured rep target), +5kg for deadlift
- **Weight editing is one component everywhere:** Train (idle and active), the Program tab's Madcow top sets, and the Log's add/edit-entry modal all use `WeightInput` — always-visible − / + steppers plus an always-typeable number, no pencil and no separate commit/cancel step. Typed values snap to that lift's own increment (not a hardcoded 2.5kg) via `roundWeight`; each field's draft is local, so editing one doesn't discard another's. The idle screen writes to `weights` directly
- **Madcow's field always edits the top set (`mcTop[id]`), never a flat weight** — true on both Train (idle and mid-workout) and the Program tab, since Madcow displays a computed ramp rather than one number. Every path funnels through App.jsx's `updateMcTop`, which updates `mcTop` and — if that lift is mid-session — re-derives the active workout's remaining ramp via `reviseWorkoutTopSet` (`src/madcow.js`), so nothing drifts out of sync regardless of where the edit happened. `mcTop` and `weights` (Standard's working weights) are separate state, merged only at a program switch (`switchProgramState` in `src/programSwitch.js`) -- never mirrored on every edit, which is what used to let a switch overwrite one with the other. A future program with its own stateful mutation logic should get its own `<program>.js` the same way, rather than living inline in `App.jsx`
- **Auto-deload:** After 3 consecutive failures at the same weight (with 20kg floor)
- **Long-break deload:** Suggests 10/25/50% reduction based on days off (14+ days)
- **Plate breakdown:** Greedy algorithm from 25kg down to 1.25kg plates (`calculatePlates`), rendered as a bar-load diagram in `ExerciseCard`'s "Bar setup" accordion — there is no standalone plate-calculator modal
- **1RM estimate:** Brzycki formula — `weight * (1 + reps / 30)`

## Things to Avoid

- Do not add a backend or external database
- Do not add authentication (Google Drive OAuth is the only auth, and it's optional)
- Do not introduce Redux, Zustand, Context, or a router — App.jsx stays the state owner with explicit props down to screens and modals (see [docs/refactor-plan.md](docs/refactor-plan.md))
- Do not add dependencies without good reason — keep the bundle light
- Do not break offline functionality — the app must work without network
- Do not store sensitive data; this is a client-side app with no secrets
- Do not introduce a second accent colour, `font-black`, filled primary buttons, or a
  radius outside the Oxide scale (see Design System above)
- Do not change training logic while changing presentation — a redesign task touches
  how things look, never how progression, deload, timing or sync behave

## Automated Review

GitHub Copilot's PR reviewer reads [.github/copilot-instructions.md](.github/copilot-instructions.md)
for repo-specific review guidance (e.g. not flagging missing guards for standard browser
APIs, since this app has no non-browser runtime target). Keep that file in sync with this
one where they overlap.

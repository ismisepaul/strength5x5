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
- **App.jsx is the main state manager** (~1400 lines). All top-level state lives here. This is intentional — do not refactor into Redux/Zustand/context unless asked.
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
├── components/          # Reusable UI components (PascalCase.jsx)
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

## Design System (Nocturne)

**Read [docs/design-system.md](docs/design-system.md) before any UI change.** It is the
authority on colour, type, radii, components, navigation and interaction. Summary of the
rules you cannot break:

- **One accent — `#9184d9`.** No emerald, rose, amber, indigo, blue or raw slate. Status
  is never carried by hue alone; pair it with a shape (dashed ring, hollow dot, badge).
- **Inter, weight ≤ 600.** No `font-black`. Uppercase only on kickers.
- **One radius scale:** 8–10px cards/buttons, 12px modals, `14px 14px 0 0` bottom sheets.
  Set targets and adherence dots are the only circles.
- **Primary buttons are a 1px accent outline on transparent** — never filled, never a
  drop shadow.
- **Surfaces:** ground `#161826`, cards `#232532`, 1px `ink/8–18` borders. Muted text is
  the ink token at reduced alpha, never a separate grey.
- **Tab bar never collapses**, including mid-workout; Train always routes to a live
  workout when one is active.
- **Nothing dead on screen** (no placeholder slots for unprogrammed sets) and **gestures
  are taught** (long-press and tap cycles need a caption or a help entry).
- **Both themes.** Light mode is a shipped feature — a dark-only change is unfinished.

Tokens are declared in the `@theme` block of `src/index.css` (Tailwind v4 — there is no
`tailwind.config.js`) and become utilities automatically.

The Nocturne migration has landed (issue #18). `docs/design/nocturne-implementation-plan.md`
and the prototype in `docs/design/nocturne-prototype.dc.html` are kept for history; the
current rules live in `docs/design-system.md`, including the interim light palette (§7).
`ErrorBoundary.jsx`'s crash screen was out of scope and still uses the pre-Nocturne palette.

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
- **Auto-deload:** After 3 consecutive failures at the same weight (with 20kg floor)
- **Long-break deload:** Suggests 10/25/50% reduction based on days off (14+ days)
- **Plate calculator:** Greedy algorithm from 25kg down to 1.25kg plates
- **1RM estimate:** Brzycki formula — `weight * (1 + reps / 30)`

## Things to Avoid

- Do not add a backend or external database
- Do not add authentication (Google Drive OAuth is the only auth, and it's optional)
- Do not refactor App.jsx into smaller state management without being asked
- Do not add dependencies without good reason — keep the bundle light
- Do not break offline functionality — the app must work without network
- Do not store sensitive data; this is a client-side app with no secrets
- Do not introduce a second accent colour, `font-black`, filled primary buttons, or a
  radius outside the Nocturne scale (see Design System above)
- Do not change training logic while changing presentation — a redesign task touches
  how things look, never how progression, deload, timing or sync behave

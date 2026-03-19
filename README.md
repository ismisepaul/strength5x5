# Strength 5x5

[![CI](https://github.com/ismisepaul/strength5x5/actions/workflows/ci.yml/badge.svg)](https://github.com/ismisepaul/strength5x5/actions/workflows/ci.yml)

A lightweight, open-source mobile web app for tracking 5x5 strength training. 

Features automatic weight progression, smart deload logic, rest timers, progress charts, and full workout history — all running client-side with no backend. 

Data lives in your browser and optionally backs up to your own Google Drive. Works offline as a PWA. Built with React, Vite, and Tailwind CSS.

---

## Features

### Guided 5x5 Training
- Alternating **Workout A / Workout B**
- Automatic weight progression (+2.5kg per exercise, +5kg for deadlift)
- Adjustable weights before and during workouts
- Set completion tracking optimized for mobile use

### Smart Rest Timer
- Wall-clock anchored countdown (no drift over long rests)
- Configurable rest intervals (1:30 / 3:00 / 5:00)
- Elapsed stopwatch after rest expires (tracks lifting time)
- Optional **sound alert** and **device vibration**
- Exercise/workout completion indicators

### Progress Tracking
- Interactive **stats charts** with weight and estimated 1RM trend lines
- Per-exercise and Big-3 total views
- Range filtering (1M / 3M / 6M / 1Y / All)
- Trend indicators (up / down / flat) on the stats overview

### Workout Log
- Complete workout history with duration tracking
- **Grouping** by week, month, or year with collapsible sections
- Weekly adherence stats (workouts this week, streak count)
- **Manual log entry** -- add past workouts with date, type, weights, and sets
- **Edit and delete** existing log entries
- Date conflict and future-date validation

### Smart Training Logic
- Automatic progression when all 5x5 sets are completed
- **Deload recommendations** after 14+ days off (with option to skip)
- **Auto-deload** after 3 consecutive failures at the same weight (10% reduction, 20kg floor)
- Plate calculator for easy bar loading
- Warm-up guidance (empty bar + working prep set)

### Workout Recovery
- Active workout state persisted to localStorage
- Resume prompt on reload if a workout was in progress
- Automatic expiry of stale workouts (24h)

### Data Ownership
- Data stored locally as **JSON** with schema versioning
- Manual backup and restore via JSON file
- **Local backup** option (JSON download after each workout)
- **Google Drive backup** -- optional cloud save/restore to your own Google Drive
- **StrongLifts 5x5 CSV import** with preview and confirmation
- Import validation (5MB size limit, schema checks, key whitelisting)

### Internationalization
- English and French translations via react-i18next
- Automatic browser language detection with localStorage persistence
- Language selector in the Options tab

### UI / UX
- Dark mode and light mode with toggle
- Completion summary modal after each workout
- Toast notifications for import/export/edit actions
- Error boundary with recovery button
- Collapsible nav bar during active workouts

---

## Tech Stack

**Frontend**
- React 18
- Tailwind CSS v3
- Lucide Icons
- Recharts (stats charts)
- react-i18next / i18next (internationalization)
- Vite (build tool)

**Testing**
- Vitest (test runner)
- React Testing Library
- @testing-library/user-event

**Cloud (optional)**
- Google Identity Services (OAuth 2.0 implicit flow)
- Google Drive API v3 (backup/restore via `fetch()`)

**Storage**
- localStorage (with schema versioning and migration support)
- Google Drive (optional cloud backup)

**Hosting**
- Vercel (with security headers via `vercel.json`)

No traditional backend or database required.

---

## Project Structure

```
src/
  App.jsx                  # App shell -- state, routing, modals
  main.jsx                 # Entry point (StrictMode + ErrorBoundary)
  constants.js             # Workouts, initial weights, storage keys
  utils.js                 # Pure functions (plates, 1RM, deload, validation)
  index.css                # Tailwind base imports
  components/
    ExerciseCard.jsx       # Single exercise during a workout
    RestTimer.jsx          # Rest countdown / lifting stopwatch
    StatsChart.jsx         # Recharts-powered progress charts
    ErrorBoundary.jsx      # React error boundary
    Toast.jsx              # Toast notification display
  hooks/
    useLocalStorage.js     # Load, sync, and cross-tab storage hooks
    useTimer.js            # Wall-clock anchored timer hook
    useToast.js            # Toast state management
    useGoogleDrive.js      # Google Drive backup/restore (optional)
  utils/
    chartData.js           # Timeline builders, trends, workout stats
    convertStronglifts.js  # StrongLifts CSV parser
  i18n/
    index.js               # i18next configuration
    locales/
      en.json              # English translations
      fr.json              # French translations
  __tests__/               # Mirrors source structure
    utils.test.js
    components/
    hooks/
    integration/
    utils/
  test/
    setup.js               # Vitest setup (i18n, localStorage mock)
    fixtures/
```

---

## Data Model

All user data is stored in a single JSON document under `strength5x5_data`:

```json
{
  "version": 1,
  "weights": {
    "squat": 60,
    "bench": 45,
    "row": 50,
    "press": 32.5,
    "deadlift": 80
  },
  "history": [],
  "nextType": "A",
  "isDark": true,
  "autoSave": true,
  "preferredRest": 90,
  "soundEnabled": false,
  "vibrationEnabled": false,
  "logGrouping": "all"
}
```

Active workouts are stored separately under `strength5x5_active_workout` for crash recovery.

Backups are portable JSON files that can be inspected, edited, or restored at any time.

---

## Development

Clone the repository:

```bash
git clone https://github.com/ismisepaul/strength5x5.git
cd strength5x5
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

### Google Drive Setup (Optional)

To enable cloud backup via Google Drive, you need a Google Cloud project with an OAuth 2.0 Client ID. Copy `.env.example` to `.env` and add your Client ID:

```bash
cp .env.example .env
# Edit .env with your Client ID
```

If `VITE_GOOGLE_CLIENT_ID` is not set, the Google Drive UI is hidden entirely.

See [docs/deployment.md](docs/deployment.md#2-google-drive-setup-optional) for the full step-by-step setup guide.

---

## Testing

The test suite uses **Vitest** with **React Testing Library** and covers:

- **Unit tests** -- plate calculation, 1RM estimation, deload logic, warmup clamping, import validation, chart data builders
- **Component tests** -- RestTimer rendering, ExerciseCard interactions
- **Integration tests** -- full workout flow, import/export round-trip, settings persistence, UI behavior

Run the full test suite:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

---

## Deployment

The app is designed to be deployed on Vercel. Push to GitHub, import into Vercel, and deploy -- Vite is auto-detected.

For the full guide including Google Drive setup, environment variables, and custom domains, see [docs/deployment.md](docs/deployment.md).

---

## Documentation

Detailed architecture and implementation docs are in the [`docs/`](docs/) folder:

- [**Architecture**](docs/architecture.md) -- project structure, state management, component hierarchy, data flow, i18n, and testing strategy
- [**Data Model**](docs/data-model.md) -- storage schemas, import/export format, migration strategy, and validation rules
- [**Deployment**](docs/deployment.md) -- Vercel setup, Google Cloud OAuth configuration, environment variables, and custom domains
- [**Google Drive Sync**](docs/google-drive-sync.md) -- authentication flow, file identification, upload/download mechanics, and CSP configuration

---

## Project Philosophy

Most fitness apps require accounts, subscriptions, and store user data on proprietary servers.

This project takes the opposite approach:

- No accounts required
- No vendor lock-in
- Your data is yours

Your training history can always be exported as JSON.

---

## Disclaimer

This app is provided as a training aid only and does not replace professional coaching or medical advice.

# Strength 5x5

A lightweight, mobile-friendly **Strength 5x5 workout tracker** designed for simplicity, reliability, and full data ownership.

This app helps lifters follow a classic **5x5 progressive strength training program**, track workouts, and maintain their training history -- all without requiring accounts, subscriptions, or complex infrastructure.

The application runs entirely in the browser and stores data locally. It works offline as a Progressive Web App.

---

## Features

### Guided 5x5 Training
- Alternating **Workout A / Workout B**
- Automatic weight progression
- Adjustable weights during sessions
- Set completion tracking optimized for mobile use

### Smart Rest Timer
- Built-in rest timer between sets (wall-clock anchored for accuracy)
- Visual countdown display
- Optional **sound alert**
- Optional **device vibration**
- Clear "Rest Over" indicator

### Progress Tracking
- Complete workout history
- Momentum heatmap showing training consistency
- Estimated **1RM calculations** (best across all history)
- Big-3 total tracking (Squat + Bench + Deadlift)

### Smart Training Logic
- Automatic progression when sets are completed
- Deload recommendations after long breaks (with option to skip)
- Plate calculator for easy bar loading
- Warm-up guidance

### Data Ownership
- Data stored locally as **JSON** with schema versioning
- Instant persistence using browser storage
- Manual backup and restore via JSON file
- Users retain full control of their training history

---

## Tech Stack

**Frontend**
- React 18
- Tailwind CSS v3
- Lucide Icons
- Vite

**Storage**
- LocalStorage (with schema versioning and migration support)

**Hosting**
- Vercel (with security headers via `vercel.json`)

No traditional backend or database required.

---

## Data Model

All user data is stored in a single JSON document:

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
  "vibrationEnabled": false
}
```

This makes backups portable and easy to inspect or restore.

---

## Development

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/strength5x5.git
cd strength5x5
```

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

---

## Deployment

The app is designed to be deployed on Vercel.

1. Push the repository to GitHub
2. Import the repo into Vercel
3. Deploy

Security headers are configured via `vercel.json`.

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

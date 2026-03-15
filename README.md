# Strength 5x5

A lightweight, mobile-friendly **Strength 5×5 workout tracker** designed for simplicity, reliability, and full data ownership.

This app helps lifters follow a classic **5×5 progressive strength training program**, track workouts, and maintain their training history — all without requiring accounts, subscriptions, or complex infrastructure.

The application runs entirely in the browser and stores data locally, with optional **Google Drive sync** for cloud backup.

---

## Features

### 🏋️ Guided 5×5 Training
- Alternating **Workout A / Workout B**
- Automatic weight progression
- Adjustable weights during sessions
- Set completion tracking optimized for mobile use

### ⏱ Smart Rest Timer
- Built-in rest timer between sets
- Visual countdown display
- Optional **sound alert**
- Optional **device vibration**
- Clear “Rest Over” indicator

### 📊 Progress Tracking
- Complete workout history
- Momentum heatmap showing training consistency
- Estimated **1RM calculations**
- Big-3 total tracking (Squat + Bench + Deadlift)

### 🧠 Smart Training Logic
- Automatic progression when sets are completed
- Deload recommendations after long breaks
- Plate calculator for easy bar loading
- Warm-up guidance

### 💾 Data Ownership
- Data stored locally as **JSON**
- Instant persistence using browser storage
- Optional **Google Drive backup**
- Users retain full control of their training history

---

## Tech Stack

**Frontend**
- React
- Tailwind CSS
- Lucide Icons

**Storage**
- LocalStorage (primary)
- Google Drive JSON file (optional sync)

**Hosting**
- Vercel

No traditional backend or database required.

---

## Data Model

All user data is stored in a single JSON document:

```json
{
  "weights": {
    "squat": 0,
    "bench": 0,
    "deadlift": 0
  },
  "history": [],
  "settings": {}
}
```

This makes backups portable and easy to inspect or restore.

## Development

Clone the repository:

```
git clone https://github.com/YOUR_USERNAME/strength5x5.git
cd strength5x5
```

Install dependencies:

```
npm install
```

### Start development server:

```
npm run dev
Deployment
```

The app is designed to be deployed on Vercel.

- Push the repository to GitHub
- Import the repo into Vercel
- Deploy


Project Philosophy

Most fitness apps require accounts, subscriptions, and store user data on proprietary servers.

This project takes the opposite approach:

- No accounts required
- No vendor lock-in
- Your data is yours

Your training history can always be exported as JSON.


Disclaimer

This app is provided as a training aid only and does not replace professional coaching or medical advice.

# Data Model

## Storage Keys

The app uses two localStorage keys:

| Key | Purpose |
|-----|---------|
| `strength5x5_data` | Main application state |
| `strength5x5_active_workout` | In-progress workout (crash recovery) |

## Main State Schema

Stored under `strength5x5_data`:

```json
{
  "version": 2,
  "weights": {
    "squat": 60,
    "bench": 45,
    "row": 50,
    "press": 32.5,
    "deadlift": 80
  },
  "program": {
    "squat": { "sets": 5, "reps": 5 },
    "bench": { "sets": 3, "reps": 5 },
    "row": { "sets": 5, "reps": 5 },
    "press": { "sets": 5, "reps": 5 },
    "deadlift": { "sets": 1, "reps": 5 }
  },
  "history": [
    {
      "date": "2026-03-15T12:00:00.000Z",
      "type": "A",
      "duration": 2700000,
      "exercises": [
        {
          "id": "squat",
          "name": "Back Squat",
          "sets": 5,
          "reps": 5,
          "increment": 2.5,
          "weight": 60,
          "setsCompleted": [5, 5, 5, 5, 3]
        }
      ]
    }
  ],
  "nextType": "A",
  "isDark": true,
  "autoSave": true,
  "preferredRest": 90,
  "soundEnabled": false,
  "vibrationEnabled": false,
  "logGrouping": "all"
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version for migration support |
| `weights` | object | Current working weight per exercise (kg) |
| `weights.{id}` | number | Weight in kg, always a multiple of 2.5 |
| `program` | object | User-customized sets/reps per exercise |
| `program.{id}.sets` | number | Sets for this exercise, 1-5 (default 5, deadlift defaults to 1) |
| `program.{id}.reps` | number | Rep target for this exercise, 1-10 (default 5) |
| `history` | array | Completed workouts, newest first |
| `history[].date` | string | ISO 8601 timestamp |
| `history[].type` | string | `"A"` or `"B"` |
| `history[].duration` | number | Workout duration in milliseconds (optional) |
| `history[].exercises` | array | Exercises performed |
| `history[].exercises[].id` | string | Exercise identifier (`squat`, `bench`, `row`, `press`, `deadlift`) |
| `history[].exercises[].weight` | number | Weight used (kg) |
| `history[].exercises[].sets` | number | Sets targeted for this entry, as configured in `program` when the workout started |
| `history[].exercises[].reps` | number | Rep target for this entry, as configured in `program` when the workout started |
| `history[].exercises[].setsCompleted` | array | Reps completed per set, length equal to `sets`. A value equal to `reps` = full set, lower = partial, `null` = not attempted |

Each history entry carries its own `sets`/`reps` snapshot (taken from `program` at workout start), so editing `program` later never rewrites past workouts -- they keep the target they were actually performed against.
| `nextType` | string | Next workout type (`"A"` or `"B"`) |
| `isDark` | boolean | Dark mode preference |
| `autoSave` | boolean | Download JSON backup after each workout |
| `preferredRest` | number | Rest timer duration in seconds (90, 180, or 300) |
| `soundEnabled` | boolean | Play chime when rest timer ends |
| `vibrationEnabled` | boolean | Vibrate device when rest timer ends |
| `logGrouping` | string | History grouping mode (`"all"`, `"week"`, `"month"`, `"year"`) |

## Active Workout Schema

Stored under `strength5x5_active_workout` during a workout:

```json
{
  "session": {
    "date": "2026-03-15T14:30:00.000Z",
    "type": "A",
    "startedAt": 1710510600000,
    "exercises": [
      {
        "id": "squat",
        "weight": 60,
        "setsCompleted": [5, 5, null, null, null]
      }
    ]
  },
  "restTimerEndTime": 1710510690000
}
```

- `session` mirrors the history entry format but includes `startedAt` (epoch ms)
- `restTimerEndTime` is the wall-clock time when the rest timer will expire (epoch ms), or `null` if no timer is active
- Automatically removed when the workout is finished or discarded
- Expired if the workout date is older than 24 hours

## Import/Export Format

Backup files (both local JSON and Google Drive) use the same format as the main state, with an additional `app` field:

```json
{
  "app": "Strength 5x5",
  "version": 1,
  "weights": { ... },
  "history": [ ... ],
  "nextType": "A",
  ...
}
```

## Validation Rules

Import data is validated by `validateImportData()` in `src/utils.js`:

1. Must be a non-null object
2. `weights` must be an object with all expected keys (`squat`, `bench`, `row`, `press`, `deadlift`), each a number
3. `history` must be an array
4. Weights are normalized to multiples of 2.5
5. History entries are filtered: each must have `date` (string), `type` (string), and `exercises` (array)
6. File size is checked before reading: maximum 5 MB (`MAX_IMPORT_SIZE`)

## Schema Migration

The `version` field supports forward migration:

- Current version: `2` (defined in `SCHEMA_VERSION`)
- On load, if `version < SCHEMA_VERSION`, the data passes through `migrate()` in `src/utils.js`
- The migration function applies incremental transforms (e.g., `if (fromVersion < 2) { ... }`)
- After migration, the version is bumped to `SCHEMA_VERSION`
- **v1 → v2**: adds `program`, defaulting every exercise to 5 sets / 5 reps (deadlift to 1 set / 5 reps) via `normalizeProgram()`. Imported backups without a `program` field are handled the same way in `validateImportData()`, so old exports keep working.

## Google Drive Backup

When saved to Google Drive, the backup file is named `strength5x5_backup_v1.json` and tagged with `appProperties: { app: 'strength5x5' }` for reliable identification. The file format is identical to the local export format. See [google-drive-sync.md](google-drive-sync.md) for details.

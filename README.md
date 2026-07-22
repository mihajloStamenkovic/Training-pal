# Training Pal — Offline-First Workout Tracker

A personal gym-tracking PWA built for real training sessions, not spreadsheet logging. Build a template once, run it as a rotating program, and log sets live mid-workout — with a rest timer, RIR (Reps in Reserve) tracking, and history that survives closing the tab, because there's no server to lose connection to.

**[Live demo →](https://vercel.com/mixa2002s-projects/training-pal)** · Installable as a home-screen app on mobile and desktop

## Features

- **Template-based programming** — build reusable workout templates mixing strength (weight/reps/RIR targets) and cardio (incline/speed/duration) exercises
- **Program cycles** — chain templates into a rotation (e.g. Push/Pull/Legs) that automatically advances to the next workout in sequence as you complete sessions
- **Live workout mode** — a dedicated in-session screen with a rest timer, an RIR selector, and set-by-set logging designed for one-handed use between sets
- **History & consistency tracking** — a calendar view of completed/skipped/abandoned sessions plus consistency stats, so gaps in training are visible, not just individual lifts
- **Progressive overload predictions** — suggests next-session targets based on past performance
- **Fully offline** — all data lives in IndexedDB (via Dexie); the app works with no network connection at all, not just a cached shell
- **Installable PWA** — a Workbox service worker + web manifest make it installable on iOS/Android/desktop and behave like a native app

## Tech Stack

| Layer               | Choice                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Framework           | React 19 + TypeScript + Vite                                     |
| Routing             | React Router v7                                                  |
| Local storage       | Dexie (IndexedDB wrapper) + `dexie-react-hooks` for live queries |
| Offline/installable | `vite-plugin-pwa` (Workbox)                                      |
| Styling             | CSS Modules per component                                        |

## Project Structure

```
src/
├── screens/          # Today, LiveWorkout, Templates, ProgramCycle, History, Settings
├── components/
│   ├── workout/       # Set rows, RIR selector, rest timer display, exercise progress
│   ├── templates/      # Template cards, exercise form rows
│   ├── history/       # Calendar view, consistency stats
│   └── common/         # Buttons, dialogs, toggles, empty states
├── db/                 # Dexie schema + TypeScript types (Template, Session, ProgramCycle, Settings)
├── hooks/              # useRestTimer, useStopwatch, useSettings
└── utils/              # Progressive-overload predictions, date/session helpers
```

## Data Model

Everything is typed end-to-end: a `Template` holds `Exercise` definitions (strength or cardio), a `ProgramCycle` sequences templates into a rotation, and each completed `Session` snapshots exactly what was performed (sets, weights, reps, RIR) independent of the template it came from — so editing a template later never rewrites history.

## Getting Started

```bash
npm install
npm run dev       # starts Vite dev server on :5174
npm run build     # type-checks (tsc -b) and builds for production
npm run preview   # preview the production build locally
```

No backend, database, or environment variables required — everything runs client-side.

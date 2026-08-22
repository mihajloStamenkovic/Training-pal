# Training Pal — Workout Tracker

A personal gym-tracking PWA built for real training sessions, not spreadsheet logging. Build a workout once, chain workouts into a rotation, and log sets live mid-session — with a rest timer, RIR (Reps in Reserve) tracking, and targets that carry forward from what you actually lifted.

**[Live demo →](https://training-pal-git-main-mixa2002s-projects.vercel.app/)** · Installable as a home-screen app on mobile and desktop

## Features

- **Workout templates** — reusable workouts mixing strength (weight/reps/RIR targets) and cardio (incline/speed/duration) exercises
- **Program rotation** — chain workouts into a rotation (e.g. Push/Pull/Legs) that advances to the next one as you complete sessions, and back-fills skipped days so the rotation stays in step with the calendar
- **Live workout mode** — a dedicated in-session screen with a rest timer, an RIR selector, and set-by-set logging designed for one-handed use between sets
- **Targets that follow the lift, not the template** — exercise names are global labels: finishing a set of bench at 70×6 writes that back as the target for bench in *every* workout that has it, so the next session starts from what you actually lifted
- **Resumable sessions** — an in-progress workout is checkpointed to `localStorage`, so closing the tab or locking the phone mid-set loses nothing
- **Installable PWA** — a Workbox service worker + web manifest make it installable on iOS/Android/desktop. The app shell is precached and `GET /trpc` calls are network-first with a cache fallback, so a flaky connection degrades rather than breaks. Logging a session still requires the network.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces |
| Client | React 19 + TypeScript + Vite 8, CSS Modules per component |
| Routing | React Router v7 |
| API | tRPC v11 over Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (`@clerk/clerk-react` on the client, `@clerk/express` on the server) |
| Data fetching | TanStack Query via `@trpc/react-query` |
| Offline/installable | `vite-plugin-pwa` (Workbox) |
| Deployment | Client on Vercel, server + Postgres on Railway |

## Project Structure

```
apps/
├── client/               # React PWA
│   └── src/
│       ├── screens/      # Today, Program, TemplateEditor, LiveWorkout, Settings, SignIn
│       ├── components/
│       │   ├── workout/  # Set rows, RIR selector, rest timer, exercise progress
│       │   ├── templates/# Template cards, exercise form rows
│       │   ├── program/  # Rotation editor
│       │   ├── layout/   # App shell, top nav, page header, auth guard
│       │   └── common/   # Buttons, dialogs, bottom sheet, empty/error/loading states
│       ├── hooks/        # useRestTimer, useStopwatch
│       ├── lib/          # tRPC clients, query provider, Clerk token bridge
│       └── utils/        # Dates, session helpers, workout stats, draft persistence
└── server/               # Express + tRPC API
    ├── src/routers/      # templates, sessions, cycle
    ├── src/db/           # Drizzle schema, connection, migration runner
    └── drizzle/          # Generated SQL migrations

packages/
└── shared/               # Types + Zod schemas used by both apps
```

## Data Model

Everything is typed end-to-end from `packages/shared`. A `Template` holds `Exercise` definitions (strength or cardio), a `ProgramCycle` sequences templates into a rotation, and each `Session` snapshots exactly what was performed (sets, weights, reps, RIR) independently of the template it came from — so editing a workout later never rewrites history. Every table is scoped to a Clerk user id.

## Getting Started

Requires Node 22+, pnpm 11+, and a PostgreSQL database.

```bash
pnpm install
```

Create the two env files:

```bash
# apps/server/.env
DATABASE_URL=postgresql://user:password@host:5432/training_pal
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
PORT=3001                        # optional, defaults to 3001
CLIENT_ORIGIN=https://...        # optional; comma-separated extra CORS origins.
                                 # localhost on any port is always allowed.

# apps/client/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=https://...         # production only. Left unset in dev, where
                                 # Vite proxies /trpc to localhost:3001.
```

Apply migrations, then run both apps:

```bash
pnpm --filter @training-pal/server migrate
pnpm dev            # client on :5174, server on :3001
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs client and server together |
| `pnpm dev:client` / `pnpm dev:server` | One at a time |
| `pnpm build` | Builds shared, then server, then client |
| `pnpm typecheck` | `tsc -b` across all three packages |
| `pnpm lint` | ESLint across the workspace |
| `pnpm check` | typecheck + lint + build — the full gate |

Database work happens from `apps/server`:

| Command | What it does |
| --- | --- |
| `pnpm --filter @training-pal/server generate` | Generates a migration from schema changes |
| `pnpm --filter @training-pal/server migrate` | Applies migrations (via tsx, for local use) |
| `pnpm --filter @training-pal/server migrate:deploy` | Applies migrations from the build output (used on deploy) |

## Tests

There are none yet. `pnpm check` is the current gate: it catches type and lint regressions across all three packages, but no behavioral ones.

# Training Pal: Fullstack Migration Plan

> **How to use:** Copy each step's prompt block into Claude Code. Execute steps in order. Each step is self-contained and testable.

**Target stack:** Express + tRPC, PostgreSQL + Drizzle ORM, Clerk auth, React Query, pnpm monorepo

**Current state:** React 19 + TS + Vite PWA. All data in IndexedDB via Dexie. 10 files with Dexie calls, 10 useLiveQuery instances across 7 files. No API, no auth.

---

## Phase 0: Monorepo Scaffolding ✅

### Step 0.1 — Convert to pnpm workspace monorepo ✅

```prompt
Convert this project to a pnpm workspace monorepo.

Structure:
- apps/client/ — move ALL current project files here (src/, public/, index.html, vite.config.ts, tsconfig files, package.json, etc.)
- apps/server/ — empty for now, just package.json with name "@training-pal/server"
- packages/shared/ — empty for now, just package.json with name "@training-pal/shared", tsconfig.json, and src/index.ts barrel file

Root level:
- pnpm-workspace.yaml with packages: ['apps/*', 'packages/*']
- Root package.json (private: true) with scripts: "dev:client": runs client dev, "dev:server": runs server dev, "dev": runs both via concurrently
- Root tsconfig.json with project references to all 3 sub-projects
- Install concurrently as root dev dependency

Update apps/client/package.json name to "@training-pal/client".
Make sure all existing imports and paths still work within apps/client/.

Verify: pnpm install succeeds, pnpm --filter @training-pal/client dev starts on port 5174, app works identically.
```

### Step 0.2 — Extract shared types ✅

```prompt
Extract the shared data types from apps/client/src/db/types.ts into packages/shared/.

1. Copy all type/interface definitions into packages/shared/src/types.ts
2. Create packages/shared/src/schemas.ts with Zod schemas that mirror every type:
   - strengthSetTargetSchema, strengthExerciseSchema, cardioExerciseSchema, exerciseSchema (discriminated union)
   - templateSchema (for create input: omit id), templateUpdateSchema
   - sessionSchema (for create input: omit id), sessionExerciseSchema, strengthSetSchema, cardioSetSchema
   - programCycleSchema, programCycleUpdateSchema
   - settingsSchema
3. Export everything from packages/shared/src/index.ts
4. Make apps/client/src/db/types.ts just re-export from @training-pal/shared
5. Add @training-pal/shared as workspace dependency in apps/client/package.json

Verify: pnpm --filter @training-pal/client build succeeds with no type errors. App unchanged.
```

---

## Phase 1: Server Foundation ✅

### Step 1.1 — Express + tRPC server skeleton ✅

```prompt
Set up the backend server in apps/server/.

Install dependencies:
- express, @trpc/server, cors, dotenv, zod
- Dev: tsx, @types/express, @types/cors, typescript

Create these files:

apps/server/src/index.ts:
- Express app on port 3001
- CORS enabled for http://localhost:5174
- /health endpoint returning { status: 'ok' }
- tRPC mounted at /trpc via createExpressMiddleware

apps/server/src/trpc.ts:
- Initialize tRPC with context type { userId: string | null }
- For now, context always returns { userId: 'dev-user' } (auth added later)
- Export publicProcedure, router, createContext

apps/server/src/router.ts:
- Root appRouter with a health query procedure returning { status: 'ok' }
- Export type AppRouter = typeof appRouter

apps/server/tsconfig.json:
- Target ES2022, module NodeNext, moduleResolution NodeNext
- Include @training-pal/shared via project references

Add scripts to apps/server/package.json: "dev": "tsx watch src/index.ts"
Add @training-pal/shared as workspace dependency.

Verify: pnpm --filter @training-pal/server dev starts. curl http://localhost:3001/health returns 200. curl http://localhost:3001/trpc/health returns result.
```

### Step 1.2 — Drizzle schema and PostgreSQL connection ✅

```prompt
Set up PostgreSQL with Drizzle ORM in the server.

Install in apps/server: drizzle-orm, postgres (the pg driver), drizzle-kit

Create apps/server/src/db/schema.ts with these tables:

users:
- id: text, primary key (will be Clerk user ID)
- createdAt: timestamp, default now()

templates:
- id: text, primary key
- userId: text, not null, references users.id
- name: text, not null
- exercises: jsonb, not null (stores Exercise[] array)
- createdAt: bigint, not null
- updatedAt: bigint, not null

sessions:
- id: text, primary key
- userId: text, not null, references users.id
- templateId: text, not null
- templateName: text, not null
- date: text, not null (YYYY-MM-DD)
- status: text, not null ('completed' | 'skipped' | 'abandoned')
- startedAt: bigint, nullable
- finishedAt: bigint, nullable
- durationSeconds: integer, nullable
- exerciseData: jsonb, not null (stores SessionExercise[])

program_cycles:
- id: text, primary key
- userId: text, not null, unique, references users.id
- sequence: jsonb, not null (string[])
- currentIndex: integer, not null
- startDate: text, not null
- lastCompletedDate: text, nullable

Create apps/server/src/db/index.ts:
- Read DATABASE_URL from process.env
- Create postgres client and drizzle instance
- Export db

Create apps/server/drizzle.config.ts pointing to schema.ts and DATABASE_URL env var.
Create apps/server/.env with DATABASE_URL=postgresql://postgres:postgres@localhost:5432/training_pal
Create apps/server/.env.example with DATABASE_URL placeholder.
Add .env to apps/server/.gitignore.

Verify: Run pnpm --filter @training-pal/server drizzle-kit push. Check that 4 tables exist in PostgreSQL.
```

### Step 1.3 — tRPC routers for all entities ✅

```prompt
Create tRPC routers that match every Dexie operation in the current client. Use the Zod schemas from @training-pal/shared for input validation. All procedures should use ctx.userId to scope data to the current user.

Create apps/server/src/routers/templates.ts:
- templates.list: query — SELECT all templates WHERE userId = ctx.userId, ordered by createdAt desc
- templates.get: query — input { id: string }, SELECT template WHERE id AND userId
- templates.create: mutation — input: name, exercises. Generate id with crypto.randomUUID(). Set createdAt/updatedAt to Date.now(). INSERT with userId = ctx.userId. Return the template.
- templates.update: mutation — input: id, name, exercises. Set updatedAt to Date.now(). UPDATE WHERE id AND userId.
- templates.delete: mutation — input { id: string }. DELETE template WHERE id AND userId. ALSO remove this templateId from the user's program_cycle sequence if it exists (server-side cascade).

Create apps/server/src/routers/sessions.ts:
- sessions.list: query — SELECT all sessions WHERE userId, ordered by date desc
- sessions.get: query — input { id: string }, SELECT session WHERE id AND userId
- sessions.listByTemplate: query — input { templateId: string }. SELECT sessions WHERE templateId AND userId AND status='completed', ordered by date DESC. (Used by predictions.ts and TodayScreen for last session)
- sessions.create: mutation — input: all session fields except userId. INSERT with userId = ctx.userId.

Create apps/server/src/routers/cycle.ts:
- cycle.get: query — SELECT program_cycle WHERE userId. Return null if not found.
- cycle.upsert: mutation — input: sequence, currentIndex, startDate, lastCompletedDate. INSERT or UPDATE (ON CONFLICT userId) the full cycle.
- cycle.update: mutation — input: partial fields (any of sequence, currentIndex, startDate, lastCompletedDate). UPDATE program_cycle WHERE userId, only setting provided fields.

Update apps/server/src/router.ts:
- Merge all 3 sub-routers into appRouter
- Export AppRouter type

For now ctx.userId is hardcoded to 'dev-user'. Insert a dev user row in the users table manually or have the server auto-create it on startup.

Verify: Start server. Use curl to test each endpoint:
- POST /trpc/templates.create with a body → creates in DB
- GET /trpc/templates.list → returns created template
- POST /trpc/sessions.create → creates session
- GET /trpc/cycle.get → returns null initially
- POST /trpc/cycle.upsert → creates cycle
```

---

## Phase 2: Wire Client to Server

### Step 2.1 — Install tRPC client + React Query ✅

```prompt
Set up the tRPC client and React Query in apps/client/ WITHOUT changing any existing screen code yet.

Install: @trpc/client, @trpc/react-query, @tanstack/react-query

Create apps/client/src/lib/trpc.ts:
- Import AppRouter type from the server (use a relative path like ../../server/src/router or configure TS paths)
- Export trpc = createTRPCReact<AppRouter>()
- Export a vanilla trpcClient for use outside React components (needed later for predictions.ts)
- Configure httpBatchLink pointing to http://localhost:3001/trpc (will be changed to proxy later)

Create apps/client/src/lib/QueryProvider.tsx:
- Creates QueryClient with defaults: staleTime 30s, retry 1
- Creates tRPC client with httpBatchLink
- Wraps children in trpc.Provider and QueryClientProvider
- Export as default

Update apps/client/src/main.tsx:
- Wrap <App /> in <QueryProvider>

Verify: App starts without errors. All screens still work via Dexie. No tRPC calls being made yet.
```

### Step 2.2 — Migrate HistoryScreen ⛔ N/A — HistoryScreen was deleted in an earlier task (History feature removed)

```prompt
Migrate apps/client/src/screens/HistoryScreen.tsx from Dexie to tRPC.

This screen has one useLiveQuery: db.sessions.toArray()

Replace:
- Remove import of useLiveQuery from dexie-react-hooks
- Remove import of db from ../db/database
- Add import of trpc from ../lib/trpc
- Replace: const sessions = useLiveQuery(() => db.sessions.toArray())
  With: const { data: sessions } = trpc.sessions.list.useQuery()
- Handle the undefined/loading case (sessions might be undefined while loading — the existing code already handles this with a falsy check)

Verify: Start both server and client. Navigate to History tab. Sessions from PostgreSQL appear (or empty state if no sessions). No Dexie references remain in this file.
```

### Step 2.3 — Migrate SessionDetailScreen ⛔ N/A — SessionDetailScreen/SessionEditorScreen were deleted alongside History

```prompt
Migrate apps/client/src/screens/SessionDetailScreen.tsx from Dexie to tRPC.

This screen has one useLiveQuery: db.sessions.get(sessionId)

Replace:
- Remove useLiveQuery and db imports
- Add trpc import
- Replace the useLiveQuery call with: trpc.sessions.get.useQuery({ id: sessionId! }, { enabled: !!sessionId })
- Get session from query.data

Verify: Navigate to a session detail page. Session data renders correctly.
```

### Step 2.4 — Migrate TemplatesListScreen ✅

```prompt
Migrate apps/client/src/screens/TemplatesListScreen.tsx from Dexie to tRPC.

Current Dexie operations:
- useLiveQuery(() => db.templates.toArray()) — read all templates
- handleDelete: db.programCycle.get('active'), db.programCycle.update (remove from cycle), db.templates.delete(id)

Replace:
- Remove useLiveQuery and db imports, add trpc import
- Templates list: trpc.templates.list.useQuery()
- Delete: use trpc.templates.delete.useMutation(). The server-side delete already handles removing the template from the cycle (done in Step 1.3). On mutation success, invalidate templates.list and cycle.get queries using trpc.useUtils().
- Remove the client-side cycle cleanup code since the server handles it now.

Verify: Templates list renders. Deleting a template removes it from list and from cycle.
```

### Step 2.5 — Migrate TemplateEditorScreen ✅

```prompt
Migrate apps/client/src/screens/TemplateEditorScreen.tsx from Dexie to tRPC.

Current Dexie operations:
- useEffect: db.templates.get(id) to load existing template
- handleSave: db.templates.add(template) for new, db.templates.update(id, changes) for existing

Replace:
- Remove db import, add trpc import
- Load template: trpc.templates.get.useQuery({ id: id! }, { enabled: !!id }). Set form state from query.data.
- Create: trpc.templates.create.useMutation(). On success, invalidate templates.list and navigate to /templates.
- Update: trpc.templates.update.useMutation(). On success, invalidate templates.list and templates.get, navigate to /templates.

Verify: Create a new template — appears in list. Edit it — changes persist. Navigate away and back — data correct.
```

### Step 2.6 — Migrate ProgramCycleScreen ✅

```prompt
Migrate apps/client/src/screens/ProgramCycleScreen.tsx from Dexie to tRPC.

This is the most mutation-heavy screen. Current Dexie operations:
- useLiveQuery(() => db.templates.toArray())
- useLiveQuery(() => db.programCycle.get('active'))
- addToSequence: db.programCycle.update or db.programCycle.put (upsert)
- removeFromSequence: db.programCycle.update (new sequence + adjusted index)
- moveInSequence: db.programCycle.update (reordered sequence)
- resetCycle: db.programCycle.update (index=0, startDate=today, lastCompleted=null)

Replace:
- Remove useLiveQuery, db imports. Add trpc import.
- Templates: trpc.templates.list.useQuery()
- Cycle: trpc.cycle.get.useQuery()
- addToSequence: trpc.cycle.upsert.useMutation() — handles both create (first template added) and update
- removeFromSequence: trpc.cycle.update.useMutation() with { sequence, currentIndex }
- moveInSequence: trpc.cycle.update.useMutation() with { sequence }
- resetCycle: trpc.cycle.update.useMutation() with { currentIndex: 0, startDate, lastCompletedDate: null }
- After every mutation, invalidate cycle.get using trpc.useUtils()

Verify: Add templates to cycle, reorder, remove, reset. All changes persist across page reloads.
```

### Step 2.7 — Migrate TodayScreen ✅ (added a `sessions.createMany` bulk-insert endpoint for the missed-days catch-up sync, not in the original plan)

```prompt
Migrate apps/client/src/screens/TodayScreen.tsx from Dexie to tRPC.

Current Dexie operations:
- useLiveQuery(() => db.programCycle.get('active'))
- useLiveQuery(() => db.templates.toArray())
- db.sessions.where('templateId').equals(id).filter(completed).reverse().sortBy('date') — last session query
- handleSkip: db.sessions.add(skipSession), db.programCycle.update(increment index)

Replace:
- Remove useLiveQuery, db imports. Add trpc import.
- Cycle: trpc.cycle.get.useQuery()
- Templates: trpc.templates.list.useQuery()
- Last session: trpc.sessions.listByTemplate.useQuery({ templateId }, { enabled: !!templateId }). Take first element from results.
- handleSkip: Use trpc.sessions.create.useMutation() and trpc.cycle.update.useMutation(). On success, invalidate cycle.get, sessions.list, sessions.listByTemplate.

Verify: Today screen shows current workout. Skip advances cycle. "Done for today" works.
```

### Step 2.8 — Migrate predictions.ts ✅

```prompt
Migrate apps/client/src/utils/predictions.ts from Dexie to tRPC.

Current: getLastSessionExercises(templateId) directly queries db.sessions.where('templateId')...

This is NOT a React component, so it can't use hooks. Use the vanilla tRPC client.

Replace:
- Remove db import
- Import the vanilla trpcClient from ../lib/trpc
- Replace the Dexie query with: const sessions = await trpcClient.sessions.listByTemplate.query({ templateId })
- The server already returns completed sessions sorted by date desc, so just take sessions[0]
- Rest of the logic (building the Map) stays the same

Verify: Start a workout for a template that has previous sessions. Prediction values (last weight/reps) appear correctly in the set inputs.
```

### Step 2.9 — Migrate LiveWorkoutScreen ✅ (used the imperative vanilla-client load pattern as suggested; "rest timer + vibration still work" from the original verify text no longer applies — sound/vibration were removed from the app in an earlier task)

```prompt
Migrate apps/client/src/screens/LiveWorkoutScreen.tsx from Dexie to tRPC.

This is the most complex screen. Current Dexie operations:
- useLiveQuery(() => db.programCycle.get('active')) — reactive cycle read
- loadWorkout function: db.programCycle.get('active'), db.templates.get(templateId)
- predictions via getLastSessionExercises (already migrated in Step 2.8)
- finishWorkout: db.sessions.add(session), db.programCycle.update(increment index)

Replace:
- Remove useLiveQuery, db imports. Add trpc import.
- The reactive cycle query: trpc.cycle.get.useQuery() — but this screen loads workout data in a useEffect. Refactor: use trpc.cycle.get.useQuery() and trpc.templates.get.useQuery() at the top level, derive workout state from query data.
- OR keep the imperative load pattern using the vanilla tRPC client (trpcClient.cycle.get.query(), trpcClient.templates.get.query({ id })) inside the existing useEffect. This is the lower-risk approach since it preserves the existing flow.
- finishWorkout: trpc.sessions.create.useMutation() and trpc.cycle.update.useMutation(). On success, invalidate cycle.get, sessions.list, then navigate.
- Keep useSettings() as-is — settings stay local.

Verify: Start a workout, complete sets, finish. Session appears in history. Cycle advances. Predictions work. Rest timer + vibration still work.
```

### Step 2.10 — Remove Dexie, move Settings to localStorage ✅ (modified — see note below)

> **Note:** `Settings` (`soundEnabled`/`vibrationEnabled`) was already deleted from the app in an earlier task, before this migration started. By the time this step ran, `useSettings`, the `Settings` type, and the `settings` Dexie table were all dead code (zero callers). Rather than migrating a nonexistent feature to `localStorage`, they were deleted outright along with the rest of Dexie.

```prompt
Remove all Dexie dependencies and move Settings to localStorage.

1. Create apps/client/src/lib/SettingsContext.tsx:
   - Define Settings type: { soundEnabled: boolean, vibrationEnabled: boolean }
   - Default: both true
   - Read initial state from localStorage key "training-pal-settings"
   - Provide a context with { settings, updateSetting(key, value) }
   - updateSetting writes to localStorage and updates state
   - Export SettingsProvider and useSettings hook

2. Update apps/client/src/hooks/useSettings.ts:
   - Replace the Dexie-based implementation with re-export from ../lib/SettingsContext
   - Or delete this file and update all imports to use the context directly

3. Update apps/client/src/screens/SettingsScreen.tsx:
   - Remove db import
   - Use the new useSettings context hook
   - updateSetting calls the context instead of db.settings.update

4. Wrap <App /> in <SettingsProvider> in main.tsx (inside QueryProvider)

5. Delete apps/client/src/db/database.ts

6. Remove dexie and dexie-react-hooks from apps/client/package.json, run pnpm install

7. Verify: grep -r "dexie" apps/client/src/ returns nothing. grep -r "db/database" apps/client/src/ returns nothing. App works end-to-end. Settings persist across page reloads via localStorage.
```

---

## Phase 3: Authentication ✅ (user manually confirmed sign-in → Today screen → sign-out → redirect to /sign-in works end-to-end)

### Step 3.1 — Clerk server middleware ✅ verified — unauthenticated `curl` to templates.list returns real 401 UNAUTHORIZED with real Clerk keys loaded

```prompt
Add Clerk authentication to the server.

Install @clerk/express in apps/server.

Update apps/server/.env and .env.example with CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY placeholders.

Update apps/server/src/index.ts:
- Add clerkMiddleware() before the tRPC handler

Update apps/server/src/trpc.ts:
- In createContext, extract userId from getAuth(req). If no userId, set ctx.userId = null.
- Create a protectedProcedure that checks ctx.userId is not null, throws TRPCError UNAUTHORIZED otherwise.
- In the protectedProcedure middleware, auto-upsert a user row: INSERT INTO users (id) VALUES (ctx.userId) ON CONFLICT DO NOTHING.

Update all routers (templates.ts, sessions.ts, cycle.ts):
- Change all procedures from publicProcedure to protectedProcedure

Remove the hardcoded 'dev-user' fallback.

Verify: Start server. curl any tRPC endpoint without auth token → 401 UNAUTHORIZED.
```

### Step 3.2 — Clerk client integration ✅ verified in browser — visiting the app redirects to /sign-in and renders Clerk's real sign-in UI (used @clerk/clerk-react, not the newer unproven @clerk/react Core 3 package). Full sign-in → data-loads → sign-out loop needs to be manually confirmed by the user (Claude cannot enter personal Clerk credentials).

```prompt
Add Clerk authentication to the client.

Install @clerk/clerk-react in apps/client.

Update apps/client/src/main.tsx:
- Wrap everything in <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
- Add VITE_CLERK_PUBLISHABLE_KEY to .env

Create apps/client/src/screens/SignInScreen.tsx:
- Render Clerk's <SignIn /> component centered on screen
- Style to match the dark theme (appearance prop)

Create apps/client/src/components/layout/AuthGuard.tsx:
- Use useAuth() from @clerk/clerk-react
- If isLoaded && !isSignedIn, redirect to /sign-in
- If isLoaded && isSignedIn, render children
- While loading, show a loading spinner

Update apps/client/src/App.tsx:
- Add /sign-in route → SignInScreen
- Wrap all other routes in AuthGuard

Update apps/client/src/lib/trpc.ts (or QueryProvider.tsx):
- In the httpBatchLink headers function, get the Clerk session token via useAuth().getToken()
- Pass it as Authorization: Bearer <token> header
- Pattern: store a getToken ref that's set by a component inside ClerkProvider, read it in the link

Add sign-out button to apps/client/src/screens/SettingsScreen.tsx:
- Import useClerk() and call clerk.signOut() on button press

Verify: App redirects to sign-in. After signing in, all data loads. Sign out works. Different user sees different (empty) data.
```

---

## Phase 4: Production Readiness

### Step 4.1 — Environment config and Vite proxy ✅ verified — /trpc/health resolves through the Vite dev proxy, and the full app (already-signed-in session) loads data through it with no CORS errors

```prompt
Set up proper environment configuration and dev proxy.

Update apps/client/vite.config.ts:
- Add server.proxy: { '/trpc': 'http://localhost:3001' }
- This eliminates CORS issues and mirrors production routing

Update apps/client/src/lib/trpc.ts:
- Change httpBatchLink URL from http://localhost:3001/trpc to just /trpc (relative URL)
- Works via Vite proxy in dev, same-origin in production

Create apps/server/src/env.ts:
- Use Zod to validate required env vars at startup: DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
- Throw descriptive error if any are missing
- Import and call this at the top of index.ts

Create root .env.example documenting all required variables across both apps.

Verify: pnpm dev starts both apps. Client API calls go through Vite proxy. No CORS errors in console.
```

### Step 4.2 — Error handling and loading states ✅ (added LoadingSpinner/ErrorMessage/ErrorBoundary; used `isPending` rather than `isLoading` from React Query — `isLoading` is `pending && fetching` and misses the `pending`+`paused` state a query can sit in between retry attempts, which would otherwise show neither the spinner nor the error UI. Also set `networkMode: 'always'` on the QueryClient so real connectivity failures surface as errors rather than pausing indefinitely.)

```prompt
Add consistent error handling and loading states to all screens.

Create apps/client/src/components/common/LoadingSpinner.tsx:
- Simple centered spinner matching the dark theme
- CSS module for styling

Create apps/client/src/components/common/ErrorBoundary.tsx:
- React error boundary component
- Shows error message and a "Try Again" button that resets the boundary
- Styled to match the dark theme

Update apps/client/src/App.tsx:
- Wrap route outlet in ErrorBoundary

Update all 8 screen files that use tRPC queries:
- While queries are loading (isLoading), show LoadingSpinner
- If query errors, show an error message with retry button (refetch())
- For mutations, add onError callbacks that show user-friendly messages (could be a simple alert or inline error state)

Verify: Stop the server. Navigate around the app — error states show everywhere, not blank screens. Restart server. Click retry — data loads.
```

### Step 4.3 — Update PWA configuration ✅ verified — `trpc-cache` NetworkFirst runtime-caching rule confirmed present in the built dist/sw.js

```prompt
Update the PWA service worker config for online-first API calls.

Update apps/client/vite.config.ts workbox configuration:
- Add a runtimeCaching rule for /trpc/* requests using NetworkFirst strategy (try network, fall back to cache)
- Keep the existing CacheFirst strategy for static assets (JS, CSS, HTML, images, fonts)
- Set networkTimeoutSeconds to 5 for API calls

Verify: Build the client. Serve with preview. Install as PWA. API calls go through network. Static assets are cached.
```

### Step 4.4 — Database migrations ✅ verified — dropped and recreated the local dev DB, ran `pnpm --filter @training-pal/server migrate`, confirmed all 4 tables recreated correctly

```prompt
Set up Drizzle migration workflow for production database management.

Update apps/server/drizzle.config.ts:
- Set out directory to ./drizzle (migration files folder)
- Set dialect to postgresql

Create apps/server/src/db/migrate.ts:
- Import drizzle migrate function
- Run migrations from the ./drizzle directory
- Log success/failure
- Can be run as: tsx src/db/migrate.ts

Generate initial migration:
- Run: pnpm --filter @training-pal/server drizzle-kit generate
- This creates the initial SQL migration file in apps/server/drizzle/

Add scripts to apps/server/package.json:
- "migrate": "tsx src/db/migrate.ts"
- "generate": "drizzle-kit generate"

Verify: Drop and recreate the database. Run pnpm --filter @training-pal/server migrate. Tables are created. App works.
```

---

## Railway Deployment (added — not in original plan)

Deploy the server + Postgres to Railway, and point the Vercel-hosted client at it. Needs a Railway account (external service — user must create/own it).

**Code changes done ✅:**
- `apps/client/src/lib/trpc.ts`: TRPC_URL now resolves from `VITE_API_URL` (unset in dev → relative `/trpc` via the Vite proxy; set in prod → full Railway server URL).
- `apps/server/src/index.ts`: CORS now also allow-lists `CLIENT_ORIGIN` (comma-separated) alongside `localhost:*`, for the production Vercel domain.

1. Create a Railway project, add a PostgreSQL plugin, copy its connection string.
2. Deploy `apps/server` to Railway (root directory `apps/server`, build via its own package.json). Set env vars: `DATABASE_URL` (from step 1), `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`.
3. Run `pnpm migrate` against the Railway Postgres instance (via Railway's shell or a one-off deploy command) to create tables.
4. On the client (Vercel), set `VITE_CLERK_PUBLISHABLE_KEY` and point API calls at the Railway server's public URL (either a `VITE_API_URL` env var consumed by `lib/trpc.ts`, or a Vercel rewrite/proxy to keep relative `/trpc` paths in production too).
5. Update CORS on the server to allow the production Vercel domain (currently only allows `http://localhost:*`).

## Phase 5: Data Migration (optional)

### Step 5.1 — IndexedDB export + server import

```prompt
Build a one-time data migration tool so users can transfer their local IndexedDB data to the server. NOTE: This step must be done while Dexie is still installed (before Step 2.10), or you need to read IndexedDB directly.

Create apps/client/src/utils/exportLocalData.ts:
- Open IndexedDB database "TrainingPalDB" directly (using native IndexedDB API, not Dexie)
- Read all records from templates, sessions, and programCycle object stores
- Return as { templates: [...], sessions: [...], programCycle: {...} | null }

Create apps/server/src/routers/migration.ts:
- migration.importData: protectedProcedure mutation
- Input: { templates, sessions, programCycle } with Zod validation
- In a transaction: insert all templates (with userId), insert all sessions (with userId), upsert programCycle (with userId)
- Skip duplicates by ID

Add migration router to apps/server/src/router.ts.

Add an "Import Local Data" button in apps/client/src/screens/SettingsScreen.tsx:
- On click: call exportLocalData(), then call migration.importData mutation with the result
- Show success/error message
- Only show the button if IndexedDB has data (check if TrainingPalDB exists)

Verify: With existing local data, click import. Data appears in PostgreSQL. All screens show the migrated data.
```

---

## Execution Summary

| Phase | Steps | What changes |
|-------|-------|-------------|
| 0 | 0.1, 0.2 | Project structure only. App unchanged. |
| 1 | 1.1, 1.2, 1.3 | Server created. Client unchanged. |
| 2 | 2.1–2.10 | Client migrated screen-by-screen. Dexie removed. |
| 3 | 3.1, 3.2 | Auth added to both server and client. |
| 4 | 4.1–4.4 | Polish: proxy, errors, PWA, migrations. |
| 5 | 5.1 | Optional data migration tool. |

**Total: 22 steps. Each is a single Claude Code prompt.**

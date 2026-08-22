# Handoff: Training Pal — Nocturne redesign (direction 2a / "1b + 1c timer")

## Overview
A full visual redesign of the Training Pal client (`apps/client/src`). Every existing route
keeps its behavior, data and copy; what changes is the look: from the green-on-near-black
card UI to Nocturne — a desaturated blue-grey ground, blurple accent used as a line and a
glow, hairline rules instead of card fills, and the number you're chasing set larger than
anything else on screen.

**Nothing in this redesign requires a change to routing, tRPC calls, data shapes, or any
hook except one small addition to `useRestTimer` (Stage 5).** That is the reason it can be
shipped incrementally without breaking the app.

## About the design files
`Training Pal - Redesign.dc.html` in this bundle is a **design reference written in HTML**,
not production code. Do not copy its markup into the React app. It is a single page holding
every screen as a 390x844 frame; read the frames, then rebuild each one inside the existing
React + CSS-Modules setup using the components that are already there.

Frames are labelled via `data-screen-label`. The relevant section is the one badged **2a**
(the top-most section, "The whole app in 1b, with 1c's rest timer"). Sections 1a / 1b / 1c
below it are earlier explorations — ignore them except as context.

`Training Pal - Current.dc.html` is a recreation of the app **as it is today**, for before/after
comparison.

## Fidelity
**High fidelity.** Colors, type sizes, weights, letter-spacing, hairline opacities and
control heights in the design file are the intended final values. Match them.

---

## Design tokens

Replace the palette in `src/styles/theme.css`. Keep every variable **name** so no consuming
CSS module breaks; change only the values.

| Variable | Now | Becomes | Note |
| --- | --- | --- | --- |
| `--bg-primary` | #0a0a0f | **#161826** | the one ground; there is no second surface |
| `--bg-secondary` | #141419 | **#161826** | flat — cards are gone |
| `--bg-tertiary` | #1e1e26 | **#1b1d2c** | sheets and dialogs only |
| `--bg-input` | #1a1a22 | **transparent** | inputs become underlined, not filled |
| `--text-primary` | #f0f0f5 | **#e9e9ed** | |
| `--text-secondary` | #8a8a9a | **rgba(233,233,237,.55)** | |
| `--text-muted` | #5a5a6a | **rgba(233,233,237,.45)** | |
| `--accent` | #22c55e | **#9184d9** | blurple |
| `--accent-hover` | #16a34a | **rgba(145,132,217,.12)** | now a *tint*, not a darker fill |
| `--accent-danger` | #ef4444 | **#d98484** | desaturated to match the ramp |
| `--border` | #2a2a35 | **rgba(233,233,237,.16)** | |
| `--border-focus` | #22c55e | **#9184d9** | |
| `--radius` | 14px | **8px** | |
| `--radius-sm` | 10px | **8px** | |
| `--radius-lg` | 20px | **8px** | (20px stays only on the bottom sheet) |

New variables to add:

```css
--hairline: rgba(233, 233, 237, 0.09);          /* row separators */
--accent-tint: rgba(145, 132, 217, 0.14);       /* selected chip fill */
--accent-text-on-tint: #d2cefd;                 /* label on that tint */
--accent-glow: 0 0 8px rgba(145, 132, 217, 0.8);
```

Type: swap the system stack for **Inter** (weights 400/500 only — nothing is 600 or 700 any
more; hierarchy is size and space). Add to `index.html`:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap">
```

Type scale actually used: 42px/500/-0.025em (page title) · 34px (editor name field) ·
25px (live exercise name) · 19px (row number) · 16px/15px (row title) · 13px · 12px ·
11px/500/0.1em-uppercase (section label) · 10px (unit caption). **84px/500/-0.04em** for the
live weight and reps; **62px** for the rest countdown. All numerals get
`font-variant-numeric: tabular-nums`.

Icons: replace the inline SVGs with **Phosphor** (`@phosphor-icons/react`), regular weight,
fill weight for the active nav item.

---

## Staged plan (each stage ships on its own and is independently revertable)

### Stage 1 — tokens only. No .tsx touched.
Edit `theme.css` values + add Inter. The whole app reskins at once and stays fully
functional; it will look transitional (still cards, still bottom tabs) but nothing breaks.
This is the safest possible first commit and the one that does 60% of the visual work.

Also in `theme.css`:
- `button { font-weight: 500 }` (was 600), `min-height: 44px` stays.
- `button:active { transform: scale(0.97) }` — keep, it reads well.
- `.page-title` → `font-size: 42px; font-weight: 500; letter-spacing: -0.025em`.
- inputs → `background: transparent; border: none; border-bottom: 1px solid var(--border); border-radius: 0; padding: 0 0 9px`.
- add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`.

### Stage 2 — primitives.
`components/common/Button.module.css`: the primary variant becomes an **outline**, not a fill
— `background: transparent; border: 1px solid var(--accent); color: var(--accent)`, hover
`background: var(--accent-hover)` (now the tint). Secondary uses `--border` / `--text-primary`.
Danger uses `#d98484`. Bump full-width buttons to `min-height: 52px` (56px for the single
primary action on live/rest/sign-in). `NumberInput.module.css` loses its filled box.

### Stage 3 — dissolve the cards. CSS only, no JSX.
`TemplateCard`, `CycleEditor` sequence items, `SetRow`, `ExerciseFormRow` all currently draw
`background: var(--bg-secondary)` + radius + padding. Replace with:
```css
background: none;
border: none;
border-bottom: 1px solid var(--hairline);
border-radius: 0;
padding: 13px 0;
```
Section rules (between Rotation and Workouts, and above the sticky action pad) use the
fading hairline — this is Nocturne's signature and worth a shared utility class:
```css
.rule {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--border) 40px,
                              var(--border) calc(100% - 40px), transparent);
}
```
Row anatomy on Today / Program: `[title + meta]  [big tabular number]  [x reps]`, flex with
`gap: 12px`, `align-items: baseline`.

### Stage 4 — the live logger. Small JSX reorder in `LiveWorkoutScreen`.
The set editor becomes: exercise name (25px) → "set 2 of 3 · last time …" → the **84px
weight and reps pair** side by side, split by a 44px vertical hairline → a 2x2 grid of
58px-tall −/+ buttons under them (weight left, reps right) → the RIR selector as three
50px chips → completed/planned sets as hairline rows. The primary "Log set" button moves
into a fixed bottom pad:
```css
position: absolute; left: 0; right: 0; bottom: 0;
padding: 14px 20px calc(22px + var(--safe-bottom));
background: linear-gradient(to top, var(--bg-primary) 55%, transparent);
```
`RirSelector` keeps its API; only its CSS changes (selected = `--accent-tint` fill +
`--accent` border + `--accent-text-on-tint` label, with the word failure/hard/solid under
the digit). `ExerciseProgress` collapses to the "24:07 ——— 2 / 5" hairline strip at the top.

### Stage 5 — rest as a full-screen ring. The only real API change.
`useRestTimer` currently returns `{ remaining, isActive, start, cancel }` and does **not**
expose the duration it was started with, so the ring has no denominator. Add it:
```ts
const [total, setTotal] = useState(0);
// in start(): setTotal(durationSeconds)
return { remaining, total, isActive, start, cancel };
```
Additive — every existing caller keeps working. Then `RestTimerDisplay` renders a 238px
SVG ring (r=110, circumference ~691, `stroke-dasharray: 691`,
`stroke-dashoffset: 691 * (1 - remaining / total)`, `transform: rotate(-90deg)`,
`filter: drop-shadow(0 0 8px rgba(145,132,217,.85))`) with 62px tabular time centred in it,
"RESTING" at 10px/0.14em under it, then a fading rule, "UP NEXT", the next set at 26px, and
a coaching line. Bottom pad: [+30s] [Edit set n] side by side at 48px, then the 56px
outlined "Skip rest, start set n".
Do **not** animate the ring with a CSS keyframe — drive `strokeDashoffset` from `remaining`
so it stays correct after the visibility re-sync the hook already does.

### Stage 6 — nav to the top. The riskiest change; ship it last and alone.
`BottomTabBar` becomes `TopNav`: three 36px icon buttons (target / list-checks /
sliders-horizontal), right-aligned on the same row as the date/context label, active one at
`--accent` on an `--accent-tint` 8px square, the others at `--text-secondary`. Keep the
`NavLink` + `tabs` array exactly as-is — only the wrapper markup and CSS change, so routing
is untouched.

Then in `theme.css`, `--tab-bar-inset` no longer needs to reserve bottom space for the bar,
but the sticky action pad does. Rename intent rather than deleting the variable:
`--tab-bar-height: 0px` and give `.page` `padding-bottom: calc(88px + var(--safe-bottom))`.
Deleting `--tab-bar-inset` outright will break `AppLayout.module.css` and several screens —
leave the variable in place.

**Mitigation:** keep `BottomTabBar.tsx` in the tree behind a one-line switch in
`AppLayout` for a release, so reverting is a single-word change:
```tsx
{TOP_NAV ? <TopNav /> : <BottomTabBar />}
```
Note the top nav sits **inside** each page's header row in the design, not in `AppLayout` —
so `AppLayout` renders `<TopNav />` only if you'd rather keep it global. Either works; the
design assumes it's global and that each screen supplies the left-hand context label.

### Stage 7 — sign in.
Clerk stays. Only the `appearance.variables` change:
`colorPrimary: '#9184d9'`, `colorBackground: '#161826'`, `colorInputBackground: 'transparent'`,
`colorInputText: '#e9e9ed'`, `colorText: '#e9e9ed'`, `colorTextSecondary: 'rgba(233,233,237,.55)'`,
`borderRadius: '8px'`. The design's headline ("Log the set. Nothing else.") and the underlined
fields are what you get by adding `appearance.elements` overrides plus a heading above
`<SignIn>` — treat the frame as the target, not as a demand to replace Clerk.

---

## Screen-by-screen mapping

| Design frame (label in 2a) | Files to change | Stage |
| --- | --- | --- |
| Today | `TodayScreen.module.css`, minor JSX for the stats strip | 1, 3 |
| Today · switch | `TodayScreen.*` — picker becomes a bottom sheet on `--bg-tertiary`, radius `20px 20px 34px 34px` | 3 |
| Today · done | `TodayScreen.*` — 76px tonnage figure, per-lift +2.5 / held column | 3 |
| Today · empty | `EmptyState.*` — left-aligned, 36px head, numbered 01/02/03 steps | 3 |
| Live workout | `LiveWorkoutScreen.*`, `SetRow.*`, `RirSelector.*`, `ExerciseProgress.*` | 4 |
| Rest | `RestTimerDisplay.*`, `hooks/useRestTimer.ts` | 5 |
| Abandon | `ConfirmDialog.*` — `--bg-tertiary`, 8px radius, stacked buttons, danger outlined | 2 |
| Program | `ProgramScreen.*`, `CycleEditor.*`, `TemplateCard.*` | 3 |
| Workout editor | `TemplateEditorScreen.*`, `ExerciseFormRow.*`, `NumberInput.*` | 2, 3 |
| Settings | `SettingsScreen.*` | 1, 3 |
| Sign in | `SignInScreen.*` | 7 |
| Chrome | `AppLayout.*`, `BottomTabBar.*` -> `TopNav.*`, `theme.css` | 1, 6 |

## Two things the design assumes but the code doesn't have yet
1. **The editor collapses exercises past the first** to a one-line summary
   ("02  Incline DB Press   3 x 26kg  v"). `ExerciseFormRow` currently renders every
   exercise fully expanded. This needs one piece of local state in
   `TemplateEditorScreen` (`expandedId`) and an early-return summary row in
   `ExerciseFormRow`. Behavior-only addition, no data change.
2. **The History nav icon** (`list-checks`) in the top nav has no route — the README
   mentions History but `App.tsx` has none. Until it exists, point that slot at
   `/program` or drop it to two icons.

## What NOT to change
Routes and redirects in `App.tsx`; all tRPC queries/mutations; `workoutDraft`,
`predictions`, `sessions`, `templates` utils; `exerciseConfigKey`/`exerciseNameKey` sync
logic in `TemplateEditorScreen`; `useStopwatch`; `AuthGuard`; `ErrorBoundary`. The
redesign touches presentation only.

## Suggested commit sequence
```
1  chore(theme): retarget tokens to Nocturne, add Inter
2  refactor(ui): outline buttons, underline inputs
3  refactor(ui): replace cards with hairline rows
4  feat(live): big-number set logger with bottom action pad
5  feat(rest): full-screen countdown ring (+ total from useRestTimer)
6  feat(nav): move tab bar to top icon row (revertable via TOP_NAV)
7  chore(auth): Clerk appearance on Nocturne tokens
```
Verify after each: Today with an empty rotation, Today mid-cycle, a live workout through a
full rest cycle, the editor's cross-template exercise sync, and the abandon flow.

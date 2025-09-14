# GainLog

Lightweight fitness tracking app built with **Svelte + Vite** on the frontend and a simple **Express + PostgreSQL** backend. GainLog lets you:

- Create (or reuse) a user by name
- Log workouts (exercise, sets, reps, weight, body part)
- Automatically record workout date
- View and edit past workouts through a built‑in calendar
- Add new workouts retroactively for any selected date

> Focus now is core tracking. Future plans include AI coaching, progress analytics, and richer workout templates.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Svelte 5 + Vite |
| Backend API | Express (custom, inside `src/backend`) |
| Database | PostgreSQL |
| ORM | Raw SQL via `pg` Pool |
| Styling | Minimal inline + basic CSS |

## Project Structure

```
src/
	App.svelte          # Main UI (home + tracking + calendar/history)
	backend/
		server.js         # Express API server
		db.js             # PostgreSQL connection pool
	lib/                # Reusable Svelte components (placeholder)
	assets/             # Static assets
```

## Features (Current)

- User bootstrap (id persisted in localStorage)
- Real‑time activity timer after name entry
- Workout session entry (exercise / sets / reps / weight / body part)
- “What are we hitting today?” stored as body_part
- Per‑row submit (immediate DB persistence)
- Done confirmation (session close UX)
- Calendar view with:
	- Date selection
	- Historical workouts filtered by day
	- Inline edit + save (PUT)
	- Add new workout for past dates

## Planned / Roadmap

- Delete workouts
- Dashboard analytics (volume, frequency)
- AI suggestions / auto‑generate routines
- Authentication (multi‑device sync)
- Export / import data
- Move to SvelteKit (unified SSR + API)

## Getting Started

### Prerequisites
- Node 18+
- PostgreSQL running locally

### Install
```bash
npm install
```

### Environment Variables
Create `.env` (not committed):
```
PGUSER=postgres
PGHOST=localhost
PGDATABASE=postgres
PGPASSWORD=your_password
PGPORT=5432
PORT=5174
```

> See `.env.example` (add one if not present) for a template.

### Database Tables (expected)
`users`
```
user_id      integer  PK
name         varchar  NOT NULL
```
`workouts`
```
workout_id   integer  PK
user_id      integer  FK -> users.user_id
workout_date date     NOT NULL
reps         integer  NULL
weight       double precision NULL
sets         integer  NULL
body_part    varchar  NOT NULL
exercise     varchar  NOT NULL
```

### Run (Frontend + Backend)
Development (concurrent):
```bash
npm run dev:full
```
Frontend only:
```bash
npm run dev
```
Backend only:
```bash
npm run dev:server
```
App: http://localhost:5173  |  API: http://localhost:5174

### Key NPM Scripts
| Script | Purpose |
|--------|---------|
| `dev` | Run Vite dev server |
| `dev:server` | Run Express API |
| `dev:full` | Run both concurrently |
| `build` | Production build (frontend) |
| `preview` | Preview production build |


## Frontend UX Summary
1. Enter name → user created / loaded
2. Provide body part → sets context
3. Add exercises (inline submit) → immediate persistence
4. Calendar → pick past date → view/edit/add historical rows

## Development Notes
- Inline edits use immutable updates for Svelte reactivity.
- LocalStorage keys: `ft_user_id`, `ft_user_name`.
- Current implementation uses raw SQL; consider migration tool later (e.g., Knex, Prisma). 

## Contributing
1. Fork / clone
2. Create feature branch: `git checkout -b feature/xyz`
3. Commit with conventional messages: `feat:`, `fix:` etc.
4. PR to `main`


## Future Ideas
- AI performance summaries
- Exercise PR tracking & charts
- Habit streaks & reminders
- Export to CSV / mobile PWA



# Active Context

## Current Focus
- Simplified project layout: single pnpm package with `client/`, `backend/`, and `shared/` folders; no workspaces.
- Backend and UI skeletons run via `pnpm dev`, ready for real stream integration and UX polish.

## Recent Decisions
- Removed pnpm workspaces to reduce setup friction; all dependencies now live in the root `package.json`.
- Adopted `tsx` for running the backend in dev, so we avoid ESM loader quirks from `ts-node`.
- Maintained Innertube (`youtubei.js`) ingestion with mock fallback to keep development unblocked without credentials.

## Immediate Next Steps
1. Verify `pnpm install` + `pnpm dev` on a clean machine, ensuring backend and client start smoothly.
2. Harden backend ingestion (error handling, reconnection/backoff) now that the runtime setup is stable.
3. Flesh out operator dashboard UX (filters/search, live status indicators) and document configuration in README/onboarding notes.

## Open Questions
- Whether to persist Innertube visitor data between runs to reduce boot time and API churn.
- When to introduce optional persistence (SQLite) given `better-sqlite3` is now a direct runtime dependency.

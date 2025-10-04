# Active Context

## Current Focus
- Maintain Memory Bank documentation and scaffold the monorepo structure for the YouTube Live chat client.
- Define onboarding flow for Innertube-based chat ingestion and configuration.

## Recent Decisions
- Switch from official YouTube Data API to Innertube (`youtubei.js`) ingestion to avoid quota issues.
- Use Next.js for operator UI and OBS overlay, with a separate backend worker for polling and realtime events.
- Prefer Server-Sent Events for one-way overlay updates; keep WebSocket option in mind for future enhancements.

## Immediate Next Steps
1. Initialize `pnpm` workspace with `apps/client`, `packages/backend`, and `packages/shared` directories. (Scaffolded.)
2. Configure baseline project files: `package.json`, `pnpm-workspace.yaml`, TS configs, linting setup. (Scaffolded.)
3. Stub backend poller using `youtubei.js` to verify dev scripts once dependencies are installed.

## Open Questions
- How to persist or refresh Innertube context data (visitor data, API key) between sessions for reliability.
- Whether to include optional SQLite persistence from the outset or add once basic flow is working.

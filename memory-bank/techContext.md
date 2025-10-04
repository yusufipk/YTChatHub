# Tech Context

## Primary Stack
- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript, styled with Tailwind CSS and optional shadcn/ui components.
- **Backend Worker:** Node.js (Fastify) with `youtubei.js` for Innertube chat ingestion, `better-sqlite3` for persistence, EventEmitter for internal pub/sub.
- **Realtime:** Server-Sent Events for overlay updates; potential future WebSocket support via `ws`.
- **Tooling:** `pnpm` for workspace management, ESLint + Prettier, Zod for schema validation, Vitest/Playwright for testing (to be introduced later).

## Environment & Dependencies
- No official API quota required; ingestion relies on Innertube visitor tokens produced at runtime.
- Required env values: `YOUTUBE_LIVE_ID` (or stream URL), optional overrides for Innertube API key/context if we need to pin versions.
- Local `.env.local` file manages configuration; sample `.env.example` committed for contributors.

## Constraints & Considerations
- Innertube endpoints change occasionally; design ingestion to update keys dynamically and fall back to alternate strategies if responses shift.
- Application expected to run on Windows/macOS/Linux desktops used for streaming; keep dependencies cross-platform and avoid native build steps when possible.
- No external database by default; design backend to operate fully in-process with optional local persistence.

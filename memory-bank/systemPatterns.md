# System Patterns

## Architecture Overview
- **Monorepo Layout:** `pnpm` workspaces with `apps/client` (Next.js dashboard + overlay), `packages/backend` (Node ingestion + realtime gateway), `packages/shared` (types, schemas).
- **Data Flow:**
  1. Backend worker polls YouTube Live chat through the Innertube (youtubei) API, maintaining continuation tokens.
  2. Messages stored in-memory (and optionally SQLite) and emitted over an internal event bus.
  3. Client dashboard fetches chat via HTTP (React Query) and pushes selection back via REST.
  4. Overlay page listens to Server-Sent Events stream for the currently highlighted message.
- **Realtime Delivery:** SSE chosen for one-directional updates to OBS browser source; can swap to WebSocket if bidirectional control is required later.
- **Configuration:** Environment variables drive stream IDs and optional auth tokens; local secrets persisted in `.env.local` or config files.

## Key Patterns & Practices
- Abstract ingestion behind an interface so alternate providers (official API, headless browser) can be swapped in quickly.
- Cache Innertube visitor data and API keys locally to reduce startup latency and handle rotations gracefully.
- Use Zod schemas in shared package to validate external responses and internal payloads.
- Centralized error reporting/logging with structured logs for monitoring during streams.
- Graceful degradation: exponential backoff on fetch failures, last-known overlay message cached to disk to survive restarts.

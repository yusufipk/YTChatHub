# System Patterns

## Architecture Overview
- **Project Layout:** Single pnpm package with three top-level folders: `client/` (Next.js dashboard + overlay), `backend/` (Node ingestion + realtime gateway), and `shared/` (typescript definitions shared between both).
- **Data Flow:**
  1. Backend worker polls YouTube Live chat through the Innertube (`youtubei.js`) API, maintaining continuation tokens.
  2. Messages are stored in-memory (optionally persisted later) and emitted over an internal event bus.
  3. Client dashboard fetches chat data via REST and pushes selection updates via REST.
  4. Overlay page consumes a Server-Sent Events stream to stay in sync with the selected message.
- **Realtime Delivery:** SSE for one-directional updates to OBS browser source; leave room to switch to WebSockets if we need bidirectional control later.
- **Configuration:** `.env.local` (or process env) supplies `YOUTUBE_LIVE_ID` and optional Innertube overrides; backend picks mock mode automatically when unset.

## Key Patterns & Practices
- Abstract ingestion behind a module (`backend/src/ingestion/youtubei.ts`) so alternate providers (official API, headless browser) can be swapped in quickly.
- Cache Innertube visitor data and API keys locally when we extend functionality, keeping startup fast and resilient to key rotations.
- Use shared TypeScript definitions via the `@shared` path alias to maintain type safety across backend and client.
- Centralized logging in the backend with structured payloads for easier debugging during long streams.
- Graceful degradation: backoff strategies for fetch failures and mock-data fallback keep the UI usable even without credentials.

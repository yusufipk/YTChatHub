# System Patterns

## Architecture Overview
- **Project Layout:** Single pnpm package with three top-level folders: `client/` (Next.js dashboard + overlay + Direction Studio), `backend/` (Node ingestion + realtime gateway + search API), and `shared/` (typescript definitions shared between both).
- **Data Flow:**
  1. Backend worker polls YouTube Live chat through the Innertube (`youtubei.js`) API, maintaining continuation tokens.
  2. Messages are stored in-memory (optionally persisted later) and emitted over an internal event bus.
  3. Client dashboard fetches chat data via REST and pushes selection updates via REST.
  4. Direction Studio performs advanced filtering via `/chat/messages` with query parameters.
  5. Overlay page consumes a Server-Sent Events stream to stay in sync with the selected message.
- **Realtime Delivery:** SSE for one-directional updates to OBS browser source; Direction Studio uses polling with intelligent auto-refresh and request abort control.

## Key Patterns & Practices
- Abstract ingestion behind a module (`backend/src/ingestion/youtubei.ts`) so alternate providers (official API, headless browser) can be swapped in quickly.
- Cache Innertube visitor data and API keys locally when we extend functionality, keeping startup fast and resilient to key rotations.
- Use shared TypeScript definitions via the `@shared` path alias to maintain type safety across backend and client.
- Centralized logging in the backend with structured payloads for easier debugging during long streams.
- Graceful degradation: backoff strategies for fetch failures and mock-data fallback keep the UI usable even without credentials.
- **Search Architecture**: Backend filtering with query parameter validation, client-side debouncing, and request abort control for optimal performance.
- **State Management**: Centralized filter state with debounced snapshots and race condition prevention in Direction Studio.
- **Auto-Refresh Pattern**: Visibility API integration with intelligent polling intervals and request deduplication.

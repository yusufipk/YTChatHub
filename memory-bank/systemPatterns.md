# System Patterns

## Architecture Overview
- **Project Layout:** Single pnpm package with three top-level folders: `client/` (Next.js dashboard + overlay), `backend/` (Node ingestion + realtime gateway), and `shared/` (typescript definitions shared between both).
- **Data Flow:**
  1. Backend worker polls YouTube Live chat through the Innertube (`youtubei.js`) API, maintaining continuation tokens.
  2. Messages are stored in-memory (optionally persisted later) and emitted over an internal event bus.
  3. Client dashboard fetches chat data via REST and pushes selection updates via REST.
  4. Overlay page consumes a Server-Sent Events stream to stay in sync with the selected message.
- **Realtime Delivery:** SSE for one-directional updates to OBS browser source; leave room to switch to WebSockets if we need bidirectional control later.

## Key Patterns & Practices
- Abstract ingestion behind a module (`backend/src/ingestion/youtubei.ts`) so alternate providers (official API, headless browser) can be swapped in quickly.
- Cache Innertube visitor data and API keys locally when we extend functionality, keeping startup fast and resilient to key rotations.
- Use shared TypeScript definitions via the `@shared` path alias to maintain type safety across backend and client.
- Centralized logging in the backend with structured payloads for easier debugging during long streams.
- Graceful degradation: backoff strategies for fetch failures and mock-data fallback keep the UI usable even without credentials.
- **Timezone Context Pattern**: React context provider (`TimezoneContext`) manages browser timezone detection and shares across components for consistent timestamp formatting.
- **Selection State Management**: Three-tier visual state system (active/selected, normal, previously-selected) with CSS class composition for clear user feedback.
- **Timestamp Resolution**: Backend uses `timestamp_usec` (microseconds) from YouTube data, converts to milliseconds, and frontend formats in user's local timezone.
- **Image Proxy Pattern**: Backend `/proxy/image` endpoint caches YouTube CDN images (avatars, badges, emojis) with MD5-hashed keys, 24hr TTL, and 1000-image LRU eviction. Returns stale cache on 429 errors or network failures. Frontend `proxyImageUrl()` helper transparently rewrites YouTube CDN URLs to use proxy.
- **Smart Message Storage**: Intelligent trimming system preserves all superchats and memberships for entire session while limiting regular messages to 200 most recent. Trimming occurs on every message addition to prevent special message loss. Uses order-preserving algorithm that identifies special messages by index and removes only oldest regular messages.
- **Overlay Animation System**: Two-state approach with `message` (backend data) and `displayMessage` (UI state) enables smooth fade transitions when switching messages. 300ms fade-out followed by content swap and automatic fade-in.
- **Super Sticker Parsing**: Backend `extractSuperChatInfo()` function detects super stickers via `item.sticker` array. Extracts largest image (144x144px) from sticker thumbnails array, handles protocol-relative URLs by converting to HTTPS, and captures accessibility labels for screen readers. Frontend conditionally renders stickers with error handling that hides broken images via `onError` handler.
- **Leaderboard Badge Parsing**: Backend `extractLeaderboardRank()` function scans `before_content_buttons` array for CROWN icon entries. Extracts rank number from title field using regex pattern `/#(\d+)/`. Returns numeric rank or undefined if not present. Frontend displays badge with crown emoji and rank using golden color scheme for visual prominence.
- **Poll Detection System**: Backend listens for `UpdateLiveChatPollAction` events to detect active polls and emits simple poll state (id + active flag) via SSE. Frontend displays pulsing purple poll indicator in dashboard header when poll is active. Poll closes automatically when backend receives `CloseLiveChatActionPanelAction` or `RemoveBannerForLiveChatCommand` events. Note: YouTube's live chat API does not provide vote percentages even with authentication, so only poll presence is indicated.

# Active Context

## Current Focus
- **Live YouTube integration active**: Backend connects to real YouTube Live chat via Innertube
- **Dark minimalist UI redesign**: Clean dashboard with dark theme (#0a0a0a background), tab-based navigation, grid layout, and minimal spacing
- **Connection flow**: Shows connection prompt on startup, disappears after connecting to YouTube Live stream
- **Rich message parsing**: Full support for superchats, memberships, badges (moderator, member, verified)

## Recent Decisions
- Fixed CORS issues by setting headers on raw response object after `reply.hijack()` for SSE endpoint
- Added `.env` loading via `tsx --env-file=.env` for YouTube Live ID configuration
- Enhanced `ChatMessage` type to include badges, author photos, superchat info, and membership status
- Redesigned dashboard with gradient backgrounds, centered layout, and modern glass-morphism effects
- Separated overlay preview into its own highlighted section that only appears when a message is selected
- Centered overlay message card content so live chat, superchat, and membership boxes align for OBS
- Reworked dashboard grid so live chat runs full-height on the left and super chat/new member panels stack in a centered right column with tuned spacing and clear separation between the stacked cards
- Moved the connection control into the header (inline, centered between logo/title and status) with a compact input width
- Fixed panel heights to fit within the viewport (no page scroll); grid rows split 1fr/1fr with internal lists scrolling so bottom edges are always visible
- Improved parsing so superchat amounts/colors show reliably; overlay and dashboard both display the amount
- Strengthened superchat amount extraction with nested field handling and regex-based fallback; UI now shows amount + currency on overlay and dashboard
- Overlay membership banner now shows the membership level text
- Membership gifts are recognized and included in the New Members list
- Completely redesigned UI to match provided screenshot: minimal dark theme (#0a0a0a bg), compact tabs with counts, tight spacing throughout
- Added connection prompt screen that shows initially and disappears after successful YouTube Live stream connection
- Reduced all padding and gaps to create a more compact, space-efficient layout
- Fixed CLEAR button to appear in bottom-right corner only when a message is selected

## Immediate Next Steps
1. Test with live YouTube stream to verify badge parsing and superchat detection
2. Add search/filter functionality for chat messages
3. Implement error recovery and reconnection logic for stream interruptions
4. Add keyboard shortcuts for quick message selection

## Open Questions
- Whether to add message search/filtering UI controls
- How to handle rate limiting and backoff strategies for long streams
- Whether to persist Innertube visitor data between runs

# Active Context

## Current Focus
- **Live YouTube integration active**: Backend connects to real YouTube Live chat via Innertube
- **Dark minimalist UI redesign**: Clean dashboard with dark theme (#0a0a0a background), tab-based navigation, grid layout, and minimal spacing
- **Connection flow**: Shows connection prompt on startup, disappears after connecting to YouTube Live stream
- **Rich message parsing**: Full support for superchats, memberships, badges (moderator, member, verified)
- **Timezone-aware timestamps**: All message timestamps display in user's local timezone with proper browser detection
- **Visual selection feedback**: Previously selected messages show dimmed state for better user experience
- **Image proxy implemented**: Backend proxies all YouTube CDN images with caching to prevent 429 rate limit errors

## Recent Decisions
- Fixed CORS issues by setting headers on raw response object after `reply.hijack()` for SSE endpoint
- Added `.env` loading via `tsx --env-file=.env` for YouTube Live ID configuration
- Enhanced `ChatMessage` type to include badges, author photos, superchat info, and membership status
- Redesigned dashboard with gradient backgrounds, centered layout, and modern glass-morphism effects
- Separated overlay preview into its own highlighted section that only appears when a message is selected
- Centered overlay message card content so live chat, superchat, and membership boxes align for OBS
- **UI Layout Fixed**: Adjusted the dashboard grid to eliminate unnecessary space and properly align content. The Super Chat card is now left-aligned for better visual consistency.
- **Currency Parsing**: Improved the backend logic to correctly parse Super Chat amounts and currencies, including for non-standard formats like TRY. The hardcoded 'USD' fallback has been removed.
- **Conditional Auto-Scroll**: Implemented intelligent auto-scrolling that only activates when the user is at the bottom of the chat, preventing interruptions when reading older messages.
- **Overlay Redesign**: The overlay has been completely restyled to match the dashboard's compact, dark theme with optimized spacing (30-40% more compact).
- **Overlay Timestamps Removed**: Removed timestamps from overlay for cleaner OBS display while keeping them in dashboard.
- **Gifted Memberships**: The 'Memberships & Milestones' panel now correctly displays the user who purchased the gift, not the recipient.
- **Timestamp Resolution Fixed**: Resolved critical issue where timestamps showed 1970 epoch time. Now uses `timestamp_usec` (microseconds) from YouTube data and converts properly to user's local timezone.
- **Timezone Support**: Implemented browser timezone detection and proper timestamp formatting across dashboard using `Intl.DateTimeFormat` with GMT+3 fallback.
- **Visual Selection States**: Added three-tier visual feedback system - active (selected), normal, and previously-selected (dimmed) states for better user experience.
- **UI Polish**: Fixed pulse animations on initial load, hidden N/A messages.
- **Image Proxy**: Added `/proxy/image` endpoint in backend with in-memory caching (24hr TTL, max 1000 images) to prevent YouTube CDN 429 rate limit errors. All avatars, badges, and emojis now route through proxy with stale-on-error fallback.
- **Message Switching Animation**: Added smooth fade-out/fade-in transitions when switching between selected messages in overlay (300ms duration).
- **Smart Message Preservation**: Implemented intelligent message trimming - regular chat messages limited to 200, but superchats and memberships preserved for entire session. Trimming happens on every message to prevent loss of special messages.

## Immediate Next Steps
1. Test with live YouTube stream to verify badge parsing and superchat detection
2. Add search/filter functionality for chat messages
3. Implement error recovery and reconnection logic for stream interruptions
4. Add keyboard shortcuts for quick message selection
5. Consider persistent cache for images (SQLite or file-based) for better reliability

## Open Questions
- Whether to add message search/filtering UI controls
- Whether to persist Innertube visitor data between runs
- Should image cache be persistent across restarts?

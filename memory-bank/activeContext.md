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
- **UI Layout Fixed**: Adjusted the dashboard grid to eliminate unnecessary space and properly align content. The Super Chat card is now left-aligned for better visual consistency.
- **Currency Parsing**: Improved the backend logic to correctly parse Super Chat amounts and currencies, including for non-standard formats like TRY. The hardcoded 'USD' fallback has been removed.
- **Conditional Auto-Scroll**: Implemented intelligent auto-scrolling that only activates when the user is at the bottom of the chat, preventing interruptions when reading older messages.
- **Overlay Redesign**: The overlay has been completely restyled to match the dashboard's compact, dark theme. It now displays new member announcements.
- **Gifted Memberships**: The 'Memberships & Milestones' panel now correctly displays the user who purchased the gift, not the recipient.

## Immediate Next Steps
1. Test with live YouTube stream to verify badge parsing and superchat detection
2. Add search/filter functionality for chat messages
3. Implement error recovery and reconnection logic for stream interruptions
4. Add keyboard shortcuts for quick message selection

## Open Questions
- Whether to add message search/filtering UI controls
- How to handle rate limiting and backoff strategies for long streams
- Whether to persist Innertube visitor data between runs

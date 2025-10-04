# Active Context

## Current Focus
- **Live YouTube integration active**: Backend connects to real YouTube Live chat via Innertube
- **Enhanced UI**: Modern dashboard with centered layout, gradient backgrounds, and comprehensive chat features
- **Rich message parsing**: Full support for superchats, memberships, badges (moderator, member, verified)

## Recent Decisions
- Fixed CORS issues by setting headers on raw response object after `reply.hijack()` for SSE endpoint
- Added `.env` loading via `tsx --env-file=.env` for YouTube Live ID configuration
- Enhanced `ChatMessage` type to include badges, author photos, superchat info, and membership status
- Redesigned dashboard with gradient backgrounds, centered layout, and modern glass-morphism effects
- Separated overlay preview into its own highlighted section that only appears when a message is selected

## Immediate Next Steps
1. Test with live YouTube stream to verify badge parsing and superchat detection
2. Add search/filter functionality for chat messages
3. Implement error recovery and reconnection logic for stream interruptions
4. Add keyboard shortcuts for quick message selection

## Open Questions
- Whether to add message search/filtering UI controls
- How to handle rate limiting and backoff strategies for long streams
- Whether to persist Innertube visitor data between runs

# Search & Filtering Feature Plan

## Objective
Deliver fast, intuitive controls for locating chat messages inside the operator dashboard while preserving the current real-time experience and OBS overlay integration.

## Background
- Messages are stored transiently in the backend (`store: ChatMessage[]`) and surfaced through `/chat/messages` plus SSE for overlay updates.
- The dashboard currently renders three panels (chat, super chats, memberships) with intelligent auto-scroll and selection controls, but no filtering or search UI.
- ActiveContext and Progress docs list search/filtering as the next major feature.

## Scope
**In scope**
- Text search across normalized message content (including runs data when available).
- Filters for message category (regular, super chat, membership), author, and badge type.
- Lightweight UI additions within the existing dashboard shell.
- Query parameter extensions to `/chat/messages` with backwards compatibility.

**Out of scope (for now)**
- Persisting filters across browser sessions.
- Full-text indexing or database storage.
- Overlay-specific filtering beyond current selection flow.

## Success Criteria
- Operators can combine search text with any subset of filters and receive matching results within 200 ms for <= 500 cached messages.
- Backend returns consistent, paginated responses even when filters are applied (still capped at `MAX_MESSAGES`).
- Auto-scroll remains predictable; manual scroll state is respected when filters narrow results.
- Overlay selection continues to work on filtered results without regression.

## Requirements
1. **Functional**
   - `GET /chat/messages` accepts `search`, `type`, `author`, and `badges` query parameters.
   - Frontend debounces text search (300 ms target) and reflects active filters in the UI.
   - Clear reset action to restore the unfiltered feed.
2. **UX**
   - Controls fit above the tabset without crowding; collapse on screens < 1024px wide.
   - Active filters visually indicated (e.g., badge counter, subtle highlight).
3. **Reliability**
   - Backend gracefully ignores malformed query values and returns full set.
   - SSE stream remains unaffected by filter operations.

## Technical Approach
### Backend
- Parse query parameters using Fastify typed schemas for validation.
- Normalize filter comparisons (lowercase text, trimmed strings).
- Extend badge filtering to match against badge `type` and `label` keywords.
- Preserve existing mock mode by running filters over generated messages.
- Guard against expensive operations by short-circuiting when no filters supplied.

### Frontend
- Centralize filter state in a dedicated hook (`useMessageFilters`) colocated with dashboard state.
- Compose query strings via `URLSearchParams`, omitting empty values.
- Integrate with existing polling or hook logic so filters re-fetch messages and react to SSE updates without desync.
- Ensure selected message remains highlighted even when current filter hides it (display a notice and allow clearing filters).

## Implementation Roadmap
### Phase 1 – Baseline Search & Type Filter
- Backend: add query support for `search` + `type`, unit test new helper functions.
- Frontend: add search input, message-type segmented control, debounce, loading state.
- QA: verify with mock data and live stream (if credentials available).

### Phase 2 – Author & Badge Filters
- Backend: extend filtering helpers for author substring matching and badge set intersection.
- Frontend: add author input + badge checkboxes (moderator, member, verified).
- UX: show live pill summary (e.g., "Type: Super Chat • Badge: Moderator").

### Phase 3 – Polish & Resilience
- Preserve scroll intent when filters change (only auto-scroll if user is at bottom and results grow).
- Add `%` progress or empty-state component with CTA to clear filters.
- Optional: persist last-used filters in session storage.
- Document API contract in README or follow-up doc (pending user approval per contribution guidelines).

## Testing Strategy
- **Unit** (backend): filter predicate tests covering combinations + edge cases (case sensitivity, empty strings, missing fields).
- **Unit** (frontend): hook tests for debounce timing and query generation.
- **Integration**: Cypress/Playwright smoke scenario for applying multiple filters while selecting messages.
- **Manual**: Long-running mock mode to confirm no memory leaks or degraded overlay updates.

## Risks & Mitigations
- **Performance degradation**: Keep filtering in-memory and short-circuit early; monitor via `/health` endpoint additions if needed.
- **State desync**: Provide reconnection logic if SSE drops while filters active.
- **User confusion**: Prominent "Clear filters" button and empty-state guidance.

## Open Questions
1. Should we expose pagination or continuation tokens when filters are active?
   - User Answer: Yes, we should also bold the text filtered in message.
2. Do we allow regex or advanced search operators, or keep it simple substring?
   - User Answer: Yes, we should allow regex and advanced search operators.
3. Should filtered results also drive overlay suggestions, or remain independent?
   - User Answer: No, build independent it. Create a new page as called direction (for the studio team to use).
4. Where should API documentation live (README vs dedicated docs) once implemented?
   - User Answer: In the memory-bank/contribution-conents/api folder.

## Dependencies
- Existing `ChatMessage` type must already include runs, badges, and membership metadata (confirmed in ActiveContext).
- No new packages are required; rely on native JS utilities and minimal CSS additions.

## Definition of Done
- Feature flagged off? (No – release once tested.)
- Updated Memory Bank (Active Context/Progress) after implementation as per contribution policy.
- Manual verification recorded in progress log.

# Search and Filtering Implementation Plan

## Overview
This document outlines the plan for implementing search and filtering functionality for chat messages in the YTChatHub dashboard. The feature will allow users to find specific messages quickly by searching text content and filtering by message types.

## Current State Analysis

### Backend
- Messages are stored in a simple array (`store: ChatMessage[]`)
- The `/chat/messages` endpoint returns all messages without any filtering capabilities
- No search or filtering endpoints currently exist

### Frontend
- Dashboard displays messages in three separate panels (regular messages, superchats, members)
- No search input or filtering controls currently exist
- Messages are displayed in chronological order with auto-scroll functionality

## Implementation Plan

### 1. Backend Enhancements

#### API Endpoint Extension
Add query parameters to the existing `/chat/messages` endpoint to support filtering:

```
GET /chat/messages?type=superchat&search=hello&author=John
```

Query parameters:
- `search` - Text search across message content
- `type` - Filter by message type (regular, superchat, membership)
- `author` - Filter by author name
- `badges` - Filter by badge types (moderator, member, verified)

#### Implementation Steps
1. Modify the `/chat/messages` route to accept query parameters
2. Implement filtering logic in the backend
3. Add search functionality that searches across message text content
4. Ensure filtered results are still capped at MAX_MESSAGES (500)

### 2. Frontend Implementation

#### UI Components to Add
1. **Search Input Field** - Text input for searching message content
2. **Filter Controls** - Dropdowns or checkboxes for message type filtering
3. **Author Filter** - Input for filtering by author name
4. **Badge Filter** - Checkboxes for filtering by badge types

#### UI Placement
- Add search and filter controls above the tabbed interface
- Ensure controls are responsive and don't take too much vertical space
- Consider a collapsible filter panel for smaller screens

#### Implementation Steps
1. Add state management for search and filter parameters
2. Implement search input with debouncing to avoid excessive API calls
3. Add filter controls with proper state management
4. Modify the message fetching logic to include search/filter parameters
5. Update the UI to reflect filtered results

### 3. Technical Considerations

#### Performance
- Implement debouncing on search input (300-500ms delay)
- Consider client-side filtering for smaller datasets
- For larger datasets, implement server-side filtering
- Add loading states during search/filter operations

#### User Experience
- Preserve auto-scroll behavior when filtering narrows results
- Clear visual indication when filters are active
- Easy way to reset all filters
- Remember filter settings during session (optional)

## Detailed Implementation

### Backend Changes

#### Route Modification
```typescript
// In backend/src/index.ts
fastify.get('/chat/messages', async (request) => {
  const { search, type, author, badges } = request.query as {
    search?: string;
    type?: 'regular' | 'superchat' | 'membership';
    author?: string;
    badges?: string; // comma-separated list
  };
  
  // Apply filters to store
  let filteredMessages = [...store];
  
  // Text search
  if (search) {
    filteredMessages = filteredMessages.filter(msg => 
      msg.text.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Type filter
  if (type) {
    switch (type) {
      case 'superchat':
        filteredMessages = filteredMessages.filter(msg => msg.superChat);
        break;
      case 'membership':
        filteredMessages = filteredMessages.filter(msg => 
          msg.membershipGift || msg.membershipGiftPurchase
        );
        break;
      case 'regular':
        filteredMessages = filteredMessages.filter(msg => 
          !msg.superChat && !msg.membershipGift && !msg.membershipGiftPurchase
        );
        break;
    }
  }
  
  // Author filter
  if (author) {
    filteredMessages = filteredMessages.filter(msg => 
      msg.author.toLowerCase().includes(author.toLowerCase())
    );
  }
  
  // Badges filter
  if (badges) {
    const badgeTypes = badges.split(',').map(b => b.trim());
    filteredMessages = filteredMessages.filter(msg => 
      msg.badges?.some(badge => badgeTypes.includes(badge.type))
    );
  }
  
  return { messages: filteredMessages };
});
```

### Frontend Changes

#### State Management
```typescript
// In client/app/dashboard/page.tsx
const [searchTerm, setSearchTerm] = useState('');
const [messageTypeFilter, setMessageTypeFilter] = useState<'all' | 'regular' | 'superchat' | 'membership'>('all');
const [authorFilter, setAuthorFilter] = useState('');
const [badgeFilters, setBadgeFilters] = useState<Record<string, boolean>>({
  moderator: false,
  member: false,
  verified: false
});
```

#### Search Component
```typescript
// Add to DashboardPage component
function SearchAndFilterControls() {
  return (
    <div className="search-filter-controls">
      <input
        type="text"
        placeholder="Search messages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      
      <select 
        value={messageTypeFilter} 
        onChange={(e) => setMessageTypeFilter(e.target.value as any)}
        className="filter-select"
      >
        <option value="all">All Messages</option>
        <option value="regular">Regular Messages</option>
        <option value="superchat">Superchats</option>
        <option value="membership">Memberships</option>
      </select>
      
      <input
        type="text"
        placeholder="Filter by author..."
        value={authorFilter}
        onChange={(e) => setAuthorFilter(e.target.value)}
        className="author-filter-input"
      />
      
      <div className="badge-filters">
        <label>
          <input
            type="checkbox"
            checked={badgeFilters.moderator}
            onChange={(e) => setBadgeFilters(f => ({...f, moderator: e.target.checked}))}
          />
          Moderator
        </label>
        {/* Similar for member and verified */}
      </div>
    </div>
  );
}
```

#### Modified Fetch Logic
```typescript
// Update useChatMessages hook
function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  
  // New filter states would be passed as parameters
  const refresh = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters as any).toString();
      const response = await fetch(`${BACKEND_URL}/chat/messages?${params}`);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  // ... rest of implementation
}
```

## Open Questions

1. **Performance Considerations**: 
   - Should we implement client-side or server-side filtering for better performance?
   - What's the expected maximum number of messages in the store at any time?

2. **Search Scope**:
   - Should search include author names only or also message content?
   - Should we search in structured runs (emojis, etc.) as well?

3. **Filter Persistence**:
   - Should filter settings be persisted in localStorage for the session?
   - Should we provide a way to save favorite filter combinations?

4. **UI/UX Design**:
   - How should we handle the case when filters return no results?
   - Should we show the count of filtered results in each tab?
   - What's the best way to organize multiple filter controls without cluttering the UI?

5. **Advanced Features**:
   - Should we support regex search or just simple text matching?
   - Should we add date/time filtering capabilities?
   - Should we implement sorting options (newest first, oldest first, etc.)?

6. **Backend Scalability**:
   - How should we handle search and filtering if the message store grows very large?
   - Should we consider implementing a more sophisticated search index?

7. **Internationalization**:
   - Should search be case-sensitive or insensitive?
   - How should we handle special characters and Unicode in search?

## Implementation Phases

### Phase 1: Basic Search and Filter
- Implement basic text search on message content
- Add message type filtering (regular, superchat, membership)
- Simple UI with search input and type filter dropdown

### Phase 2: Advanced Filtering
- Add author filtering
- Add badge filtering
- Improve UI with collapsible filter panel

### Phase 3: Performance and UX Improvements
- Add debouncing to search input
- Implement loading states
- Add filter persistence
- Improve search algorithm

## Testing Considerations

1. **Unit Tests**:
   - Test filtering logic with various combinations of filters
   - Test search functionality with different text inputs
   - Test edge cases (empty search, special characters, etc.)

2. **Integration Tests**:
   - Test API endpoint with various query parameter combinations
   - Test frontend-backend integration with filters

3. **UI Tests**:
   - Test responsive design of filter controls
   - Test filter state management
   - Test auto-scroll behavior with filtered results

## Dependencies

- No additional dependencies required for basic implementation
- Existing TypeScript types in `@shared/chat` should be sufficient
- May need to add debounce utility function in frontend

## Timeline

- **Phase 1**: 2-3 days
- **Phase 2**: 2-3 days
- **Phase 3**: 2-3 days

Total estimated time: 6-9 days for complete implementation
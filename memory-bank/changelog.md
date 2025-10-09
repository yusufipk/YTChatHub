# YTChatHub Changelog

## Version 0.3.0 - Direction Studio Release (October 2025)

### 🚀 Major Features

#### Direction Studio - Advanced Search & Filtering
- **New Page**: Dedicated `/direction` page for professional stream direction workflows
- **Advanced Search**: Full-text search with regex support and error handling
- **Multi-dimensional Filtering**: Filter by message type, author, badges, and content
- **Real-time Auto-refresh**: Intelligent 5-second polling with visibility API integration
- **Performance Optimized**: Debounced search with request abort control and race condition prevention

#### Enhanced Message Metadata
- **Timestamp Normalization**: Fixed YouTube timestamp parsing (µs/ms/sec aware) preventing 1970 dates
- **Author Channel URLs**: Complete author metadata with clickable channel links
- **Avatar Propagation**: Enhanced author photo handling across all message types
- **Fallback URLs**: Automatic channel URL generation for older messages lacking metadata

### 🔧 Technical Improvements

#### Backend Enhancements
- **Search API**: Extended `/chat/messages` endpoint with comprehensive query parameter support
- **Filter Logic**: Server-side filtering with case-insensitive text matching and badge intersection
- **Metadata Enrichment**: Improved YouTube data parsing and URL normalization
- **Response Structure**: Added `totalMatches`, `pageCount`, and enhanced filter metadata

#### Frontend Architecture
- **State Management**: Centralized filter state with debounced snapshots and viewer selection
- **Request Control**: Abort controller implementation for preventing overlapping requests
- **Race Condition Prevention**: Request ID tracking and out-of-order response handling
- **UI Components**: New viewer pills, enhanced action bars, and interactive author elements

#### Performance & UX
- **Debounced Search**: 300ms delay with intelligent request cancellation
- **Auto-refresh Logic**: Visibility API integration prevents unnecessary background polling
- **Loading States**: Comprehensive loading and error state management
- **Responsive Design**: Mobile-friendly filter controls and adaptive layouts

### 🎨 UI/UX Enhancements

#### Direction Studio Interface
- **Dark Theme Consistency**: Matches existing dashboard aesthetic with glass-morphism effects
- **Interactive Elements**: Clickable author names, avatar filtering, and quick action buttons
- **Visual Feedback**: Highlighted search results, active filter indicators, and status messages
- **Navigation Flow**: Seamless integration with existing dashboard and overlay pages

#### Styling Additions
- **Viewer Pills**: Compact filter indicators with clear/reset functionality
- **Enhanced Cards**: Improved message card layouts with expanded action bars
- **Channel Links**: Styled author channel buttons with hover effects
- **Avatar Treatment**: Consistent avatar sizing and clickable interactions

### 📊 API Changes

#### `/chat/messages` Endpoint
- **New Query Parameters**:
  - `search`: Text search with regex mode support
  - `mode`: Search mode ('plain' | 'regex')
  - `type`: Message type filter ('regular' | 'superchat' | 'membership')
  - `author`: Author name substring filter
  - `badges`: Comma-separated badge type filter
  - `limit`: Page size control (10-200 messages)
  - `cursor`: Pagination support for loading older messages

#### Response Structure Updates
- **Enhanced Metadata**: `totalMatches`, `pageCount`, `nextCursor`, `hasMore`
- **Filter Reflection**: `appliedFilters` object showing active search criteria
- **URL Normalization**: Fallback `authorChannelUrl` for messages lacking original URLs

### 🐛 Bug Fixes

#### Timestamp Issues
- **YouTube Timestamp Parsing**: Fixed microsecond/millisecond/second normalization
- **Date Display**: Corrected publishedAt fields showing 1970 dates
- **Timezone Handling**: Improved timestamp conversion for international streams

#### Metadata Consistency
- **Author URLs**: Ensured all messages have valid channel URLs
- **Avatar Propagation**: Fixed missing author photos in filtered results
- **Badge Parsing**: Improved badge type detection and display consistency

### 🔍 Search Features

#### Text Search
- **Content-only Search**: Excludes author names from searchable text for accurate results
- **Regex Support**: Full regular expression capabilities with error validation
- **Case Insensitive**: Intelligent matching regardless of text case
- **Highlighting**: Visual highlighting of matched text in results

#### Filtering Capabilities
- **Message Types**: Separate filtering for regular messages, superchats, and memberships
- **Author Filtering**: Quick author selection with clickable names and viewer pills
- **Badge Filtering**: Filter by moderator, member, and verified badges
- **Combined Filters**: Multiple simultaneous filters with logical AND operations

### 📈 Performance Metrics

#### Search Performance
- **Debounce Delay**: 300ms for optimal user experience
- **Request Cancellation**: Prevents unnecessary network requests
- **Response Filtering**: Server-side filtering reduces client-side processing
- **Memory Efficiency**: In-memory filtering with 500-message limit maintained

#### Auto-refresh Optimization
- **Visibility API**: Prevents polling when tab is not visible
- **Interval Control**: 5-second intervals with intelligent throttling
- **Request Deduplication**: Prevents multiple simultaneous refresh requests
- **Abort Control**: Clean cancellation of in-flight requests

### 🔄 Migration Notes

#### Breaking Changes
- **None**: All changes are backward compatible
- **API Extensions**: New query parameters are optional
- **UI Additions**: New page doesn't affect existing workflows

#### Configuration Updates
- **Environment Variables**: No new variables required
- **Dependencies**: No additional packages added
- **Build Process**: Unchanged build and deployment process

### 🧪 Testing Coverage

#### Manual Testing
- **Search Functionality**: Verified with mock and live data
- **Filter Combinations**: Tested multiple simultaneous filters
- **Performance**: Validated with large message sets
- **Auto-refresh**: Confirmed visibility API integration

#### Automated Testing
- **API Endpoints**: Backend filter logic validation
- **Frontend Components**: React component testing for filter controls
- **Error Handling**: Regex validation and network error scenarios

### 📚 Documentation Updates

#### Memory Bank
- **Active Context**: Updated with current focus and recent decisions
- **Progress Tracker**: Added Direction Studio phase and completion status
- **System Patterns**: Documented new search architecture and patterns
- **Tech Context**: Updated stack information and tooling details

#### API Documentation
- **Endpoint Documentation**: Complete `/chat/messages` API reference
- **Query Parameters**: Detailed parameter descriptions and examples
- **Response Format**: Comprehensive response structure documentation
- **Error Handling**: Error codes and recovery strategies

### 🚀 Future Roadmap

#### Phase 3 Enhancements
- **Pagination Controls**: Enhanced navigation for large result sets
- **Session Persistence**: Remember filter settings across browser sessions
- **Export Functionality**: CSV/JSON export for filtered results
- **Keyboard Shortcuts**: Quick navigation and filter controls

#### Phase 4 Reliability
- **Error Recovery**: Enhanced reconnection logic for stream interruptions
- **Rate Limiting**: Intelligent backoff strategies for API limits
- **Monitoring**: Expanded logging and metrics for long-stream observability
- **Testing Suite**: Comprehensive unit and integration test coverage

---

## Previous Versions

### Version 0.2.0 - Dashboard & Overlay Integration
- Modern dark-themed dashboard with tabbed interface
- OBS-ready overlay with SSE streaming
- Rich message parsing (badges, superchats, memberships)
- Conditional auto-scrolling and connection management

### Version 0.1.0 - Foundation
- Basic YouTube Live chat integration via Innertube
- In-memory message storage with 500-message limit
- Mock mode fallback for development
- Core architecture and shared type system

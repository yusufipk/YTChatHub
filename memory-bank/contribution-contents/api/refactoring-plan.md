# API Structure Refactoring Plan

## Overview

This document outlines a comprehensive refactoring plan for the YTChatHub API structure to improve maintainability, scalability, and developer experience. The current API implementation in [backend/src/index.ts](file:///Users/aliemrevezir/Library/Mobile Documents/com~apple~CloudDocs/GitHub/YTChatHub/backend/src/index.ts) has grown organically and would benefit from a more structured approach.

## Current State Analysis

### Strengths
- Functional implementation with all required features
- Clear separation of concerns between chat ingestion and API endpoints
- Proper error handling and validation
- Good performance with message limiting and pagination
- Well-typed interfaces shared between frontend and backend

### Areas for Improvement
1. **File Organization**: All API endpoints are in a single file
2. **Route Organization**: Endpoints are defined inline without clear grouping
3. **Middleware Usage**: Limited use of Fastify's plugin system
4. **Error Handling**: Inconsistent error response formats
5. **Validation**: Missing structured validation for request parameters
6. **Documentation**: No formal API documentation
7. **Testing**: No unit tests for API endpoints

## Refactoring Goals

1. **Modular Route Structure**: Organize endpoints into logical modules
2. **Consistent Error Handling**: Standardize error responses across all endpoints
3. **Structured Validation**: Implement request validation using Zod schemas
4. **Improved Middleware**: Leverage Fastify's plugin system for cross-cutting concerns
5. **API Documentation**: Generate documentation from code
6. **Test Coverage**: Add unit tests for all API endpoints
7. **Type Safety**: Enhance TypeScript usage throughout

## Proposed Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── routes.ts
│   │   │   ├── schemas.ts
│   │   │   └── handlers.ts
│   │   ├── overlay/
│   │   │   ├── routes.ts
│   │   │   ├── schemas.ts
│   │   │   └── handlers.ts
│   │   ├── health/
│   │   │   ├── routes.ts
│   │   │   └── handlers.ts
│   │   └── index.ts
│   ├── ingestion/
│   │   └── youtubei.ts
│   ├── middleware/
│   │   ├── cors.ts
│   │   ├── error-handler.ts
│   │   └── logger.ts
│   ├── utils/
│   │   ├── message-filter.ts
│   │   └── validation.ts
│   ├── types/
│   │   └── api.ts
│   └── index.ts
├── tests/
│   ├── api/
│   │   ├── chat.test.ts
│   │   ├── overlay.test.ts
│   │   └── health.test.ts
│   └── utils/
│       └── message-filter.test.ts
└── docs/
    └── api.md
```

## Implementation Phases

### Phase 1: Foundation Setup

**Objectives:**
- Establish modular directory structure
- Configure Fastify with plugins
- Implement consistent error handling
- Set up logging middleware

**Tasks:**
1. Create new directory structure
2. Move middleware to separate files
3. Implement centralized error handler
4. Add structured logging
5. Configure Fastify plugins

### Phase 2: Route Modularization

**Objectives:**
- Extract routes into logical modules
- Implement schema validation
- Standardize response formats

**Tasks:**
1. Create chat module with routes, schemas, and handlers
2. Create overlay module with routes, schemas, and handlers
3. Create health module
4. Implement request/response validation
5. Standardize error responses

### Phase 3: Enhanced Functionality

**Objectives:**
- Improve message filtering capabilities
- Add pagination improvements
- Implement rate limiting
- Add request logging

**Tasks:**
1. Refactor message filtering logic
2. Enhance pagination with cursor-based navigation
3. Implement API rate limiting
4. Add detailed request/response logging

### Phase 4: Documentation & Testing

**Objectives:**
- Create comprehensive API documentation
- Implement unit tests
- Add integration tests
- Set up test coverage reporting

**Tasks:**
1. Generate API documentation
2. Write unit tests for all handlers
3. Create integration tests for API endpoints
4. Set up test coverage reporting
5. Add example requests/responses to documentation

## Detailed API Endpoint Specification

### Health Endpoints

**GET `/health`**
- Description: Check backend health and connection status
- Response:
  ```json
  {
    "status": "ok",
    "messages": 125,
    "selection": "message-id-123",
    "mode": "live",
    "connected": true,
    "liveId": "dQw4w9WgXcQ"
  }
  ```

### Chat Endpoints

**POST `/chat/connect`**
- Description: Connect to a YouTube Live chat
- Request Body:
  ```json
  {
    "liveId": "dQw4w9WgXcQ"
  }
  ```
- Response:
  ```json
  {
    "ok": true,
    "liveId": "dQw4w9WgXcQ"
  }
  ```

**POST `/chat/disconnect`**
- Description: Disconnect from current YouTube Live chat
- Response:
  ```json
  {
    "ok": true
  }
  ```

**GET `/chat/messages`**
- Description: Retrieve chat messages with filtering and pagination
- Query Parameters:
  - `search` (string): Text to search for in messages
  - `mode` (string): Search mode ('plain' | 'regex')
  - `type` (string): Message type filter ('regular' | 'superchat' | 'membership')
  - `author` (string): Filter by author name
  - `badges` (string): Comma-separated list of badge types
  - `cursor` (string): Pagination cursor
  - `limit` (number): Number of messages to return
- Response:
  ```json
  {
    "messages": [...],
    "total": 125,
    "totalMatches": 42,
    "pageCount": 25,
    "nextCursor": "cursor-string",
    "hasMore": true,
    "appliedFilters": {
      "search": "hello",
      "mode": "plain",
      "type": "all",
      "author": null,
      "badges": [],
      "limit": 25
    }
  }
  ```

### Overlay Endpoints

**POST `/overlay/selection`**
- Description: Select a message for overlay display
- Request Body:
  ```json
  {
    "id": "message-id-123"
  }
  ```
- Response:
  ```json
  {
    "ok": true
  }
  ```

**DELETE `/overlay/selection`**
- Description: Clear current overlay selection
- Response:
  ```json
  {
    "ok": true
  }
  ```

**GET `/overlay/stream`**
- Description: Server-Sent Events stream for overlay updates
- Response: Event stream with selection updates

## Migration Strategy

### Approach
1. Implement new structure alongside existing code
2. Route requests to new handlers while maintaining backward compatibility
3. Gradually migrate frontend to use new endpoints
4. Remove old implementation once migration is complete

### Timeline
- **Week 1**: Foundation setup and route modularization
- **Week 2**: Enhanced functionality and validation
- **Week 3**: Documentation and testing
- **Week 4**: Migration and cleanup

## Benefits of Refactoring

1. **Maintainability**: Clear separation of concerns makes code easier to understand and modify
2. **Scalability**: Modular structure allows for easier addition of new features
3. **Developer Experience**: Consistent patterns and comprehensive documentation
4. **Reliability**: Structured validation and error handling reduce bugs
5. **Testability**: Modular design enables comprehensive test coverage
6. **Performance**: Optimized middleware and validation

## Risks and Mitigations

### Risks
1. **Breaking Changes**: Potential for API incompatibility during migration
2. **Performance Regression**: New structure might introduce overhead
3. **Development Time**: Significant time investment required

### Mitigations
1. **Backward Compatibility**: Maintain old endpoints during transition period
2. **Performance Testing**: Benchmark before and after changes
3. **Phased Implementation**: Incremental rollout with monitoring

## Success Criteria

1. All existing functionality preserved
2. Code coverage >80% for API modules
3. Response time <50ms for 95% of requests
4. No breaking changes for existing clients
5. Comprehensive API documentation generated
6. All tests passing in CI pipeline

## Next Steps

1. Create GitHub issue with this plan
2. Set up project board for tracking progress
3. Begin Phase 1 implementation
4. Schedule regular check-ins to monitor progress
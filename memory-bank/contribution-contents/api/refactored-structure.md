# Refactored API Structure

## Overview

This document describes the proposed refactored API structure for YTChatHub. This structure aims to improve maintainability, scalability, and developer experience by organizing the code into logical modules with clear separation of concerns.

## Directory Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── index.ts
│   │   │   ├── routes.ts
│   │   │   ├── schemas.ts
│   │   │   ├── handlers.ts
│   │   │   └── types.ts
│   │   ├── overlay/
│   │   │   ├── index.ts
│   │   │   ├── routes.ts
│   │   │   ├── schemas.ts
│   │   │   ├── handlers.ts
│   │   │   └── types.ts
│   │   ├── health/
│   │   │   ├── index.ts
│   │   │   ├── routes.ts
│   │   │   └── handlers.ts
│   │   └── index.ts
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

## Module Descriptions

### API Modules

#### Chat Module (`backend/src/api/chat/`)

**Purpose**: Handle all chat-related functionality including connecting to YouTube streams, retrieving messages, and managing message storage.

**Files**:
- `index.ts`: Exports the chat module
- `routes.ts`: Defines chat-related routes
- `schemas.ts`: Contains Zod schemas for request/response validation
- `handlers.ts`: Implements route handlers
- `types.ts`: Module-specific TypeScript types

**Endpoints**:
- `POST /chat/connect` - Connect to a YouTube Live chat
- `POST /chat/disconnect` - Disconnect from current YouTube Live chat
- `GET /chat/messages` - Retrieve chat messages with filtering

#### Overlay Module (`backend/src/api/overlay/`)

**Purpose**: Manage the OBS overlay functionality including message selection and SSE streaming.

**Files**:
- `index.ts`: Exports the overlay module
- `routes.ts`: Defines overlay-related routes
- `schemas.ts`: Contains Zod schemas for request/response validation
- `handlers.ts`: Implements route handlers
- `types.ts`: Module-specific TypeScript types

**Endpoints**:
- `POST /overlay/selection` - Select a message for overlay display
- `DELETE /overlay/selection` - Clear current overlay selection
- `GET /overlay/stream` - Server-Sent Events stream for overlay updates

#### Health Module (`backend/src/api/health/`)

**Purpose**: Provide health check endpoints for monitoring backend status.

**Files**:
- `index.ts`: Exports the health module
- `routes.ts`: Defines health-related routes
- `handlers.ts`: Implements route handlers

**Endpoints**:
- `GET /health` - Check backend health and connection status

### Middleware (`backend/src/middleware/`)

**Purpose**: Handle cross-cutting concerns like CORS, error handling, and logging.

**Files**:
- `cors.ts`: Configure CORS settings
- `error-handler.ts`: Centralized error handling middleware
- `logger.ts`: Request/response logging middleware

### Utilities (`backend/src/utils/`)

**Purpose**: Shared utility functions used across multiple modules.

**Files**:
- `message-filter.ts`: Message filtering and search functionality
- `validation.ts`: Shared validation utilities

### Types (`backend/src/types/`)

**Purpose**: Shared TypeScript types used across the application.

**Files**:
- `api.ts`: API-related TypeScript types

## Implementation Details

### Route Registration

Routes will be registered using Fastify's plugin system:

```typescript
// backend/src/api/index.ts
import { FastifyInstance } from 'fastify';
import chatRoutes from './chat/routes';
import overlayRoutes from './overlay/routes';
import healthRoutes from './health/routes';

export async function registerApiRoutes(fastify: FastifyInstance) {
  await fastify.register(chatRoutes, { prefix: '/chat' });
  await fastify.register(overlayRoutes, { prefix: '/overlay' });
  await fastify.register(healthRoutes, { prefix: '/health' });
}
```

### Schema Validation

All request/response validation will use Zod schemas:

```typescript
// backend/src/api/chat/schemas.ts
import { z } from 'zod';

export const ConnectRequestSchema = z.object({
  liveId: z.string().min(1)
});

export const ChatMessagesQuerySchema = z.object({
  search: z.string().optional(),
  mode: z.enum(['plain', 'regex']).default('plain'),
  type: z.enum(['regular', 'superchat', 'membership']).optional(),
  author: z.string().optional(),
  badges: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(500).default(100)
});

export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;
export type ChatMessagesQuery = z.infer<typeof ChatMessagesQuerySchema>;
```

### Error Handling

Centralized error handling with consistent response format:

```typescript
// backend/src/middleware/error-handler.ts
import { FastifyInstance } from 'fastify';

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    // Log error
    request.log.error(error);
    
    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.validation
      });
    }
    
    // Handle known errors
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message
      });
    }
    
    // Handle unknown errors
    return reply.status(500).send({
      error: 'Internal server error'
    });
  });
}
```

### Logging

Structured logging with request/response information:

```typescript
// backend/src/middleware/logger.ts
import { FastifyInstance } from 'fastify';

export function registerLogger(fastify: FastifyInstance) {
  fastify.addHook('onRequest', (request, reply, done) => {
    request.log.info({ 
      method: request.method, 
      url: request.url,
      headers: request.headers
    }, 'Incoming request');
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info({ 
      method: request.method, 
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime()
    }, 'Request completed');
    done();
  });
}
```

## Benefits of This Structure

1. **Modularity**: Each feature is contained in its own module
2. **Maintainability**: Changes to one module don't affect others
3. **Scalability**: Easy to add new features without disrupting existing code
4. **Testability**: Each module can be tested independently
5. **Developer Experience**: Clear organization makes it easy to find relevant code
6. **Type Safety**: Strong typing throughout with Zod validation
7. **Error Handling**: Consistent error responses across all endpoints
8. **Documentation**: Clear structure makes documentation easier to generate

## Migration Path

1. Create the new directory structure alongside existing code
2. Implement each module incrementally
3. Maintain backward compatibility during transition
4. Update frontend to use new endpoints
5. Remove old implementation once migration is complete
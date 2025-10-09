# Current API Documentation

## Overview

This document describes the current API endpoints implemented in the YTChatHub backend. The API is built with Fastify and provides endpoints for managing YouTube Live chat connections, retrieving messages, and controlling the OBS overlay.

## Base URL

```
http://localhost:4100
```

The port can be configured with the `PORT` environment variable.

## Authentication

The API does not require authentication. All endpoints are publicly accessible.

## Health Check

### GET `/health`

Check the backend health and connection status.

**Response:**
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

**Fields:**
- `status`: Always "ok" when the backend is running
- `messages`: Number of messages in the store
- `selection`: ID of the currently selected message for overlay
- `mode`: "live" when connected to YouTube, "mock" when using mock data
- `connected`: Boolean indicating YouTube connection status
- `liveId`: Current YouTube Live ID

## Chat Management

### POST `/chat/connect`

Connect to a YouTube Live chat stream.

**Request Body:**
```json
{
  "liveId": "dQw4w9WgXcQ"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "liveId": "dQw4w9WgXcQ"
}
```

**Response (Error):**
```json
{
  "error": "Invalid YouTube Live ID or URL"
}
```

**Status Codes:**
- `200`: Successfully connected
- `400`: Missing or invalid liveId
- `500`: Failed to connect to YouTube

### POST `/chat/disconnect`

Disconnect from the current YouTube Live chat stream and switch to mock mode.

**Response:**
```json
{
  "ok": true
}
```

## Message Retrieval

### GET `/chat/messages`

Retrieve chat messages with optional filtering and pagination.

**Query Parameters:**
- `search` (string): Text to search for in messages
- `mode` (string): Search mode - "plain" (default) or "regex"
- `type` (string): Message type filter - "regular", "superchat", or "membership"
- `author` (string): Filter by author name
- `badges` (string): Comma-separated list of badge types (moderator, member, verified)
- `cursor` (string): Pagination cursor for retrieving older messages
- `limit` (number): Number of messages to return (default: 100, max: 500)

**Response:**
```json
{
  "messages": [
    {
      "id": "message-id-123",
      "author": "User Name",
      "authorPhoto": "https://yt3.ggpht.com/...",
      "authorChannelId": "UC...",
      "authorChannelUrl": "https://www.youtube.com/channel/UC...",
      "text": "Hello world!",
      "runs": [
        {
          "text": "Hello "
        },
        {
          "emojiUrl": "https://yt3.ggpht.com/...",
          "emojiAlt": ":smile:"
        },
        {
          "text": " world!"
        }
      ],
      "publishedAt": "2023-05-15T14:30:00.000Z",
      "badges": [
        {
          "type": "member",
          "label": "Member (6 months)",
          "imageUrl": "https://yt3.ggpht.com/..."
        }
      ],
      "isModerator": false,
      "isMember": true,
      "isVerified": false,
      "superChat": {
        "amount": "5.00",
        "currency": "$",
        "color": "#1e3a8a"
      },
      "membershipGift": false,
      "membershipGiftPurchase": false,
      "membershipLevel": "New member",
      "giftCount": 1
    }
  ],
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

**Fields:**
- `messages`: Array of chat messages
- `total`: Total number of messages matching filters
- `totalMatches`: Same as total (for compatibility)
- `pageCount`: Number of messages in current page
- `nextCursor`: Cursor for retrieving older messages
- `hasMore`: Boolean indicating if there are more messages
- `appliedFilters`: Summary of filters applied to the request

## Overlay Control

### POST `/overlay/selection`

Select a message to display in the OBS overlay.

**Request Body:**
```json
{
  "id": "message-id-123"
}
```

**Response (Success):**
```json
{
  "ok": true
}
```

**Response (Error):**
```json
{
  "error": "message not found"
}
```

**Status Codes:**
- `200`: Successfully selected
- `400`: Missing id parameter
- `404`: Message not found

### DELETE `/overlay/selection`

Clear the current overlay selection.

**Response:**
```json
{
  "ok": true
}
```

### GET `/overlay/stream`

Server-Sent Events stream for overlay updates.

**Events:**
- `selection`: Emitted when a new message is selected
- `heartbeat`: Emitted every 15 seconds to keep connection alive

**Example Event Data:**
```json
{
  "message": {
    "id": "message-id-123",
    "author": "User Name",
    // ... full message object
  }
}
```

## Data Types

### ChatMessage

```typescript
type ChatMessage = {
  id: string;
  author: string;
  authorPhoto?: string;
  authorChannelId?: string;
  authorChannelUrl?: string;
  text: string;
  runs?: MessageRun[];
  publishedAt: string;
  badges?: Badge[];
  isModerator?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
  superChat?: SuperChatInfo;
  membershipGift?: boolean;
  membershipGiftPurchase?: boolean;
  membershipLevel?: string;
  giftCount?: number;
};
```

### Badge

```typescript
type Badge = {
  type: 'moderator' | 'member' | 'verified' | 'custom';
  label?: string;
  icon?: string;
  imageUrl?: string;
};
```

### SuperChatInfo

```typescript
type SuperChatInfo = {
  amount: string;
  currency: string;
  color: string;
};
```

### MessageRun

```typescript
type MessageRun = {
  text?: string;
  emojiUrl?: string;
  emojiAlt?: string;
};
```

## Error Handling

All error responses follow this format:

```json
{
  "error": "Description of the error"
}
```

Common status codes:
- `400`: Bad request (missing or invalid parameters)
- `404`: Not found (resource doesn't exist)
- `500`: Internal server error

## Rate Limiting

There is currently no rate limiting implemented. The API will process all requests as they arrive.

## CORS

CORS is enabled for all origins with the following configuration:
- Allowed origins: `*` (all origins)
- Allowed methods: GET, POST, DELETE, OPTIONS, PUT, PATCH
- Allowed headers: Content-Type, Authorization
- Credentials: Not allowed
import Fastify from 'fastify';
import cors from '@fastify/cors';
import EventEmitter from 'eventemitter3';
import type { ChatMessage, Poll } from '@shared/chat';
import { bootstrapInnertube, type IngestionContext } from './ingestion/youtubei';
import crypto from 'crypto';

const MAX_MESSAGES = 500;
const MAX_REGULAR_MESSAGES = 200; // Keep fewer regular messages

// Simple in-memory cache for images
const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_SIZE = 1000; // Maximum number of cached images

export async function startBackend() {
  const fastify = Fastify({
    logger: {
      level: 'warn', // Only show warnings and errors, not every request
    }
  });

  // Register CORS before any routes
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  });

  const store: ChatMessage[] = [];
  let currentSelection: ChatMessage | null = null;
  let currentPoll: Poll | null = null;
  const overlayEmitter = new EventEmitter<{ update: (message: ChatMessage | null) => void }>();
  const pollEmitter = new EventEmitter<{ update: (poll: Poll | null) => void }>();

  const rawLiveId = process.env.YOUTUBE_LIVE_ID ?? '';
  const parsedLiveId = extractLiveId(rawLiveId);
  const shouldMock = !parsedLiveId;

  let ingestion: IngestionContext | null = null;
  let mockInterval: NodeJS.Timeout | null = null;

  if (!shouldMock) {
    try {
      console.log(`[Backend] Connecting to YouTube Live ID: ${parsedLiveId}`);
      ingestion = await bootstrapInnertube(parsedLiveId);
      console.log(`[Backend] ✓ YouTube chat connected successfully`);
      ingestion.emitter.on('message', (message) => {
        store.push(message);
        // Trim regularly to keep regular messages under control
        // This ensures we don't wait until hitting MAX_MESSAGES
        trimMessages(store);
      });
      ingestion.emitter.on('poll', (poll) => {
        currentPoll = poll;
        pollEmitter.emit('update', poll);
      });
      ingestion.emitter.on('error', (error) => {
        console.error('[Backend] Innertube ingestion error:', error);
      });
    } catch (error) {
      console.error('[Backend] Failed to bootstrap Innertube; falling back to mock data:', error);
    }
  } else {
    console.log('[Backend] No YOUTUBE_LIVE_ID found, running in mock mode');
  }

  if (!ingestion) {
    mockInterval = seedMockMessages(store, overlayEmitter);
  }

  fastify.get('/health', async () => ({
    status: 'ok',
    messages: store.length,
    selection: currentSelection?.id ?? null,
    mode: ingestion ? 'live' : 'mock',
    connected: !!ingestion,
    liveId: ingestion?.videoId ?? null
  }));

  fastify.post<{ Body: { liveId: string } }>('/chat/connect', async (request, reply) => {
    const { liveId } = request.body ?? {};
    if (!liveId) {
      reply.status(400);
      return { error: 'liveId is required' };
    }

    const parsedLiveId = extractLiveId(liveId);
    if (!parsedLiveId) {
      reply.status(400);
      return { error: 'Invalid YouTube Live ID or URL' };
    }

    // Stop mock messages if running
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
      console.log('[Backend] Stopped mock messages');
    }

    // Stop existing ingestion if any
    if (ingestion) {
      try {
        ingestion.liveChat?.stop?.();
      } catch (e) {
        console.error('[Backend] Error stopping previous connection:', e);
      }
      ingestion = null;
    }

    // Clear messages
    store.length = 0;

    try {
      console.log(`[Backend] Connecting to YouTube Live ID: ${parsedLiveId}`);
      ingestion = await bootstrapInnertube(parsedLiveId);
      console.log(`[Backend] ✓ YouTube chat connected successfully`);

      ingestion.emitter.on('message', (message) => {
        store.push(message);
        // Trim regularly to keep regular messages under control
        // This ensures we don't wait until hitting MAX_MESSAGES
        trimMessages(store);
      });

      ingestion.emitter.on('poll', (poll) => {
        currentPoll = poll;
        pollEmitter.emit('update', poll);
      });

      ingestion.emitter.on('error', (error) => {
        console.error('[Backend] Innertube ingestion error:', error);
      });

      return { ok: true, liveId: parsedLiveId };
    } catch (error) {
      console.error('[Backend] Failed to connect:', error);
      reply.status(500);
      return { error: 'Failed to connect to YouTube Live chat' };
    }
  });

  fastify.post('/chat/disconnect', async () => {
    if (ingestion) {
      try {
        ingestion.liveChat?.stop?.();
        console.log('[Backend] Disconnected from YouTube chat');
      } catch (e) {
        console.error('[Backend] Error disconnecting:', e);
      }
      ingestion = null;
    }
    
    // Start mock messages again
    if (!mockInterval) {
      mockInterval = seedMockMessages(store, overlayEmitter);
      console.log('[Backend] Started mock messages');
    }
    
    store.length = 0;
    currentSelection = null;
    overlayEmitter.emit('update', null);
    return { ok: true };
  });

  fastify.get('/chat/messages', async () => ({
    messages: store
  }));

  fastify.get('/poll/current', async () => ({
    poll: currentPoll
  }));

  fastify.post<{ Body: { id?: string } }>('/overlay/selection', async (request, reply) => {
    const { id } = request.body ?? {};
    if (!id) {
      reply.status(400);
      return { error: 'id is required' };
    }

    const message = store.find((item) => item.id === id);
    if (!message) {
      reply.status(404);
      return { error: 'message not found' };
    }

    currentSelection = message;
    overlayEmitter.emit('update', currentSelection);

    return { ok: true };
  });

  fastify.delete('/overlay/selection', async () => {
    currentSelection = null;
    overlayEmitter.emit('update', null);
    return { ok: true };
  });

  fastify.get('/poll/stream', async (request, reply) => {
    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(200);
    res.write(': connected\n\n');

    const send = (poll: Poll | null) => {
      res.write(`event: poll\ndata: ${JSON.stringify({ poll })}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 15000);

    pollEmitter.on('update', send);

    if (currentPoll) {
      send(currentPoll);
    }

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      pollEmitter.off('update', send);
    });
  });

  fastify.get('/overlay/stream', async (request, reply) => {
    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(200);
    res.write(': connected\n\n');

    const send = (message: ChatMessage | null) => {
      res.write(`event: selection\ndata: ${JSON.stringify({ message })}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 15000);

    overlayEmitter.on('update', send);

    if (currentSelection) {
      send(currentSelection);
    }

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      overlayEmitter.off('update', send);
    });
  });

  // Image proxy endpoint to avoid YouTube CDN rate limits
  fastify.get<{ Querystring: { url: string } }>('/proxy/image', async (request, reply) => {
    const { url } = request.query;
    
    if (!url || typeof url !== 'string') {
      reply.status(400);
      return { error: 'url parameter is required' };
    }

    // Only allow YouTube CDN and Google User Content domains
    const allowedDomains = [
      'yt3.ggpht.com', 
      'yt4.ggpht.com', 
      'i.ytimg.com',
      'lh3.googleusercontent.com' // For super stickers
    ];
    try {
      const urlObj = new URL(url);
      if (!allowedDomains.includes(urlObj.hostname)) {
        reply.status(403);
        return { error: 'Only YouTube CDN and Google User Content URLs are allowed' };
      }
    } catch (error) {
      reply.status(400);
      return { error: 'Invalid URL' };
    }

    // Create cache key from URL
    const cacheKey = crypto.createHash('md5').update(url).digest('hex');
    
    // Check cache
    const cached = imageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      reply.header('Content-Type', cached.contentType);
      reply.header('Cache-Control', 'public, max-age=86400'); // 24 hours
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(cached.buffer);
    }

    // Fetch from YouTube
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.youtube.com/',
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[Backend] Rate limited by YouTube CDN for:', url);
          // Return from cache even if expired, or return error
          if (cached) {
            reply.header('Content-Type', cached.contentType);
            reply.header('Cache-Control', 'public, max-age=86400');
            reply.header('Access-Control-Allow-Origin', '*');
            return reply.send(cached.buffer);
          }
        }
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Cache the image
      imageCache.set(cacheKey, {
        buffer,
        contentType,
        timestamp: Date.now()
      });

      // Cleanup old cache entries if we exceed max size
      if (imageCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(imageCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove oldest 20%
        toDelete.forEach(([key]) => imageCache.delete(key));
      }

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('Access-Control-Allow-Origin', '*');
      return reply.send(buffer);
    } catch (error) {
      console.error('[Backend] Failed to proxy image:', error);
      
      // Try to return stale cache if available
      if (cached) {
        reply.header('Content-Type', cached.contentType);
        reply.header('Cache-Control', 'public, max-age=86400');
        reply.header('Access-Control-Allow-Origin', '*');
        return reply.send(cached.buffer);
      }
      
      reply.status(500);
      return { error: 'Failed to fetch image' };
    }
  });

  const port = Number(process.env.PORT ?? 4100);

  await fastify.listen({ port, host: '0.0.0.0' });

  console.log(`[Backend] Server listening on http://localhost:${port}`);
}

function extractLiveId(input: string): string {
  if (!input) return '';

  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.searchParams.has('v')) {
      return url.searchParams.get('v') ?? '';
    }
    const pathname = url.pathname.split('/').filter(Boolean).pop();
    return pathname ?? '';
  } catch (error) {
    console.warn('Invalid YOUTUBE_LIVE_ID provided', error);
    return '';
  }
}

/**
 * Intelligently trim messages while preserving superchats and memberships
 * Regular messages are limited to MAX_REGULAR_MESSAGES
 * Superchats and memberships are preserved for the entire session
 */
function trimMessages(store: ChatMessage[]): void {
  // Count messages by type
  let regularCount = 0;
  const specialIndices: number[] = [];
  
  for (let i = 0; i < store.length; i++) {
    const message = store[i];
    const isSpecial = message.superChat || message.membershipGift || 
                     message.membershipGiftPurchase || message.isMember;
    if (isSpecial) {
      specialIndices.push(i);
    } else {
      regularCount++;
    }
  }
  
  // Only trim if we have too many regular messages
  if (regularCount > MAX_REGULAR_MESSAGES) {
    const toRemove = regularCount - MAX_REGULAR_MESSAGES;
    const specialSet = new Set(specialIndices);
    
    // Remove oldest regular messages (keep special messages)
    let removed = 0;
    const newStore: ChatMessage[] = [];
    
    for (let i = 0; i < store.length; i++) {
      const isSpecial = specialSet.has(i);
      
      if (isSpecial) {
        // Always keep special messages
        newStore.push(store[i]);
      } else {
        // Keep regular messages if we haven't removed enough yet
        if (removed < toRemove) {
          removed++;
          // Skip this message (delete it)
        } else {
          newStore.push(store[i]);
        }
      }
    }
    
    // Replace store contents
    store.length = 0;
    store.push(...newStore);
  }
}

function seedMockMessages(
  store: ChatMessage[],
  overlayEmitter: EventEmitter<{ update: (message: ChatMessage | null) => void }>
): NodeJS.Timeout {
  let counter = 0;
  const authors = ['Ada', 'Linus', 'Grace', 'Marge'];
  return setInterval(() => {
    const message: ChatMessage = {
      id: `mock-${Date.now()}`,
      author: authors[counter % authors.length],
      text: `Mock message #${counter}`,
      publishedAt: new Date().toISOString()
    };
    store.push(message);
    // Trim regularly to keep regular messages under control
    trimMessages(store);
    if (counter % 5 === 0) {
      overlayEmitter.emit('update', message);
    }
    counter += 1;
  }, 2000);
}

// Only run if this is the main module
if (require.main === module) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import EventEmitter from 'eventemitter3';
import type { ChatMessage } from '@shared/chat';
import { bootstrapInnertube, type IngestionContext } from './ingestion/youtubei';

const MAX_MESSAGES = 500;

export async function startBackend() {
  const fastify = Fastify({
    logger: true
  });

  await fastify.register(cors, { origin: true });

  const store: ChatMessage[] = [];
  let currentSelection: ChatMessage | null = null;
  const overlayEmitter = new EventEmitter<{ update: (message: ChatMessage | null) => void }>();

  const rawLiveId = process.env.YOUTUBE_LIVE_ID ?? '';
  const parsedLiveId = extractLiveId(rawLiveId);
  const shouldMock = !parsedLiveId;

  let ingestion: IngestionContext | null = null;

  if (!shouldMock) {
    try {
      console.log(`[Backend] Connecting to YouTube Live ID: ${parsedLiveId}`);
      ingestion = await bootstrapInnertube(parsedLiveId);
      console.log(`[Backend] ✓ YouTube chat connected successfully`);
      ingestion.emitter.on('message', (message) => {
        console.log(`[Chat] ${message.author}: ${message.text}`);
        store.push(message);
        if (store.length > MAX_MESSAGES) {
          store.splice(0, store.length - MAX_MESSAGES);
        }
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
    seedMockMessages(store, overlayEmitter);
  }

  fastify.get('/health', async () => ({
    status: 'ok',
    messages: store.length,
    selection: currentSelection?.id ?? null,
    mode: ingestion ? 'live' : 'mock'
  }));

  fastify.get('/chat/messages', async () => ({
    messages: store
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

  fastify.options('/overlay/stream', async (request, reply) => {
    reply.headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    reply.status(204).send();
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

function seedMockMessages(
  store: ChatMessage[],
  overlayEmitter: EventEmitter<{ update: (message: ChatMessage | null) => void }>
) {
  let counter = 0;
  const authors = ['Ada', 'Linus', 'Grace', 'Marge'];
  setInterval(() => {
    const message: ChatMessage = {
      id: `mock-${Date.now()}`,
      author: authors[counter % authors.length],
      text: `Mock message #${counter}`,
      publishedAt: new Date().toISOString()
    };
    store.push(message);
    if (store.length > MAX_MESSAGES) {
      store.splice(0, store.length - MAX_MESSAGES);
    }
    if (counter % 5 === 0) {
      overlayEmitter.emit('update', message);
    }
    counter += 1;
  }, 2000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}

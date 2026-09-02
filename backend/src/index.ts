import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import EventEmitter from 'eventemitter3';
import { existsSync } from 'fs';
import type { OutgoingHttpHeaders, ServerResponse } from 'http';
import path from 'path';
import type { ChatMessage, ConnectionStatus, Poll, ServerEvent } from '@shared/chat';
import { bootstrapInnertube, type IngestionContext } from './ingestion/youtubei';
import { registerImageProxy } from './imageProxy';
import { extractLiveId } from './liveId';

const MAX_REGULAR_MESSAGES = 200;
const MAX_SPECIAL_MESSAGES = 500;
const RETRY_LIMIT = 30;
const RETRY_BASE_MS = 2000;
const RETRY_CAP_MS = 30_000;
const HEARTBEAT_MS = 15_000;
const CORS_ORIGINS = ['http://localhost:3100', 'http://127.0.0.1:3100'];

type Bus = EventEmitter<{ event: (event: ServerEvent) => void }>;

const isSpecial = (m: ChatMessage) => !!(m.superChat || m.membershipGift || m.membershipGiftPurchase);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Drops the oldest messages of each class past its cap, in place, without allocating. */
function trimMessages(store: ChatMessage[]): void {
  let regular = 0;
  let special = 0;
  for (const m of store) isSpecial(m) ? special++ : regular++;
  let dropRegular = Math.max(0, regular - MAX_REGULAR_MESSAGES);
  let dropSpecial = Math.max(0, special - MAX_SPECIAL_MESSAGES);
  if (!dropRegular && !dropSpecial) return;

  let write = 0;
  for (const m of store) {
    if (isSpecial(m) ? dropSpecial > 0 : dropRegular > 0) {
      isSpecial(m) ? dropSpecial-- : dropRegular--;
      continue;
    }
    store[write++] = m;
  }
  store.length = write;
}

function writeEvent(res: ServerResponse, event: ServerEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export async function startBackend() {
  const fastify = Fastify({ logger: { level: 'warn' } });
  await fastify.register(cors, { origin: CORS_ORIGINS, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] });

  const store: ChatMessage[] = [];
  const bus: Bus = new EventEmitter();
  const mockEnabled = process.env.MOCK_CHAT === '1';
  let selection: ChatMessage | null = null;
  let poll: Poll | null = null;
  let status: ConnectionStatus = { state: 'disconnected', liveId: null, title: null, error: null };
  let ingestion: IngestionContext | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let mockTimer: NodeJS.Timeout | null = null;
  // Bumped whenever the active connection changes so a bootstrap that resolves late is discarded.
  let generation = 0;

  const emit = (event: ServerEvent) => bus.emit('event', event);

  function setStatus(patch: Partial<ConnectionStatus>) {
    status = { ...status, ...patch };
    emit({ type: 'status', status });
  }

  function pushMessage(message: ChatMessage) {
    store.push(message);
    trimMessages(store);
    emit({ type: 'message', message });
  }

  function setSelection(message: ChatMessage | null) {
    selection = message;
    emit({ type: 'selection', message });
  }

  function setPoll(next: Poll | null) {
    poll = next;
    emit({ type: 'poll', poll: next });
  }

  function clearStore() {
    store.length = 0;
    emit({ type: 'clear' });
    if (selection) setSelection(null);
    if (poll) setPoll(null);
  }

  function startMock() {
    if (mockTimer || !mockEnabled) return;
    console.log('[Backend] MOCK_CHAT=1, generating mock messages');
    const authors = ['Ada', 'Linus', 'Grace', 'Marge'];
    let counter = 0;
    mockTimer = setInterval(() => {
      pushMessage({
        id: `mock-${Date.now()}`,
        author: authors[counter % authors.length],
        text: `Mock message #${counter}`,
        publishedAt: new Date().toISOString()
      });
      counter += 1;
    }, 2000);
  }

  function stopMock() {
    if (!mockTimer) return;
    clearInterval(mockTimer);
    mockTimer = null;
  }

  // Stops the live chat and any pending retry; the old connection's listeners are dropped.
  function detach() {
    generation += 1;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (ingestion) {
      ingestion.emitter.removeAllListeners();
      try {
        ingestion.liveChat?.stop?.();
      } catch (error) {
        console.error('[Backend] Error stopping live chat:', error);
      }
      ingestion = null;
    }
  }

  function idle(patch: Partial<ConnectionStatus>) {
    setStatus({ state: 'disconnected', ...patch });
    startMock();
  }

  function scheduleRetry(liveId: string, attempt: number, reason: string) {
    detach();
    if (attempt > RETRY_LIMIT) {
      console.error(`[Backend] Giving up on ${liveId} after ${RETRY_LIMIT} attempts: ${reason}`);
      idle({ error: `Gave up after ${RETRY_LIMIT} reconnect attempts: ${reason}` });
      return;
    }
    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_CAP_MS);
    console.warn(`[Backend] Connection lost (${reason}); retry ${attempt}/${RETRY_LIMIT} in ${delay}ms`);
    setStatus({ state: 'reconnecting', error: reason });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect(liveId, attempt);
    }, delay);
  }

  async function connect(liveId: string, attempt = 0): Promise<boolean> {
    stopMock();
    const gen = ++generation;
    if (attempt === 0) setStatus({ state: 'connecting', liveId, title: null, error: null });

    let ctx: IngestionContext;
    try {
      ctx = await bootstrapInnertube(liveId);
    } catch (error) {
      if (gen !== generation) return false;
      const reason = errorText(error);
      console.error(`[Backend] Failed to connect to ${liveId}: ${reason}`);
      if (attempt === 0) idle({ error: reason });
      else scheduleRetry(liveId, attempt + 1, reason);
      return false;
    }
    if (gen !== generation) {
      ctx.liveChat.stop();
      return false;
    }

    ingestion = ctx;
    ctx.emitter.on('message', pushMessage);
    ctx.emitter.on('poll', setPoll);
    // youtubei.js retries a failed poll itself, 10 times 2s apart, and emits `end` when it gives up; only then rebuild the session.
    ctx.emitter.on('end', () => scheduleRetry(liveId, 1, 'live chat ended'));
    ctx.emitter.on('error', (error) => console.warn(`[Backend] Live chat poll error, library will retry: ${errorText(error)}`));
    setStatus({ state: 'live', liveId, title: ctx.title, error: null });
    console.log(`[Backend] Connected to ${liveId}${ctx.title ? ` (${ctx.title})` : ''}`);
    return true;
  }

  fastify.get('/health', async () => ({
    status: 'ok',
    connection: status,
    messages: store.length,
    selection: selection?.id ?? null,
    mock: mockTimer !== null
  }));

  fastify.post<{ Body: { liveId?: string } }>('/chat/connect', async (request, reply) => {
    const liveId = extractLiveId(request.body?.liveId);
    if (!liveId) {
      reply.status(400);
      return { error: 'Invalid YouTube Live ID or URL' };
    }
    detach();
    clearStore();
    if (!(await connect(liveId))) {
      reply.status(500);
      return { error: status.error ?? 'Failed to connect to YouTube Live chat' };
    }
    return { ok: true, liveId, title: status.title ?? null };
  });

  fastify.post('/chat/disconnect', async () => {
    detach();
    clearStore();
    idle({ liveId: null, title: null, error: null });
    return { ok: true };
  });

  fastify.get('/chat/messages', async () => ({ messages: store }));

  fastify.post<{ Body: { id?: string } }>('/overlay/selection', async (request, reply) => {
    const id = request.body?.id;
    if (!id) {
      reply.status(400);
      return { error: 'id is required' };
    }
    const message = store.find((item) => item.id === id);
    if (!message) {
      reply.status(404);
      return { error: 'message not found' };
    }
    setSelection(message);
    return { ok: true };
  });

  fastify.delete('/overlay/selection', async () => {
    setSelection(null);
    return { ok: true };
  });

  fastify.get('/events', (request, reply) => {
    reply.hijack();
    const res = reply.raw;
    // Headers set by hooks (CORS) are not flushed on a hijacked reply, so copy them.
    res.writeHead(200, {
      ...(reply.getHeaders() as OutgoingHttpHeaders),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    writeEvent(res, { type: 'init', status, messages: store, selection, poll });

    const forward = (event: ServerEvent) => writeEvent(res, event);
    bus.on('event', forward);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      bus.off('event', forward);
    });
  });

  registerImageProxy(fastify);

  // Production serves the exported Next.js client; in dev the client runs on its own port.
  const clientDir = path.resolve(process.cwd(), 'client/out');
  if (existsSync(clientDir)) {
    await fastify.register(fastifyStatic, { root: clientDir, index: ['index.html'], redirect: true });
    fastify.get('/', (_request, reply) => reply.redirect('/dashboard/'));
    console.log(`[Backend] Serving client from ${clientDir}`);
  } else {
    console.log('[Backend] client/out not found, serving API only');
  }

  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4100);
  await fastify.listen({ port, host });
  console.log(`[Backend] Listening on http://${host}:${port}`);

  const envLiveId = extractLiveId(process.env.YOUTUBE_LIVE_ID);
  if (envLiveId) {
    // Attempt 1 rather than 0 so a failed startup connect goes through the retry schedule instead of giving up.
    void connect(envLiveId, 1);
  } else {
    if (process.env.YOUTUBE_LIVE_ID) console.warn('[Backend] Ignoring invalid YOUTUBE_LIVE_ID');
    startMock();
  }
}

if (require.main === module) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}

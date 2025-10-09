import Fastify from 'fastify';
import cors from '@fastify/cors';
import EventEmitter from 'eventemitter3';
import safeRegex from 'safe-regex2';
import type { ChatMessage } from '@shared/chat';
import { bootstrapInnertube, type IngestionContext } from './ingestion/youtubei';

const MAX_MESSAGES = 500;
const DEFAULT_PAGE_SIZE = 100;
const MAX_REGEX_PATTERN_LENGTH = 256;

type MessageTypeFilter = 'regular' | 'superchat' | 'membership';
type SearchMode = 'plain' | 'regex';

type ChatMessagesQuery = {
  search?: string;
  mode?: SearchMode;
  type?: MessageTypeFilter;
  author?: string;
  badges?: string;
  cursor?: string;
  limit?: number | string;
};

type ChatMessagesReply = {
  messages: ChatMessage[];
  total: number;
  totalMatches: number;
  pageCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  error?: string;
  appliedFilters: {
    search: string | null;
    mode: SearchMode;
    type: MessageTypeFilter | 'all';
    author: string | null;
    badges: string[];
    limit: number;
  };
};

type ParsedChatMessagesQuery = {
  search: string;
  mode: SearchMode;
  type?: MessageTypeFilter;
  author: string;
  badges: string[];
  cursor: string | null;
  limit: number;
};

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
  const overlayEmitter = new EventEmitter<{ update: (message: ChatMessage | null) => void }>();

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
        if (store.length > MAX_MESSAGES) {
          store.splice(0, store.length - MAX_MESSAGES);
        }
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

  fastify.get<{ Querystring: ChatMessagesQuery; Reply: ChatMessagesReply }>('/chat/messages', async (request, reply) => {
    const parsed = parseChatMessagesQuery(request.query ?? {});
    const { regex: searchRegex, error: regexError } = buildSearchRegex(parsed);

    if (regexError) {
      reply.status(400);
      return buildInvalidSearchReply(parsed, store.length, regexError);
    }

    const filtered = applyFilters(store, parsed, searchRegex);
    const { page, nextCursor, hasMore } = paginateMessages(filtered, parsed);
    const normalizedPage = withAuthorChannelUrl(page);

    reply.status(200);
    return buildSuccessReply(normalizedPage, filtered.length, parsed, nextCursor, hasMore);
  });

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
): NodeJS.Timeout {
  let counter = 0;
  const authors = ['Ada', 'Linus', 'Grace', 'Marge'];
  return setInterval(() => {
    const message: ChatMessage = {
      id: `mock-${Date.now()}`,
      author: authors[counter % authors.length],
      authorChannelId: `mock-channel-${counter % authors.length}`,
      authorChannelUrl: `https://www.youtube.com/channel/mock-channel-${counter % authors.length}`,
      text: `Mock message #${counter}`,
      authorPhoto: `https://api.dicebear.com/7.x/thumbs/svg?seed=${authors[counter % authors.length]}`,
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

function parseChatMessagesQuery(raw: ChatMessagesQuery | undefined): ParsedChatMessagesQuery {
  const search = typeof raw?.search === 'string' ? raw.search.trim() : '';
  const mode: SearchMode = raw?.mode === 'regex' ? 'regex' : 'plain';
  const type: MessageTypeFilter | undefined =
    raw?.type === 'superchat' || raw?.type === 'membership' || raw?.type === 'regular' ? raw.type : undefined;
  const author = typeof raw?.author === 'string' ? raw.author.trim() : '';
  const badges = typeof raw?.badges === 'string'
    ? raw.badges
        .split(',')
        .map((badge) => badge.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const parsedLimit = typeof raw?.limit === 'number' ? raw.limit : Number(raw?.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(1, Math.floor(parsedLimit)), MAX_MESSAGES)
    : DEFAULT_PAGE_SIZE;

  const parsedCursor = typeof raw?.cursor === 'string' ? raw.cursor.trim() : '';

  return {
    search,
    mode,
    type,
    author,
    badges,
    cursor: parsedCursor || null,
    limit
  };
}

function buildSearchRegex(parsed: ParsedChatMessagesQuery): { regex: RegExp | null; error?: string } {
  if (!parsed.search) {
    return { regex: null };
  }

  if (parsed.mode === 'regex') {
    if (parsed.search.length > MAX_REGEX_PATTERN_LENGTH) {
      return { regex: null, error: `Regex pattern must be ${MAX_REGEX_PATTERN_LENGTH} characters or less` };
    }

    if (!safeRegex(parsed.search)) {
      return { regex: null, error: 'Unsafe regex pattern' };
    }

    try {
      return { regex: new RegExp(parsed.search, 'i') };
    } catch {
      return { regex: null, error: 'Invalid regex pattern' };
    }
  }

  try {
    return { regex: new RegExp(escapeRegExp(parsed.search), 'i') };
  } catch {
    return { regex: null, error: 'Invalid search pattern' };
  }
}

function applyFilters(messages: ChatMessage[], parsed: ParsedChatMessagesQuery, searchRegex: RegExp | null): ChatMessage[] {
  let filtered = messages.slice();

  if (parsed.type) {
    filtered = filtered.filter((message) => matchesType(message, parsed.type!));
  }

  if (parsed.author) {
    const lowered = parsed.author.toLowerCase();
    filtered = filtered.filter((message) => (message.author ?? '').toLowerCase().includes(lowered));
  }

  if (parsed.badges.length > 0) {
    filtered = filtered.filter((message) => matchesBadges(message, parsed.badges));
  }

  if (searchRegex) {
    filtered = filtered.filter((message) => matchesSearch(message, searchRegex, parsed.search, parsed.mode));
  }

  return filtered;
}

function paginateMessages(messages: ChatMessage[], parsed: ParsedChatMessagesQuery) {
  let endIndex = messages.length;
  if (parsed.cursor) {
    const cursorIndex = messages.findIndex((message) => message.id === parsed.cursor);
    if (cursorIndex >= 0) {
      endIndex = cursorIndex;
    }
  }

  const startIndex = Math.max(0, endIndex - parsed.limit);
  const page = messages.slice(startIndex, endIndex);
  const nextCursor = startIndex > 0 ? messages[startIndex - 1]?.id ?? null : null;
  return {
    page,
    nextCursor,
    hasMore: nextCursor !== null
  };
}

function withAuthorChannelUrl(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.authorChannelUrl || !message.authorChannelId) {
      return message;
    }
    return {
      ...message,
      authorChannelUrl: `https://www.youtube.com/channel/${message.authorChannelId}`
    };
  });
}

function buildInvalidSearchReply(
  parsed: ParsedChatMessagesQuery,
  totalMessages: number,
  errorMessage: string
): ChatMessagesReply {
  return {
    messages: [],
    total: totalMessages,
    totalMatches: 0,
    pageCount: 0,
    nextCursor: null,
    hasMore: false,
    error: errorMessage,
    appliedFilters: buildAppliedFilters(parsed)
  } satisfies ChatMessagesReply;
}

function buildSuccessReply(
  page: ChatMessage[],
  totalMatches: number,
  parsed: ParsedChatMessagesQuery,
  nextCursor: string | null,
  hasMore: boolean
): ChatMessagesReply {
  return {
    messages: page,
    total: totalMatches,
    totalMatches,
    pageCount: page.length,
    nextCursor,
    hasMore,
    appliedFilters: buildAppliedFilters(parsed)
  } satisfies ChatMessagesReply;
}

function buildAppliedFilters(parsed: ParsedChatMessagesQuery): ChatMessagesReply['appliedFilters'] {
  return {
    search: parsed.search || null,
    mode: parsed.mode,
    type: parsed.type ?? 'all',
    author: parsed.author || null,
    badges: parsed.badges,
    limit: parsed.limit
  };
}

function matchesType(message: ChatMessage, type: MessageTypeFilter): boolean {
  if (type === 'superchat') {
    return Boolean(message.superChat);
  }
  if (type === 'membership') {
    return Boolean(message.membershipGift || message.membershipGiftPurchase || message.membershipLevel);
  }
  return !message.superChat && !message.membershipGift && !message.membershipGiftPurchase;
}

function matchesBadges(message: ChatMessage, badges: string[]): boolean {
  if (!badges.length) {
    return true;
  }

  const badgeSet = new Set(badges.map((badge) => badge.toLowerCase()));
  const candidateLabels = [
    ...(message.badges ?? []).map((badge) => badge.label?.toLowerCase() ?? ''),
    ...(message.badges ?? []).map((badge) => badge.type.toLowerCase())
  ];

  if (message.isModerator) candidateLabels.push('moderator');
  if (message.isMember) candidateLabels.push('member');
  if (message.isVerified) candidateLabels.push('verified');

  return candidateLabels.some((label) => badgeSet.has(label));
}

function matchesSearch(message: ChatMessage, regex: RegExp, rawSearch: string, mode: SearchMode): boolean {
  const content = collectMessageText(message);
  if (!content) return false;

  if (mode === 'regex') {
    const pattern = new RegExp(regex.source, regex.flags.replace(/g/g, ''));
    return pattern.test(content);
  }

  return regex.test(content);
}

function collectMessageText(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.text) parts.push(message.text);
  if (Array.isArray(message.runs)) {
    for (const run of message.runs) {
      if (run.text) parts.push(run.text);
      if (run.emojiAlt) parts.push(run.emojiAlt);
    }
  }
  if (message.membershipLevel) parts.push(message.membershipLevel);
  if (message.superChat) {
    parts.push(message.superChat.amount, message.superChat.currency);
  }
  return parts.join(' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type { ChatMessage } from '@shared/chat';

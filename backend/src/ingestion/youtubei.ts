import type { ChatMessage, Badge, SuperChatInfo } from '@shared/chat';
import EventEmitter from 'eventemitter3';
import Innertube, { UniversalCache } from 'youtubei.js';

export type IngestionContext = {
  client: Innertube;
  liveChat: any;
  videoId: string;
  emitter: ChatEventEmitter;
};

export type ContinuationState = {
  messages: ChatMessage[];
  nextToken: string | null;
  timeoutMs: number;
};

export type ChatEventEmitter = EventEmitter<{
  message: (message: ChatMessage) => void;
  error: (error: unknown) => void;
}>;

const defaultTimeout = 1500;

export async function bootstrapInnertube(videoId: string): Promise<IngestionContext> {
  if (!videoId) {
    throw new Error('YOUTUBE_LIVE_ID is required to bootstrap Innertube');
  }

  console.log('[Ingestion] Creating Innertube client...');
  const client = await Innertube.create({
    cache: new UniversalCache(false)
  });

  console.log('[Ingestion] Fetching video info...');
  const info = await client.getInfo(videoId);
  
  console.log('[Ingestion] Getting live chat...');
  const liveChat = info.getLiveChat();

  if (!liveChat) {
    throw new Error('This video does not have an active live chat');
  }

  const emitter: ChatEventEmitter = new EventEmitter();

  liveChat.on('chat-update', (action: any) => {
    const normalized = normalizeAction(action);
    if (normalized) {
      emitter.emit('message', normalized);
    }
  });

  liveChat.on('error', (err: unknown) => {
    const msg = (err as any)?.message || String(err);
    if (msg && msg.includes('LiveChatReportModerationStateCommand not found')) {
      console.warn('[Ingestion] Non-fatal parser drift (ignored):', msg);
      return; // ignore noisy parser drift that YouTube.js JITs around
    }
    console.error('[Ingestion] Live chat error:', err);
    emitter.emit('error', err);
  });

  console.log('[Ingestion] Starting live chat listener...');
  liveChat.start();
  console.log('[Ingestion] Live chat listener started');

  return {
    client,
    liveChat,
    videoId,
    emitter
  };
}

export async function fetchChatBatch(
  ctx: IngestionContext,
  options?: { windowMs?: number }
): Promise<ContinuationState> {
  const windowMs = options?.windowMs ?? defaultTimeout;
  const collected: ChatMessage[] = [];

  const listener = (message: ChatMessage) => {
    collected.push(message);
  };

  ctx.emitter.on('message', listener);

  await delay(windowMs);

  ctx.emitter.off('message', listener);

  const timeoutMs = ctx.liveChat?.continuation?.timeout_ms;
  const validTimeout = typeof timeoutMs === 'number' && !isNaN(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : defaultTimeout;

  return {
    messages: collected,
    nextToken: ctx.liveChat?.continuation?.token ?? null,
    timeoutMs: validTimeout
  };
}

function resolveMessageText(item: any): string {
  if (!item?.message) return '';

  if (typeof item.message === 'string') {
    return item.message;
  }

  if (typeof item.message?.toString === 'function') {
    return item.message.toString();
  }

  if (Array.isArray(item.message?.runs)) {
    return item.message.runs.map((run: any) => run.text ?? '').join('');
  }

  return '';
}

function resolveTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e12 ? numeric / 1000 : numeric;
    return new Date(millis).toISOString();
  }

  return new Date().toISOString();
}

function extractBadges(item: any): Badge[] {
  const badges: Badge[] = [];
  
  if (!item.author?.badges) return badges;

  for (const badge of item.author.badges) {
    const label = badge.tooltip ?? badge.label ?? '';
    
    if (label.toLowerCase().includes('moderator')) {
      badges.push({ type: 'moderator', label });
    } else if (label.toLowerCase().includes('member')) {
      badges.push({ type: 'member', label });
    } else if (label.toLowerCase().includes('verified')) {
      badges.push({ type: 'verified', label });
    } else if (label) {
      badges.push({ type: 'custom', label });
    }
  }

  return badges;
}

function extractSuperChatInfo(item: any): SuperChatInfo | undefined {
  // Support multiple superchat-like types from Innertube
  const superTypes = new Set([
    'LiveChatPaidMessage',
    'LiveChatPaidSticker',
    'liveChatPaidMessageRenderer',
    'liveChatPaidStickerRenderer'
  ]);
  const typeName = String(item.type || item.item_type || item.renderer || '').trim();
  const isSuper = superTypes.has(typeName) || !!(item.purchase_amount_text || item.purchaseAmountText);
  if (!isSuper) return undefined;

  // Try multiple possible field names for the amount (search shallow + nested header)
  let amount = '';
  const candidates = [
    item.purchase_amount_text,
    item.purchaseAmountText,
    item.header?.purchase_amount_text,
    item.header?.purchaseAmountText,
    item.amount,
    item.header?.amount,
  ];

  function toText(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v.simpleText === 'string') return v.simpleText;
    if (Array.isArray(v.runs)) return v.runs.map((r: any) => r.text ?? '').join('');
    if (typeof v.toString === 'function') return v.toString();
    return '';
  }

  for (const v of candidates) {
    amount = toText(v);
    if (amount) break;
  }

  // Fallback deep scan for a purchase/amount text-like field
  if (!amount) {
    try {
      const stack: any[] = [item];
      const seen = new Set<any>();
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
        seen.add(cur);
        for (const [k, v] of Object.entries(cur)) {
          if (/purchase.*amount.*text|purchaseAmountText|amountText|purchase_amount_text/i.test(k)) {
            amount = toText(v);
            if (amount) throw new Error('_found');
          }
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    } catch (e: any) {
      if (e?.message !== '_found') throw e;
    }
  }

  // Last resort: search any string-like leaf for a currency pattern
  if (!amount) {
    const currencyPattern = /([€$£¥₹]|AUD|USD|EUR|GBP|JPY|INR)\s?\d{1,3}(?:[\,\s]?\d{3})*(?:[\.,]\d{1,2})?/i;
    const stack: any[] = [item];
    const seen = new Set<any>();
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
      seen.add(cur);
      for (const v of Object.values(cur)) {
        if (typeof v === 'string') {
          const m = v.match(currencyPattern);
          if (m) { amount = m[0]; stack.length = 0; break; }
        } else if (v && typeof v === 'object') {
          stack.push(v);
        }
      }
    }
  }

  // Normalize color; Innertube often provides ARGB/number
  let rawColor = item.body_background_color ?? item.bodyBackgroundColor ?? item.headerBackgroundColor;
  let color = '#1e3a8a';
  if (rawColor != null) {
    if (typeof rawColor === 'number') {
      const rgb = (rawColor & 0x00ffffff).toString(16).padStart(6, '0');
      color = `#${rgb}`;
    } else {
      const s = String(rawColor);
      color = s.startsWith('#') ? s : `#${s}`;
    }
  }

  return {
    amount: amount || 'Super Chat',
    currency: item.currency ?? 'USD',
    color
  };
}

function normalizeAction(action: any): ChatMessage | null {
  if (!action || action.type !== 'AddChatItemAction') {
    return null;
  }

  const item = action.item;
  if (!item) return null;

  // Normalize various live chat events
  const itemType = String(item.type || '').trim();
  const isText = itemType === 'LiveChatTextMessage';
  const isPaid = !!extractSuperChatInfo(item);
  const isMembership = itemType === 'LiveChatMembershipItem';
  const isGiftPurchase = itemType === 'LiveChatGiftMembershipsPurchase' || itemType === 'LiveChatSponsorshipsGiftRedemptionAnnouncement';
  const isGiftReceived = itemType === 'LiveChatGiftMembershipReceived';

  if (isText || isPaid || isMembership || isGiftPurchase || isGiftReceived) {
    const badges = extractBadges(item);
    const isModerator = badges.some(b => b.type === 'moderator');
    const isMember = badges.some(b => b.type === 'member');
    const isVerified = badges.some(b => b.type === 'verified');
    
    // Extract membership level for new members
    let membershipLevel: string | undefined;
    if (isMembership || isGiftPurchase || isGiftReceived) {
      membershipLevel = item.header_subtext?.toString() || 
                       item.header_primary_text?.toString() || 
                       'New member';
    }
    
    return {
      id: String(item.id ?? item.timestamp_usec ?? Date.now()),
      author: String(item.author?.name ?? 'Unknown'),
      authorPhoto: item.author?.thumbnails?.[0]?.url,
      text: resolveMessageText(item),
      publishedAt: resolveTimestamp(item.timestamp ?? item.timestamp_usec),
      badges: badges.length > 0 ? badges : undefined,
      isModerator,
      isMember,
      isVerified,
      superChat: extractSuperChatInfo(item),
      membershipGift: isMembership || isGiftPurchase || isGiftReceived,
      membershipLevel
    };
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

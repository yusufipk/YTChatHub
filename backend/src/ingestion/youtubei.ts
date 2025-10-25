import type { ChatMessage, Badge, SuperChatInfo, Poll } from '@shared/chat';
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
  poll: (poll: Poll) => void;
  error: (error: unknown) => void;
}>;

const defaultTimeout = 1500;

// Track message IDs to ensure uniqueness
const seenIds = new Map<string, number>();

function generateUniqueId(baseId: string): string {
  const count = seenIds.get(baseId) ?? 0;
  seenIds.set(baseId, count + 1);

  // If this is the first occurrence of this ID, return it as-is
  if (count === 0) {
    return baseId;
  }

  // Otherwise, append a counter suffix to ensure uniqueness
  return `${baseId}#${count}`;
}

function resolveMessageRuns(item: any) {
  const runs: { text?: string; emojiUrl?: string; emojiAlt?: string }[] = [];
  const rawRuns = item?.message?.runs;
  if (Array.isArray(rawRuns)) {
    for (const run of rawRuns) {
      if (run?.emoji) {
        const url = run.emoji?.image?.[0]?.url;
        runs.push({
          emojiUrl: url,
          emojiAlt: run.emoji?.shortcuts?.[0] || run.emoji?.emoji_id || ''
        });
      } else if (run?.text) {
        runs.push({ text: String(run.text) });
      }
    }
  }
  return runs;
}

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
    // Handle poll updates (just detect active/closed state)
    if (action?.type === 'UpdateLiveChatPollAction') {
      const pollId = action?.poll_to_update?.live_chat_poll_id;
      if (pollId) {
        emitter.emit('poll', { id: String(pollId), active: true });
      }
      return;
    }

    // Handle poll closing
    if (action?.type === 'CloseLiveChatActionPanelAction' || action?.type === 'RemoveBannerForLiveChatCommand') {
      emitter.emit('poll', null);
      return;
    }

    const normalized = normalizeAction(action);
    if (normalized) {
      emitter.emit('message', normalized);
    }
  });

  liveChat.on('error', (err: unknown) => {
    const msg = (err as any)?.message || String(err);
    // Ignore known non-fatal parser drift issues that YouTube.js auto-generates
    if (msg && (
      msg.includes('LiveChatReportModerationStateCommand not found') ||
      msg.includes('CloseLiveChatActionPanelAction not found')
    )) {
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
    return item.message.runs.map((run: any) => {
      // Handle emoji objects - for custom emojis, use the shortcut text
      if (run.emoji) {
        // For custom emojis, use the first shortcut (e.g., ":_heçkır:")
        if (run.emoji.is_custom && run.emoji.shortcuts?.[0]) {
          return run.emoji.shortcuts[0];
        }
        // For standard emojis, use emoji_id (e.g., "❤")
        return run.emoji.emoji_id || run.text || '';
      }
      return run.text ?? '';
    }).join('');
  }

  return '';
}

function resolveTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  
  if (Number.isFinite(numeric)) {
    // YouTube timestamps are in microseconds (16 digits) or milliseconds (13 digits)
    // If it's microseconds (>= 1e15), divide by 1000 to get milliseconds
    // If it's milliseconds (>= 1e12), use as is
    let millis: number;
    if (numeric >= 1e15) {
      // Microseconds - convert to milliseconds
      millis = numeric / 1000;
    } else if (numeric >= 1e12) {
      // Already milliseconds
      millis = numeric;
    } else {
      // Fallback for smaller numbers
      millis = numeric;
    }
    
    return new Date(millis).toISOString();
  }

  return new Date().toISOString();
}

function extractBadges(item: any): Badge[] {
  const badges: Badge[] = [];
  
  if (!item.author?.badges) return badges;

  for (const badge of item.author.badges) {
    const label = badge.tooltip ?? badge.label ?? '';
    const imageUrl = badge.custom_thumbnail?.[0]?.url;
    
    if (label.toLowerCase().includes('moderator')) {
      badges.push({ type: 'moderator', label, imageUrl });
    } else if (label.toLowerCase().includes('member')) {
      badges.push({ type: 'member', label, imageUrl });
    } else if (label.toLowerCase().includes('verified')) {
      badges.push({ type: 'verified', label, imageUrl });
    } else if (label) {
      badges.push({ type: 'custom', label, imageUrl });
    }
  }

  return badges;
}

function extractBadgesFromHeader(header: any): Badge[] {
  const badges: Badge[] = [];
  
  if (!header?.author_badges) return badges;

  for (const badge of header.author_badges) {
    const label = badge.tooltip ?? '';
    const iconType = badge.icon_type ?? '';
    const imageUrl = badge.custom_thumbnail?.[0]?.url;
    
    if (label.toLowerCase().includes('moderator') || iconType === 'MODERATOR') {
      badges.push({ type: 'moderator', label, imageUrl });
    } else if (label.toLowerCase().includes('member')) {
      badges.push({ type: 'member', label, imageUrl });
    } else if (label.toLowerCase().includes('verified') || iconType === 'VERIFIED') {
      badges.push({ type: 'verified', label, imageUrl });
    } else if (iconType === 'OWNER') {
      badges.push({ type: 'custom', label: label || 'Owner', imageUrl });
    } else if (label) {
      badges.push({ type: 'custom', label, imageUrl });
    }
  }

  return badges;
}

function extractLeaderboardRank(item: any): number | undefined {
  // Check for before_content_buttons array (where leaderboard badge appears)
  if (!Array.isArray(item.before_content_buttons)) return undefined;
  
  for (const button of item.before_content_buttons) {
    // Look for CROWN icon (leaderboard indicator)
    if (button.icon_name === 'CROWN' && button.title) {
      // Title is like "#3", "#1", etc.
      const match = String(button.title).match(/#(\d+)/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
  }
  
  return undefined;
}

function extractSuperChatInfo(item: any): SuperChatInfo | undefined {
  const superTypes = new Set([
    'LiveChatPaidMessage',
    'LiveChatPaidSticker',
    'liveChatPaidMessageRenderer',
    'liveChatPaidStickerRenderer'
  ]);
  const typeName = String(item.type || item.item_type || item.renderer || '').trim();
  const isSuper = superTypes.has(typeName) || !!(item.purchase_amount);
  if (!isSuper) return undefined;

  let amountText = '';
  const candidates = [
    item.purchase_amount,  // Correct property name from youtubei.js docs
    item.purchase_amount_text,  // Fallback
    item.purchaseAmountText,
    item.header?.purchase_amount,
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
    if (typeof v.toString === 'function' && v.toString !== Object.prototype.toString) {
      return v.toString();
    }
    return '';
  }

  for (const v of candidates) {
    amountText = toText(v);
    if (amountText) break;
  }

  let amount = '';
  let currency = '';

  if (amountText) {
    // Regex to capture currency symbol/code and amount
    // Handles: $5.00, €5,00, 5,00 €, 5.00 USD, TRY5.00, TRY 55, etc.
    const match = amountText.match(/([\$\€\£\¥\₹\₺]|[A-Z]{2,3})?\s*([\d,\.]+)\s*([\$\€\£\¥\₹\₺]|[A-Z]{2,3})?/);
    if (match) {
      // Prefer currency symbol/code before the number, fallback to after
      currency = match[1] || match[3] || '';
      amount = match[2];
    } else {
      // Fallback: use the whole text if no pattern matches
      amount = amountText;
    }
  }
  
  // If we still don't have an amount, use a default
  if (!amount) {
    amount = 'Super Chat';
  }

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

  // Extract super sticker image URL if present
  let stickerUrl: string | undefined;
  let stickerAlt: string | undefined;
  
  if (Array.isArray(item.sticker) && item.sticker.length > 0) {
    // Prefer larger image (first in array is usually largest)
    const stickerThumb = item.sticker[0];
    if (stickerThumb?.url) {
      // URLs from YouTube might be protocol-relative (//domain.com)
      // Convert to absolute HTTPS URL
      let url = String(stickerThumb.url);
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      stickerUrl = url;
    }
    
    // Extract accessibility label for alt text
    if (item.sticker_accessibility_label) {
      stickerAlt = String(item.sticker_accessibility_label);
    }
  }

  return {
    amount,
    currency,
    color,
    stickerUrl,
    stickerAlt
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
  const messageText = resolveMessageText(item).toLowerCase();
  
  const isText = itemType === 'LiveChatTextMessage';
  const isPaid = !!extractSuperChatInfo(item);
  const isMembership = itemType === 'LiveChatMembershipItem';
  const isGiftPurchase = itemType === 'LiveChatSponsorshipsGiftPurchaseAnnouncement';
  const isGiftReceived = itemType === 'LiveChatSponsorshipsGiftRedemptionAnnouncement';
  
  // Check if the message text indicates it's a gift recipient message
  const isGiftRecipientMessage = 
    messageText.includes('received a gift membership') || 
    messageText.includes('received a membership gift') ||
    messageText.includes('received a gift') ||
    /received\s+a\s+.*membership.*by/i.test(messageText);

  // Ignore gift received messages - we only care about the purchaser
  if (isGiftReceived || isGiftRecipientMessage) {
    return null;
  }

  if (isText || isPaid || isMembership || isGiftPurchase) {
    // For gift purchases, author info is in header
    const authorSource = isGiftPurchase ? item.header : item;
    const badges = isGiftPurchase ? extractBadgesFromHeader(item.header) : extractBadges(item);
    const isModerator = badges.some(b => b.type === 'moderator');
    const isMember = badges.some(b => b.type === 'member');
    const isVerified = badges.some(b => b.type === 'verified');
    
    // Extract membership level for new members, upgrades, and milestones
    let membershipLevel: string | undefined;
    if (isMembership) {
      const subtext: string = item.header_subtext?.text || '';
      const primaryText: string = item.header_primary_text?.text || '';

      // Try to capture level name from common phrases
      // e.g., "Welcome to User!" => "User"
      // e.g., "Upgraded membership to Superuser!" => "Superuser"
      let levelFromSub: string | undefined;
      const welcomeMatch = subtext.match(/Welcome to\s+(.+?)!/i);
      const upgradeMatch = subtext.match(/Upgraded membership to\s+(.+?)!/i);
      if (welcomeMatch?.[1]) {
        levelFromSub = welcomeMatch[1].trim();
      } else if (upgradeMatch?.[1]) {
        levelFromSub = upgradeMatch[1].trim();
      }

      membershipLevel = levelFromSub || primaryText || 'New member';
    } else if (isGiftPurchase) {
      // For gift purchases, we don't need membership level
      membershipLevel = undefined;
    } else if (isPaid) {
      membershipLevel = undefined;
    }
    
    // Extract gift count for gift purchases
    let giftCount: number | undefined;
    if (isGiftPurchase) {
      const primaryText = item.header?.primary_text?.text || '';
      // Extract number from "Sent 1 Yusuf İpek gift memberships"
      const countMatch = primaryText.match(/sent\s+(\d+)\s+/i);
      if (countMatch) {
        giftCount = parseInt(countMatch[1], 10);
      }
    }
    
    // Extract channel ID - for gifts it's in author_external_channel_id
    const authorChannelId = isGiftPurchase 
      ? item.author_external_channel_id 
      : item.author?.id;
    
    // Extract author name and photo
    const authorName = isGiftPurchase
      ? (item.header?.author_name?.text || 'Unknown')
      : String(item.author?.name ?? 'Unknown');
    
    const authorPhoto = isGiftPurchase
      ? item.header?.author_photo?.[0]?.url
      : item.author?.thumbnails?.[0]?.url;
    
    // Build text with fallback: if no user message, show header subtext/primary for membership events
    const resolvedText = resolveMessageText(item);
    const membershipFallbackText = isMembership
      ? (item.header_subtext?.text || item.header_primary_text?.text || '')
      : '';

    // Use timestamp_usec (microseconds) as it's more accurate than timestamp (milliseconds)
    const timestampToUse = item.timestamp_usec ?? item.timestamp;

    // Extract leaderboard rank if present
    const leaderboardRank = extractLeaderboardRank(item);

    // Generate a unique ID - YouTube message IDs might not be unique in high-frequency chats
    // so we track seen IDs and append a counter if needed
    const baseId = String(item.id ?? item.timestamp_usec ?? Date.now());
    const uniqueId = generateUniqueId(baseId);

    return {
      id: uniqueId,
      author: authorName,
      authorPhoto,
      authorChannelId: authorChannelId ? String(authorChannelId) : undefined,
      text: resolvedText || membershipFallbackText,
      runs: (() => { const r = resolveMessageRuns(item); return r.length ? r : undefined; })(),
      publishedAt: resolveTimestamp(timestampToUse),
      badges: badges.length > 0 ? badges : undefined,
      isModerator,
      isMember,
      isVerified,
      superChat: extractSuperChatInfo(item),
      membershipGift: isMembership,
      membershipGiftPurchase: isGiftPurchase,
      membershipLevel,
      giftCount,
      leaderboardRank
    };
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

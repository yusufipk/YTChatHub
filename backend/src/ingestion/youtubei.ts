import type { ChatMessage, Badge, MessageRun, SuperChatInfo, Poll } from '@shared/chat';
import EventEmitter from 'eventemitter3';
import Innertube from 'youtubei.js';

export type IngestionContext = {
  client: Innertube;
  liveChat: any;
  videoId: string;
  title: string | null;
  /** Like count when the chat connected; null when YouTube hides it. */
  likeCount: number | null;
  /** Concurrent viewers when the chat connected; null when the video is not live. */
  viewerCount: number | null;
  emitter: ChatEventEmitter;
};

export type ChatEventEmitter = EventEmitter<{
  message: (message: ChatMessage) => void;
  poll: (poll: Poll | null) => void;
  /** Concurrent viewers, from the live chat's metadata updates. */
  viewers: (count: number | null) => void;
  error: (error: unknown) => void;
  end: () => void;
}>;

const SEEN_IDS_CAP = 5000;

// YouTube reuses message ids in busy chats; a per-id counter keeps ours unique.
const seenIds = new Map<string, number>();

function generateUniqueId(baseId: string): string {
  if (seenIds.size > SEEN_IDS_CAP) seenIds.clear();
  const count = seenIds.get(baseId) ?? 0;
  seenIds.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}#${count}`;
}

/**
 * Turns the raw navigation URL of a text run into the absolute destination.
 * YouTube wraps external links in /redirect?q=<url> and uses site-relative paths for its own.
 */
export function resolveRunUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const absolute = raw.startsWith('/') ? `https://www.youtube.com${raw}` : raw;
  try {
    const url = new URL(absolute);
    if (url.hostname.endsWith('youtube.com') && url.pathname === '/redirect') {
      return url.searchParams.get('q') ?? absolute;
    }
    return absolute;
  } catch {
    return undefined;
  }
}

// Reads the run endpoint youtubei.js exposes on TextRun. Verified against the library types, not yet against a live chat carrying a long link.
function runUrl(run: any): string | undefined {
  return resolveRunUrl(
    run?.endpoint?.payload?.url ??
      run?.endpoint?.metadata?.url ??
      run?.navigationEndpoint?.urlEndpoint?.url ??
      run?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
  );
}

// The visible text of a link run may be shortened; the endpoint keeps the full URL.
function isTruncated(text: string, url: string): boolean {
  return text.endsWith('...') || text.endsWith('…') || text.length < url.length;
}

function resolveMessageRuns(item: any): MessageRun[] {
  const runs: MessageRun[] = [];
  const rawRuns = item?.message?.runs;
  if (!Array.isArray(rawRuns)) return runs;
  for (const run of rawRuns) {
    if (run?.emoji) {
      runs.push({
        emojiUrl: run.emoji?.image?.[0]?.url,
        emojiAlt: run.emoji?.shortcuts?.[0] || run.emoji?.emoji_id || ''
      });
    } else if (run?.text) {
      const url = runUrl(run);
      runs.push(url ? { text: String(run.text), url } : { text: String(run.text) });
    }
  }
  return runs;
}

function resolveMessageText(item: any): string {
  const message = item?.message;
  if (!message) return '';
  if (typeof message === 'string') return message;

  if (Array.isArray(message.runs)) {
    return message.runs
      .map((run: any) => {
        if (run?.emoji) {
          return (run.emoji.is_custom && run.emoji.shortcuts?.[0]) || run.emoji.emoji_id || run.text || '';
        }
        const text = String(run?.text ?? '');
        const url = runUrl(run);
        return url && isTruncated(text, url) ? url : text;
      })
      .join('');
  }

  return typeof message.toString === 'function' ? message.toString() : '';
}

export async function bootstrapInnertube(videoId: string): Promise<IngestionContext> {
  if (!videoId) {
    throw new Error('YOUTUBE_LIVE_ID is required to bootstrap Innertube');
  }
  seenIds.clear();

  console.log('[Ingestion] Creating Innertube client...');
  // No cache: even UniversalCache(false) writes session data to os.tmpdir(), and a session captured during a
  // network hiccup came back poisoned on every reconnect (YouTube answered 400 "unusual traffic" until it was deleted).
  // The player is skipped because chat never needs stream formats.
  const client = await Innertube.create({ retrieve_player: false });

  console.log('[Ingestion] Fetching video info...');
  const info = await client.getInfo(videoId);
  const title = info.basic_info?.title ?? null;
  const likeCount = readLikeCount(info);
  const viewerCount = readViewerCount(info);

  console.log('[Ingestion] Getting live chat...');
  const liveChat = info.getLiveChat();

  if (!liveChat) {
    throw new Error('This video does not have an active live chat');
  }

  const emitter: ChatEventEmitter = new EventEmitter();

  liveChat.on('chat-update', (action: any) => {
    if (action?.type === 'UpdateLiveChatPollAction') {
      const pollId = action?.poll_to_update?.live_chat_poll_id;
      if (pollId) {
        emitter.emit('poll', { id: String(pollId), active: true });
      }
      return;
    }

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
    // Unknown renderer types are parser drift that youtubei.js generates stubs for; not a connection problem.
    if (/\w+(Command|Action) not found/.test(msg)) return;
    console.error('[Ingestion] Live chat error:', err);
    emitter.emit('error', err);
  });

  liveChat.on('metadata-update', (metadata: any) => {
    const views = metadata?.views;
    // Off air the same field carries the lifetime view count, which must not read as "watching".
    if (views?.is_live !== true) {
      emitter.emit('viewers', null);
      return;
    }
    const count = views.original_view_count;
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) emitter.emit('viewers', count);
  });

  liveChat.on('end', () => emitter.emit('end'));

  console.log('[Ingestion] Starting live chat listener...');
  liveChat.start();
  console.log('[Ingestion] Live chat listener started');

  return { client, liveChat, videoId, title, likeCount, viewerCount, emitter };
}

function readLikeCount(info: { basic_info?: { like_count?: number } }): number | null {
  const count = info.basic_info?.like_count;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

function readViewerCount(info: { basic_info?: { is_live?: boolean }; primary_info?: unknown }): number | null {
  // Off air the same field is the lifetime view count.
  if (info.basic_info?.is_live !== true) return null;
  const count = Number((info.primary_info as { view_count?: { original_view_count?: unknown } } | null | undefined)?.view_count?.original_view_count);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

/**
 * Reads the current like and viewer counts. The live chat's metadata updates leave likes empty, so this refetches
 * the watch page data; the viewer count rides along as a backup for the metadata updates, whose poll can stall.
 */
export async function fetchStats(ctx: IngestionContext): Promise<{ likes: number | null; viewers: number | null }> {
  const info = await ctx.client.getInfo(ctx.videoId);
  return { likes: readLikeCount(info), viewers: readViewerCount(info) };
}

function resolveTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;

  if (Number.isFinite(numeric)) {
    // YouTube sends microseconds (16 digits) or milliseconds (13 digits).
    const millis = numeric >= 1e15 ? numeric / 1000 : numeric;
    return new Date(millis).toISOString();
  }

  return new Date().toISOString();
}

function extractBadges(list: any): Badge[] {
  const badges: Badge[] = [];
  if (!Array.isArray(list)) return badges;

  for (const badge of list) {
    const label: string = badge.tooltip ?? badge.label ?? '';
    const iconType: string = badge.icon_type ?? '';
    const imageUrl = badge.custom_thumbnail?.[0]?.url;
    const lower = label.toLowerCase();

    if (iconType === 'MODERATOR' || lower.includes('moderator')) {
      badges.push({ type: 'moderator', label, imageUrl });
    } else if (lower.includes('member')) {
      badges.push({ type: 'member', label, imageUrl });
    } else if (iconType === 'VERIFIED' || lower.includes('verified')) {
      badges.push({ type: 'verified', label, imageUrl });
    } else if (iconType === 'OWNER') {
      badges.push({ type: 'owner', label: label || 'Owner', imageUrl });
    } else if (label) {
      badges.push({ type: 'custom', label, imageUrl });
    }
  }

  return badges;
}

function extractLeaderboardRank(item: any): number | undefined {
  if (!Array.isArray(item.before_content_buttons)) return undefined;

  for (const button of item.before_content_buttons) {
    // The CROWN button carries the rank as "#3".
    if (button.icon_name === 'CROWN' && button.title) {
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
    item.purchase_amount,
    item.purchase_amount_text,
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
    // Handles $5.00, 5,00 EUR, TRY 55 and similar: symbol or code on either side of the number.
    const match = amountText.match(/([\$\€\£\¥\₹\₺]|[A-Z]{2,3})?\s*([\d,\.]+)\s*([\$\€\£\¥\₹\₺]|[A-Z]{2,3})?/);
    if (match) {
      currency = match[1] || match[3] || '';
      amount = match[2];
    } else {
      amount = amountText;
    }
  }

  if (!amount) {
    amount = 'Super Chat';
  }

  const rawColor = item.body_background_color ?? item.bodyBackgroundColor ?? item.headerBackgroundColor;
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

  let stickerUrl: string | undefined;
  let stickerAlt: string | undefined;

  if (Array.isArray(item.sticker) && item.sticker.length > 0) {
    const stickerThumb = item.sticker[0];
    if (stickerThumb?.url) {
      // Sticker URLs may be protocol-relative.
      let url = String(stickerThumb.url);
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      stickerUrl = url;
    }

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

  const itemType = String(item.type || '').trim();
  const resolvedText = resolveMessageText(item);
  const messageText = resolvedText.toLowerCase();

  const isText = itemType === 'LiveChatTextMessage';
  const isPaid = !!extractSuperChatInfo(item);
  const isMembership = itemType === 'LiveChatMembershipItem';
  const isGiftPurchase = itemType === 'LiveChatSponsorshipsGiftPurchaseAnnouncement';
  const isGiftReceived = itemType === 'LiveChatSponsorshipsGiftRedemptionAnnouncement';

  const isGiftRecipientMessage =
    messageText.includes('received a gift membership') ||
    messageText.includes('received a membership gift') ||
    messageText.includes('received a gift') ||
    /received\s+a\s+.*membership.*by/i.test(messageText);

  // Only the purchaser of a gift is shown, not each recipient.
  if (isGiftReceived || isGiftRecipientMessage) {
    return null;
  }

  if (!(isText || isPaid || isMembership || isGiftPurchase)) {
    return null;
  }

  // Gift purchase announcements carry author data in the header.
  const badges = extractBadges(isGiftPurchase ? item.header?.author_badges : item.author?.badges);
  const isModerator = badges.some(b => b.type === 'moderator');
  const isMember = badges.some(b => b.type === 'member');
  const isVerified = badges.some(b => b.type === 'verified');

  let membershipLevel: string | undefined;
  if (isMembership) {
    const subtext: string = item.header_subtext?.text || '';
    const primaryText: string = item.header_primary_text?.text || '';
    // "Welcome to Level!" or "Upgraded membership to Level!"
    const levelMatch = subtext.match(/(?:Welcome to|Upgraded membership to)\s+(.+?)!/i);
    membershipLevel = levelMatch?.[1]?.trim() || primaryText || 'New member';
  }

  let giftCount: number | undefined;
  if (isGiftPurchase) {
    // "Sent 5 Channel gift memberships"
    const countMatch = String(item.header?.primary_text?.text || '').match(/sent\s+(\d+)\s+/i);
    if (countMatch) {
      giftCount = parseInt(countMatch[1], 10);
    }
  }

  const authorChannelId = isGiftPurchase ? item.author_external_channel_id : item.author?.id;
  const authorName = isGiftPurchase
    ? (item.header?.author_name?.text || 'Unknown')
    : String(item.author?.name ?? 'Unknown');
  const authorPhoto = isGiftPurchase
    ? item.header?.author_photo?.[0]?.url
    : item.author?.thumbnails?.[0]?.url;

  const membershipFallbackText = isMembership
    ? (item.header_subtext?.text || item.header_primary_text?.text || '')
    : '';

  const runs = resolveMessageRuns(item);

  return {
    id: generateUniqueId(String(item.id ?? item.timestamp_usec ?? Date.now())),
    author: authorName,
    authorPhoto,
    authorChannelId: authorChannelId ? String(authorChannelId) : undefined,
    text: resolvedText || membershipFallbackText,
    runs: runs.length ? runs : undefined,
    publishedAt: resolveTimestamp(item.timestamp_usec ?? item.timestamp),
    badges: badges.length > 0 ? badges : undefined,
    isModerator,
    isMember,
    isVerified,
    superChat: extractSuperChatInfo(item),
    membershipGift: isMembership,
    membershipGiftPurchase: isGiftPurchase,
    membershipLevel,
    giftCount,
    leaderboardRank: extractLeaderboardRank(item)
  };
}

import type { ShowState } from './show';

export type Badge = {
  type: 'moderator' | 'member' | 'verified' | 'owner' | 'custom';
  label?: string;
  imageUrl?: string;
};

export type SuperChatInfo = {
  amount: string;
  currency: string;
  color: string;
  stickerUrl?: string;
  stickerAlt?: string;
};

/** A YouTube gift bought with jewels. The chat item names the gift but not its jewel price. */
export type GiftInfo = {
  name: string;
  imageUrl?: string;
  /** Jewel price from our own table; undefined for gifts not in it yet. */
  jewels?: number;
};

/**
 * Where gift prices stand. `expired` and `failed` keep using the last saved prices (`count`, `updatedAt`)
 * until the cookie is replaced; `off` means no cookie is configured and nothing was saved.
 */
export type GiftPricesStatus = {
  state: 'off' | 'ok' | 'expired' | 'failed';
  count: number;
  updatedAt: number | null;
  error?: string;
};

export type MessageRun = {
  text?: string;
  /** Full destination URL when YouTube rendered this run as a link. The visible text may be truncated. */
  url?: string;
  emojiUrl?: string;
  emojiAlt?: string;
};

export type Poll = {
  id: string;
  active: boolean;
};

export type ChatMessage = {
  id: string;
  author: string;
  authorPhoto?: string;
  authorChannelId?: string;
  text: string;
  runs?: MessageRun[];
  publishedAt: string;
  badges?: Badge[];
  isModerator?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
  superChat?: SuperChatInfo;
  gift?: GiftInfo;
  membershipGift?: boolean;
  membershipGiftPurchase?: boolean;
  membershipLevel?: string;
  giftCount?: number;
  leaderboardRank?: number;
};

export type ConnectionState = 'disconnected' | 'connecting' | 'live' | 'reconnecting';

export type ConnectionStatus = {
  state: ConnectionState;
  liveId: string | null;
  title?: string | null;
  error?: string | null;
};

/**
 * Events pushed on the single `/ws` WebSocket.
 * `init` is sent once per connection with the full current state; the rest are deltas.
 */
export type ServerEvent =
  | { type: 'init'; status: ConnectionStatus; messages: ChatMessage[]; selection: ChatMessage | null; poll: Poll | null; show: ShowState; gifts: GiftPricesStatus }
  | { type: 'gifts'; gifts: GiftPricesStatus }
  /** Replaces the whole message list, used when a saved stream is restored. */
  | { type: 'messages'; messages: ChatMessage[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'selection'; message: ChatMessage | null }
  | { type: 'poll'; poll: Poll | null }
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'show'; show: ShowState }
  | { type: 'clear' };

export type ServerEventType = ServerEvent['type'];

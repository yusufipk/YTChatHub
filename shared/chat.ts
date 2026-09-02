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
 * Events pushed on the single `/events` SSE stream.
 * `init` is sent once per connection with the full current state; the rest are deltas.
 */
export type ServerEvent =
  | { type: 'init'; status: ConnectionStatus; messages: ChatMessage[]; selection: ChatMessage | null; poll: Poll | null }
  | { type: 'message'; message: ChatMessage }
  | { type: 'selection'; message: ChatMessage | null }
  | { type: 'poll'; poll: Poll | null }
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'clear' };

export type ServerEventType = ServerEvent['type'];

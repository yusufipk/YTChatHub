export type Badge = {
  type: 'moderator' | 'member' | 'verified' | 'custom';
  label?: string;
  icon?: string;
  imageUrl?: string; // For custom membership badges
};

export type SuperChatInfo = {
  amount: string;
  currency: string;
  color: string;
  stickerUrl?: string; // For super stickers
  stickerAlt?: string; // Accessibility label for super stickers
};

export type MessageRun = {
  text?: string;
  emojiUrl?: string;
  emojiAlt?: string;
};

export type Poll = {
  id: string; // live_chat_poll_id from YouTube
  active: boolean;
};

export type ChatMessage = {
  id: string;
  author: string;
  authorPhoto?: string;
  authorChannelId?: string;
  text: string;
  runs?: MessageRun[]; // structured runs for emojis
  publishedAt: string;
  badges?: Badge[];
  isModerator?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
  superChat?: SuperChatInfo;
  membershipGift?: boolean;
  membershipGiftPurchase?: boolean;
  membershipLevel?: string; // e.g., "New member", "Member (6 months)", etc.
  giftCount?: number; // Number of memberships gifted
  leaderboardRank?: number; // YouTube leaderboard rank (1, 2, 3, etc.)
};

export type Badge = {
  type: 'moderator' | 'member' | 'verified' | 'custom';
  label?: string;
  icon?: string;
};

export type SuperChatInfo = {
  amount: string;
  currency: string;
  color: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  authorPhoto?: string;
  text: string;
  publishedAt: string;
  badges?: Badge[];
  isModerator?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
  superChat?: SuperChatInfo;
  membershipGift?: boolean;
  membershipLevel?: string; // e.g., "New member", "Member (6 months)", etc.
};

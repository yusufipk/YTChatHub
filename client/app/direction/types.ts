import type { ChatMessage } from '@shared/chat';

export type MessageTypeFilter = 'all' | 'regular' | 'superchat' | 'membership';
export type SearchMode = 'plain' | 'regex';

export type BadgeFilterState = {
  moderator: boolean;
  member: boolean;
  verified: boolean;
};

export type FilterState = {
  search: string;
  searchMode: SearchMode;
  messageType: MessageTypeFilter;
  authorFilter: string;
  badgeFilters: BadgeFilterState;
  limit: number;
};

export type OverlayActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export type ChatMessagesReply = {
  messages: ChatMessage[];
  total: number;
  totalMatches?: number;
  pageCount?: number;
  nextCursor: string | null;
  hasMore: boolean;
  appliedFilters?: {
    search: string | null;
    mode: SearchMode;
    type: MessageTypeFilter | 'all';
    author: string | null;
    badges: string[];
    limit: number;
  };
  error?: string;
};

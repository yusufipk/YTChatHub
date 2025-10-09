'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { ChatMessage } from '@shared/chat';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';

type MessageTypeFilter = 'all' | 'regular' | 'superchat' | 'membership';
type SearchMode = 'plain' | 'regex';

type BadgeFilterState = {
  moderator: boolean;
  member: boolean;
  verified: boolean;
};

type ChatMessagesReply = {
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

type OverlayActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

type FilterState = {
  search: string;
  searchMode: SearchMode;
  messageType: MessageTypeFilter;
  authorFilter: string;
  badgeFilters: BadgeFilterState;
  limit: number;
};

const initialBadgeState: BadgeFilterState = {
  moderator: false,
  member: false,
  verified: false
};

const DEFAULT_LIMIT = 75;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_PAGE_LIMIT = 200;
const AUTO_REFRESH_INTERVAL_MS = 5000;

function composeFilters(args: FilterState): FilterState {
  const { search, searchMode, messageType, authorFilter, badgeFilters, limit } = args;
  return {
    search,
    searchMode,
    messageType,
    authorFilter,
    badgeFilters: { ...badgeFilters },
    limit
  };
}

function areBadgeFiltersEqual(a: BadgeFilterState, b: BadgeFilterState): boolean {
  return a.moderator === b.moderator && a.member === b.member && a.verified === b.verified;
}

function areFiltersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.search === b.search &&
    a.searchMode === b.searchMode &&
    a.messageType === b.messageType &&
    a.authorFilter === b.authorFilter &&
    a.limit === b.limit &&
    areBadgeFiltersEqual(a.badgeFilters, b.badgeFilters)
  );
}

export default function DirectionPage() {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('plain');
  const [messageType, setMessageType] = useState<MessageTypeFilter>('all');
  const [authorFilter, setAuthorFilter] = useState('');
  const [badgeFilters, setBadgeFilters] = useState<BadgeFilterState>({ ...initialBadgeState });
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null);

  const [results, setResults] = useState<ChatMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayStatus, setOverlayStatus] = useState<OverlayActionState>({ status: 'idle', message: '' });

  const { highlightRegex, regexError } = useMemo(() => buildHighlightRegex(search, searchMode), [search, searchMode]);
  const authorHighlightRegex = useMemo(() => {
    const trimmed = authorFilter.trim();
    if (!trimmed) return null;
    try {
      return new RegExp(escapeRegExp(trimmed), 'gi');
    } catch {
      return null;
    }
  }, [authorFilter]);

  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(() =>
    composeFilters({
      search,
      searchMode,
      messageType,
      authorFilter,
      badgeFilters,
      limit
    })
  );

  const inflightRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      const nextFilters = composeFilters({
        search,
        searchMode,
        messageType,
        authorFilter,
        badgeFilters,
        limit
      });
      setDebouncedFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [search, searchMode, messageType, authorFilter, badgeFilters, limit]);

  const loadMessages = useCallback(async ({
    reset,
    cursor,
    allowOverlap = true
  }: {
    reset: boolean;
    cursor?: string | null;
    allowOverlap?: boolean;
  }) => {
    if (regexError && debouncedFilters.searchMode === 'regex') {
      setError(regexError);
      return;
    }

    if (inflightRef.current && !allowOverlap) {
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    inflightRef.current = true;
    setLoading(true);
    setError(null);

    let aborted = false;

    try {
      const params = new URLSearchParams();

      if (debouncedFilters.search.trim()) {
        params.set('search', debouncedFilters.search.trim());
      }

      if (debouncedFilters.searchMode === 'regex') {
        params.set('mode', 'regex');
      }

      if (debouncedFilters.messageType !== 'all') {
        params.set('type', debouncedFilters.messageType);
      }

      if (debouncedFilters.authorFilter.trim()) {
        params.set('author', debouncedFilters.authorFilter.trim());
      }

      const badgeList = Object.entries(debouncedFilters.badgeFilters)
        .filter(([, value]) => value)
        .map(([key]) => key);

      if (badgeList.length) {
        params.set('badges', badgeList.join(','));
      }

      params.set('limit', String(debouncedFilters.limit));

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`${BACKEND_URL}/chat/messages?${params.toString()}`, {
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await safeJson(response);
        throw new Error(payload?.error || `Request failed with status ${response.status}`);
      }

      const payload: ChatMessagesReply = await response.json();
      const incomingBatch = payload.messages.slice().reverse();

      setNextCursor(payload.nextCursor ?? null);

      setResults((prev) => {
        if (reset) {
          const totalMatches = payload.totalMatches ?? payload.total ?? incomingBatch.length;
          setTotal(totalMatches);
          return incomingBatch;
        }

        const existingIds = new Set(prev.map((message) => message.id));
        const merged = [...prev];
        for (const message of incomingBatch) {
          if (!existingIds.has(message.id)) {
            merged.push(message);
          }
        }

        const totalMatches = payload.totalMatches ?? payload.total ?? merged.length;
        setTotal(totalMatches);
        return merged;
      });
      setOverlayStatus((current) => (current.status === 'success' ? current : { status: 'idle', message: '' }));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        aborted = true;
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load messages';
        setError(message);
      }
    } finally {
      const isLatest = requestIdRef.current === requestId;
      if (isLatest) {
        setLoading(false);
        inflightRef.current = false;
        if (!aborted) {
          lastFetchRef.current = Date.now();
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
      if (aborted || !isLatest) {
        return;
      }
    }
  }, [debouncedFilters, regexError]);

  useEffect(() => {
    void loadMessages({ reset: true });
  }, [loadMessages]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (inflightRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastFetchRef.current < AUTO_REFRESH_INTERVAL_MS) {
        return;
      }
      void loadMessages({ reset: true, allowOverlap: false });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [loadMessages]);

  const handleToggleBadge = (badge: keyof BadgeFilterState) => {
    setBadgeFilters((prev) => ({
      ...prev,
      [badge]: !prev[badge]
    }));
  };

  const clearFilters = () => {
    setSearch('');
    setSearchMode('plain');
    setMessageType('all');
    setAuthorFilter('');
    setBadgeFilters({ ...initialBadgeState });
    setLimit(DEFAULT_LIMIT);
    setSelectedViewer(null);
    const nextFilters = composeFilters({
      search: '',
      searchMode: 'plain',
      messageType: 'all',
      authorFilter: '',
      badgeFilters: { ...initialBadgeState },
      limit: DEFAULT_LIMIT
    });
    setDebouncedFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
  };

  const handleLoadMore = () => {
    if (nextCursor) {
      void loadMessages({ reset: false, cursor: nextCursor });
    }
  };

  const handleOverlaySelection = async (messageId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/overlay/selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId })
      });

      if (!response.ok) {
        throw new Error('Failed to send message to overlay');
      }

      setOverlayStatus({ status: 'success', message: 'Message sent to overlay' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message to overlay';
      setOverlayStatus({ status: 'error', message });
    }
  };

  const handleSelectViewer = (viewer: string) => {
    const trimmed = viewer.trim();
    if (!trimmed) {
      setAuthorFilter('');
      setSelectedViewer(null);
      return;
    }
    setAuthorFilter(trimmed);
    setSelectedViewer(trimmed);
    const nextFilters = composeFilters({
      search,
      searchMode,
      messageType,
      authorFilter: trimmed,
      badgeFilters,
      limit
    });
    setDebouncedFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
  };

  return (
    <div className="direction">
      <header className="direction__header">
        <div>
          <h1>Direction Studio</h1>
          <p className="direction__subtitle">High-speed search and filtering for directing on-stream moments.</p>
        </div>
        <div className="direction__meta">
          <span className="direction__meta-item">Total matches: {total}</span>
          {loading && <span className="direction__meta-item direction__meta-item--loading">Loading…</span>}
        </div>
      </header>

      <section className="direction__filters">
        <div className="direction__filters-main">
          <div className="direction__field">
            <label htmlFor="direction-search">Search</label>
            <input
              id="direction-search"
              type="text"
              placeholder={searchMode === 'regex' ? 'Enter regex pattern…' : 'Search messages…'}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {regexError && searchMode === 'regex' && (
              <p className="direction__hint direction__hint--error">{regexError}</p>
            )}
            {!regexError && search && (
              <p className="direction__hint">Matched text will be highlighted in results.</p>
            )}
          </div>

          <div className="direction__field-group">
            <fieldset className="direction__fieldset">
              <legend>Search Mode</legend>
              <label>
                <input
                  type="radio"
                  name="search-mode"
                  value="plain"
                  checked={searchMode === 'plain'}
                  onChange={() => setSearchMode('plain')}
                />
                Plain text
              </label>
              <label>
                <input
                  type="radio"
                  name="search-mode"
                  value="regex"
                  checked={searchMode === 'regex'}
                  onChange={() => setSearchMode('regex')}
                />
                Regex
              </label>
            </fieldset>

            <fieldset className="direction__fieldset">
              <legend>Message Type</legend>
              <label>
                <input
                  type="radio"
                  name="message-type"
                  value="all"
                  checked={messageType === 'all'}
                  onChange={() => setMessageType('all')}
                />
                All
              </label>
              <label>
                <input
                  type="radio"
                  name="message-type"
                  value="regular"
                  checked={messageType === 'regular'}
                  onChange={() => setMessageType('regular')}
                />
                Regular
              </label>
              <label>
                <input
                  type="radio"
                  name="message-type"
                  value="superchat"
                  checked={messageType === 'superchat'}
                  onChange={() => setMessageType('superchat')}
                />
                Super Chat
              </label>
              <label>
                <input
                  type="radio"
                  name="message-type"
                  value="membership"
                  checked={messageType === 'membership'}
                  onChange={() => setMessageType('membership')}
                />
                Membership
              </label>
            </fieldset>
          </div>
        </div>

        <div className="direction__filters-secondary">
          <div className="direction__field">
            <label htmlFor="direction-author">Author</label>
            <input
              id="direction-author"
              type="text"
              placeholder="Filter by author…"
              value={authorFilter}
              onChange={(event) => {
                const value = event.target.value;
                setAuthorFilter(value);
                const trimmed = value.trim();
                setSelectedViewer(trimmed ? trimmed : null);
              }}
            />
          </div>

          <fieldset className="direction__fieldset direction__fieldset--badges">
            <legend>Badges</legend>
            {(['moderator', 'member', 'verified'] as Array<keyof BadgeFilterState>).map((badge) => (
              <label key={badge}>
                <input
                  type="checkbox"
                  checked={badgeFilters[badge]}
                  onChange={() => handleToggleBadge(badge)}
                />
                {capitalize(badge)}
              </label>
            ))}
          </fieldset>

          <div className="direction__field direction__field--compact">
            <label htmlFor="direction-limit">Page Size</label>
            <input
              id="direction-limit"
              type="number"
              min={10}
              max={MAX_PAGE_LIMIT}
              value={limit}
              onChange={(event) => setLimit(clamp(Number(event.target.value) || DEFAULT_LIMIT, 10, MAX_PAGE_LIMIT))}
            />
          </div>

          <div className="direction__actions">
            <button type="button" className="direction__button direction__button--ghost" onClick={clearFilters}>
              Clear filters
            </button>
            <button
              type="button"
              className="direction__button"
              onClick={() => void loadMessages({ reset: true })}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {overlayStatus.status !== 'idle' && (
        <div className={`direction__overlay-status direction__overlay-status--${overlayStatus.status}`}>
          {overlayStatus.message}
        </div>
      )}

      {selectedViewer && (
        <div className="direction__viewer">
          <span className="direction__viewer-label">Viewer:</span>
          <span className="direction__viewer-name">{selectedViewer}</span>
          <button
            type="button"
            className="direction__viewer-clear"
            onClick={() => {
              setSelectedViewer(null);
              setAuthorFilter('');
              const nextFilters = composeFilters({
                search,
                searchMode,
                messageType,
                authorFilter: '',
                badgeFilters,
                limit
              });
              setDebouncedFilters((prev) => (areFiltersEqual(prev, nextFilters) ? prev : nextFilters));
            }}
          >
            Clear
          </button>
        </div>
      )}

      {error && <div className="direction__error">{error}</div>}

      <section className="direction__results">
        {results.length === 0 && !loading ? (
          <div className="direction__empty">
            <p>No messages match the current filters.</p>
            <button type="button" className="direction__button direction__button--ghost" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="direction__list">
            {results.map((message) => (
              <li key={message.id} className="direction__card">
                <header className="direction__card-header">
                  <div>
                    <div className="direction__card-author">
                      {message.authorPhoto && (
                        <img
                          src={message.authorPhoto}
                          alt={message.author}
                          className="direction__author-avatar"
                        />
                      )}
                      <button
                        type="button"
                        className="direction__viewer-button direction__card-authorName"
                        onClick={() => handleSelectViewer(message.author)}
                        title="Filter messages from this viewer"
                      >
                        {renderHighlightedText(message.author, authorHighlightRegex)}
                      </button>
                      {renderBadges(message)}
                    </div>
                    <span className="direction__card-meta">{formatMessageMeta(message)}</span>
                  </div>
                  <div className="direction__card-actions">
                    <button
                      type="button"
                      className="direction__button direction__button--ghost"
                      onClick={() => handleSelectViewer(message.author)}
                    >
                      Filter author
                    </button>
                    {message.authorChannelUrl && (
                      <a
                        href={message.authorChannelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="direction__button direction__button--primary direction__button--link"
                      >
                        View this author
                      </a>
                    )}
                    <button
                      type="button"
                      className="direction__button direction__button--primary"
                      onClick={() => handleOverlaySelection(message.id)}
                    >
                      Send to overlay
                    </button>
                  </div>
                </header>

                <div className="direction__card-body">
                  {renderMessageContent(message, highlightRegex)}
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="direction__load-more">
            <button
              type="button"
              className="direction__button"
              disabled={loading}
              onClick={handleLoadMore}
            >
              Load older messages
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function buildHighlightRegex(search: string, mode: SearchMode) {
  const trimmed = search.trim();
  if (!trimmed) {
    return { highlightRegex: null as RegExp | null, regexError: null as string | null };
  }

  try {
    if (mode === 'regex') {
      return { highlightRegex: new RegExp(trimmed, 'gi'), regexError: null };
    }
    return { highlightRegex: new RegExp(escapeRegExp(trimmed), 'gi'), regexError: null };
  } catch (error) {
    return { highlightRegex: null, regexError: error instanceof Error ? error.message : 'Invalid regex pattern' };
  }
}

function safeJson(response: Response): Promise<any> {
  return response
    .clone()
    .json()
    .catch(() => null);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function renderBadges(message: ChatMessage) {
  if (!message.badges || message.badges.length === 0) {
    return null;
  }
  return (
    <span className="direction__badge-strip">
      {message.badges.map((badge, index) => (
        <span key={`${badge.type}-${index}`} className={`direction__badge direction__badge--${badge.type}`} title={badge.label}>
          {badge.imageUrl ? <img src={badge.imageUrl} alt={badge.label ?? badge.type} /> : badge.label ?? capitalize(badge.type)}
        </span>
      ))}
    </span>
  );
}

function formatMessageMeta(message: ChatMessage): string {
  const date = new Date(message.publishedAt);
  const type = message.superChat ? 'Super Chat' : message.membershipGift || message.membershipGiftPurchase ? 'Membership' : 'Regular';
  return `${type} • ${date.toLocaleString()}`;
}

function renderMessageContent(message: ChatMessage, highlightRegex: RegExp | null) {
  if (message.superChat) {
    return (
      <div className="direction__superchat">
        <div className="direction__superchat-header" style={{ backgroundColor: message.superChat.color }}>
          <span>
            {message.superChat.currency}{message.superChat.currency ? ' ' : ''}{message.superChat.amount}
          </span>
        </div>
        <div className="direction__message-text">
          {renderRunsOrText(message, highlightRegex)}
        </div>
      </div>
    );
  }

  if (message.membershipGift || message.membershipGiftPurchase) {
    return (
      <div className="direction__membership">
        {message.membershipGiftPurchase && message.giftCount ? (
          <p>{message.author} gifted {message.giftCount} membership{message.giftCount > 1 ? 's' : ''}</p>
        ) : (
          <p>{message.membershipLevel ?? 'Membership Event'}</p>
        )}
        <div className="direction__message-text">{renderRunsOrText(message, highlightRegex)}</div>
      </div>
    );
  }

  return <div className="direction__message-text">{renderRunsOrText(message, highlightRegex)}</div>;
}

function renderRunsOrText(message: ChatMessage, highlightRegex: RegExp | null) {
  if (Array.isArray(message.runs) && message.runs.length > 0) {
    return message.runs.map((run, index) => {
      if (run.emojiUrl) {
        return <img key={`emoji-${index}`} src={run.emojiUrl} alt={run.emojiAlt ?? 'emoji'} className="direction__emoji" />;
      }
      if (!run.text) return null;
      return (
        <span key={`text-${index}`}>{renderHighlightedText(run.text, highlightRegex)}</span>
      );
    });
  }

  return renderHighlightedText(message.text ?? '', highlightRegex);
}

function renderHighlightedText(text: string, highlightRegex: RegExp | null) {
  if (!text) return null;
  if (!highlightRegex) return text;

  const globalRegex = new RegExp(highlightRegex.source, highlightRegex.flags.includes('g') ? highlightRegex.flags : `${highlightRegex.flags}g`);
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let guard = 0;

  while ((match = globalRegex.exec(text)) !== null && guard < 1000) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    if (end > start) {
      nodes.push(
        <strong key={`hl-${start}-${end}`} className="direction__highlight">
          {text.slice(start, end)}
        </strong>
      );
    }
    lastIndex = end;
    if (match[0].length === 0) {
      globalRegex.lastIndex += 1;
    }
    guard += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

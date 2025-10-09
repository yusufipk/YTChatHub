import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTO_REFRESH_INTERVAL_MS, BACKEND_URL } from '../config';
import type { ChatMessagesReply, FilterState } from '../types';

export type UseDirectionMessagesArgs = {
  filters: FilterState;
  regexError: string | null;
  onAfterFetch?: () => void;
};

export type LoadMessagesArgs = {
  reset: boolean;
  cursor?: string | null;
  allowOverlap?: boolean;
};

export function useDirectionMessages({
  filters,
  regexError,
  onAfterFetch
}: UseDirectionMessagesArgs) {
  const [results, setResults] = useState<ChatMessagesReply['messages']>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inflightRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const loadMessages = useCallback(
    async ({ reset, cursor = null, allowOverlap = true }: LoadMessagesArgs) => {
      if (regexError && filters.searchMode === 'regex') {
        setError(regexError);
        return;
      }

      if (!allowOverlap && inflightRef.current) {
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      inflightRef.current = true;
      setLoading(true);
      if (reset) {
        setError(null);
      }

      const params = new URLSearchParams();
      const trimmedSearch = filters.search.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
        if (filters.searchMode === 'regex') {
          params.set('mode', 'regex');
        }
      } else if (filters.searchMode === 'regex') {
        params.set('mode', 'regex');
      }

      if (filters.messageType !== 'all') {
        params.set('type', filters.messageType);
      }

      const trimmedAuthor = filters.authorFilter.trim();
      if (trimmedAuthor) {
        params.set('author', trimmedAuthor);
      }

      const enabledBadges = Object.entries(filters.badgeFilters)
        .filter(([, value]) => value)
        .map(([key]) => key.toLowerCase());
      if (enabledBadges.length > 0) {
        params.set('badges', enabledBadges.join(','));
      }

      if (filters.limit) {
        params.set('limit', String(filters.limit));
      }

      if (cursor) {
        params.set('cursor', cursor);
      }

      let aborted = false;

      try {
        const url = `${BACKEND_URL}/chat/messages?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          const payload = (await safeJson(response)) as ChatMessagesReply | null;
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

        onAfterFetch?.();
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          aborted = true;
        } else {
          const message = error instanceof Error ? error.message : 'Failed to load messages';
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
    },
    [filters, regexError, onAfterFetch]
  );

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

    return () => {
      clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [loadMessages]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loading) {
      return;
    }
    void loadMessages({ reset: false, cursor: nextCursor });
  }, [loadMessages, nextCursor, loading]);

  return {
    results,
    total,
    nextCursor,
    loading,
    error,
    setError,
    loadMessages,
    handleLoadMore
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

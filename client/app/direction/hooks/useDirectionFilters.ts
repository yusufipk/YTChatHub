import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LIMIT, SEARCH_DEBOUNCE_MS } from '../config';
import type { BadgeFilterState, FilterState, MessageTypeFilter, SearchMode } from '../types';

const initialBadgeState: BadgeFilterState = {
  moderator: false,
  member: false,
  verified: false
};

function composeFiltersFromState(args: {
  search: string;
  searchMode: SearchMode;
  messageType: MessageTypeFilter;
  authorFilter: string;
  badgeFilters: BadgeFilterState;
  limit: number;
}): FilterState {
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

export type UseDirectionFiltersResult = {
  search: string;
  setSearch: (value: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  messageType: MessageTypeFilter;
  setMessageType: (type: MessageTypeFilter) => void;
  authorFilter: string;
  setAuthorFilter: (value: string) => void;
  badgeFilters: BadgeFilterState;
  toggleBadge: (badge: keyof BadgeFilterState) => void;
  limit: number;
  setLimit: (value: number) => void;
  selectedViewer: string | null;
  selectViewer: (viewer: string) => void;
  setViewerLabel: (viewer: string | null) => void;
  clearViewer: () => void;
  clearFilters: () => void;
  debouncedFilters: FilterState;
};

export function useDirectionFilters(initialLimit = DEFAULT_LIMIT): UseDirectionFiltersResult {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('plain');
  const [messageType, setMessageType] = useState<MessageTypeFilter>('all');
  const [authorFilter, setAuthorFilter] = useState('');
  const [badgeFilters, setBadgeFilters] = useState<BadgeFilterState>({ ...initialBadgeState });
  const [limit, setLimitState] = useState(initialLimit);
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null);

  const baseFilters = useMemo(
    () =>
      composeFiltersFromState({
        search,
        searchMode,
        messageType,
        authorFilter,
        badgeFilters,
        limit
      }),
    [search, searchMode, messageType, authorFilter, badgeFilters, limit]
  );

  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(baseFilters);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedFilters((prev) => (areFiltersEqual(prev, baseFilters) ? prev : baseFilters));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [baseFilters]);

  const toggleBadge = useCallback(
    (badge: keyof BadgeFilterState) => {
      setBadgeFilters((prev) => {
        const next = {
          ...prev,
          [badge]: !prev[badge]
        };
        syncDebouncedFilters({ badgeFilters: next });
        return next;
      });
    },
    [syncDebouncedFilters]
  );

  const syncDebouncedFilters = useCallback(
    (overrides?: Partial<Omit<FilterState, 'badgeFilters'>> & { badgeFilters?: BadgeFilterState }) => {
      const next = composeFiltersFromState({
        search: overrides?.search ?? search,
        searchMode: overrides?.searchMode ?? searchMode,
        messageType: overrides?.messageType ?? messageType,
        authorFilter: overrides?.authorFilter ?? authorFilter,
        badgeFilters: overrides?.badgeFilters ?? badgeFilters,
        limit: overrides?.limit ?? limit
      });
      setDebouncedFilters((prev) => (areFiltersEqual(prev, next) ? prev : next));
    },
    [authorFilter, badgeFilters, limit, messageType, search, searchMode]
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setSearchMode('plain');
    setMessageType('all');
    setAuthorFilter('');
    const resetBadges = { ...initialBadgeState };
    setBadgeFilters(resetBadges);
    setLimitState(initialLimit);
    setSelectedViewer(null);
    syncDebouncedFilters({
      search: '',
      searchMode: 'plain',
      messageType: 'all',
      authorFilter: '',
      limit: initialLimit,
      badgeFilters: resetBadges
    });
  }, [initialLimit, syncDebouncedFilters]);

  const selectViewer = useCallback((viewer: string) => {
    setSelectedViewer(viewer);
    setAuthorFilter(viewer);
    syncDebouncedFilters({ authorFilter: viewer });
  }, [syncDebouncedFilters]);

  const clearViewer = useCallback(() => {
    setSelectedViewer(null);
    setAuthorFilter('');
    syncDebouncedFilters({ authorFilter: '' });
  }, [syncDebouncedFilters]);

  const setViewerLabel = useCallback((viewer: string | null) => {
    setSelectedViewer(viewer);
  }, []);

  return {
    search,
    setSearch,
    searchMode,
    setSearchMode,
    messageType,
    setMessageType,
    authorFilter,
    setAuthorFilter,
    badgeFilters,
    toggleBadge,
    limit,
    setLimit: (value: number) => {
      setLimitState(value);
      syncDebouncedFilters({ limit: value });
    },
    selectedViewer,
    selectViewer,
    setViewerLabel,
    clearViewer,
    clearFilters,
    debouncedFilters
  };
}

export { composeFiltersFromState as composeFilters };

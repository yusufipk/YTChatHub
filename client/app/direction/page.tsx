'use client';

import { useCallback, useMemo, useState } from 'react';
import { FilterControls } from './components/FilterControls';
import { ViewerBanner } from './components/ViewerBanner';
import { MessageList } from './components/MessageList';
import { useDirectionFilters } from './hooks/useDirectionFilters';
import { useDirectionMessages } from './hooks/useDirectionMessages';
import { BACKEND_URL, DEFAULT_LIMIT, MAX_PAGE_LIMIT } from './config';
import type { OverlayActionState, SearchMode } from './types';
import styles from './DirectionPage.module.css';

const MIN_PAGE_LIMIT = 10;

export default function DirectionPage() {
  const {
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
    setLimit,
    selectedViewer,
    selectViewer,
    setViewerLabel,
    clearViewer,
    clearFilters,
    debouncedFilters
  } = useDirectionFilters(DEFAULT_LIMIT);

  const [overlayStatus, setOverlayStatus] = useState<OverlayActionState>({ status: 'idle', message: '' });

  const { highlightRegex, regexError } = useMemo(() => buildHighlightRegex(search, searchMode), [search, searchMode]);
  const authorHighlightRegex = useMemo(() => buildAuthorHighlight(authorFilter), [authorFilter]);

  const handleFetchComplete = useCallback(() => {
    setOverlayStatus((current) => (current.status === 'success' ? current : { status: 'idle', message: '' }));
  }, []);

  const { results, total, nextCursor, loading, error, setError, loadMessages, handleLoadMore } = useDirectionMessages({
    filters: debouncedFilters,
    regexError,
    onAfterFetch: handleFetchComplete
  });

  const handleManualRefresh = useCallback(() => {
    void loadMessages({ reset: true });
  }, [loadMessages]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    setError(null);
    void loadMessages({ reset: true });
  }, [clearFilters, loadMessages, setError]);

  const handleOverlaySelection = useCallback(async (messageId: string) => {
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
  }, []);

  const handleSelectViewer = useCallback(
    (viewer: string) => {
      const trimmed = viewer.trim();
      if (!trimmed) {
        clearViewer();
        return;
      }
      selectViewer(trimmed);
    },
    [clearViewer, selectViewer]
  );

  const handleAuthorFilterChange = useCallback(
    (value: string) => {
      setAuthorFilter(value);
      const trimmed = value.trim();
      setViewerLabel(trimmed ? trimmed : null);
    },
    [setAuthorFilter, setViewerLabel]
  );

  const handleLimitChange = useCallback(
    (value: number) => {
      const normalized = clamp(Number.isFinite(value) ? Math.floor(value) : DEFAULT_LIMIT, MIN_PAGE_LIMIT, MAX_PAGE_LIMIT);
      setLimit(normalized);
    },
    [setLimit]
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Direction Studio</h1>
          <p className={styles.subtitle}>High-speed search and filtering for directing on-stream moments.</p>
        </div>
        <div className={styles.meta}>
          <span className={styles.metaItem}>Total matches: {total}</span>
          {loading && <span className={`${styles.metaItem} ${styles.metaItemLoading}`}>Loading…</span>}
        </div>
      </header>

      <FilterControls
        search={search}
        onSearchChange={setSearch}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        regexError={regexError}
        messageType={messageType}
        onMessageTypeChange={setMessageType}
        authorFilter={authorFilter}
        onAuthorFilterChange={handleAuthorFilterChange}
        badgeFilters={badgeFilters}
        onToggleBadge={toggleBadge}
        limit={limit}
        onLimitChange={handleLimitChange}
        onClearFilters={handleClearFilters}
        onRefresh={handleManualRefresh}
        loading={loading}
      />

      <ViewerBanner viewer={selectedViewer} onClear={clearViewer} />

      {overlayStatus.status !== 'idle' && (
        <div
          className={`${styles.overlayStatus} ${
            overlayStatus.status === 'success' ? styles.overlayStatusSuccess : styles.overlayStatusError
          }`}
        >
          {overlayStatus.message}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.results}>
        {results.length === 0 && !loading ? (
          <div className={styles.empty}>
            <p>No messages match the current filters.</p>
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={handleClearFilters}>
              Reset filters
            </button>
          </div>
        ) : (
          <MessageList
            messages={results}
            highlightRegex={highlightRegex}
            authorHighlightRegex={authorHighlightRegex}
            onFilterAuthor={handleSelectViewer}
            onOverlaySelection={(id) => void handleOverlaySelection(id)}
          />
        )}

        {nextCursor && (
          <div className={styles.loadMore}>
            <button type="button" className={styles.button} disabled={loading} onClick={handleLoadMore}>
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

function buildAuthorHighlight(author: string) {
  const trimmed = author.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new RegExp(escapeRegExp(trimmed), 'gi');
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

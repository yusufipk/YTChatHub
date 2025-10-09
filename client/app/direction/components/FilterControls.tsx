'use client';

import type { BadgeFilterState, MessageTypeFilter, SearchMode } from '../types';
import { MAX_PAGE_LIMIT } from '../config';
import styles from '../DirectionPage.module.css';

type FilterControlsProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  regexError: string | null;
  messageType: MessageTypeFilter;
  onMessageTypeChange: (type: MessageTypeFilter) => void;
  authorFilter: string;
  onAuthorFilterChange: (value: string) => void;
  badgeFilters: BadgeFilterState;
  onToggleBadge: (badge: keyof BadgeFilterState) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  loading: boolean;
};

const badgeOrder: Array<keyof BadgeFilterState> = ['moderator', 'member', 'verified'];
const typeOptions: Array<MessageTypeFilter> = ['all', 'regular', 'superchat', 'membership'];

export function FilterControls({
  search,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  regexError,
  messageType,
  onMessageTypeChange,
  authorFilter,
  onAuthorFilterChange,
  badgeFilters,
  onToggleBadge,
  limit,
  onLimitChange,
  onClearFilters,
  onRefresh,
  loading
}: FilterControlsProps) {
  return (
    <section className={styles.filters}>
      <header className={styles.filtersHeader}>
        <div>
          <h2>Filters</h2>
          <p>Combine filters to narrow down high-signal messages.</p>
        </div>
      </header>

      <div className={styles.filtersGrid}>
        <div className={styles.filtersMain}>
          <div className={styles.field}>
            <label htmlFor="direction-search">Search</label>
            <input
              id="direction-search"
              type="text"
              className={styles.inputText}
              placeholder={searchMode === 'regex' ? 'Enter regex pattern…' : 'Search messages…'}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {regexError && searchMode === 'regex' && <p className={`${styles.hint} ${styles.hintError}`}>{regexError}</p>}
            {!regexError && search && <p className={styles.hint}>Matched text will be highlighted in results.</p>}
          </div>

          <div className={styles.field}>
            <span>Mode</span>
            <div className={styles.segmented}>
              {(['plain', 'regex'] as SearchMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === searchMode ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
                  onClick={() => onSearchModeChange(mode)}
                >
                  {mode === 'plain' ? 'Plain' : 'Regex'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span>Message Type</span>
            <div className={styles.segmented}>
              {typeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={type === messageType ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
                  onClick={() => onMessageTypeChange(type)}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="direction-author">Author</label>
            <input
              id="direction-author"
              type="text"
              className={styles.inputText}
              placeholder="Filter by author name"
              value={authorFilter}
              onChange={(event) => onAuthorFilterChange(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.filtersSecondary}>
          <fieldset className={`${styles.fieldset} ${styles.fieldsetBadges}`}>
            <legend>Badges</legend>
            {badgeOrder.map((badge) => (
              <label key={badge}>
                <input type="checkbox" checked={badgeFilters[badge]} onChange={() => onToggleBadge(badge)} />
                {badge.charAt(0).toUpperCase() + badge.slice(1)}
              </label>
            ))}
          </fieldset>

          <div className={`${styles.field} ${styles.fieldCompact}`}>
            <label htmlFor="direction-limit">Page Size</label>
            <input
              id="direction-limit"
              type="number"
              className={styles.inputNumber}
              min={10}
              max={MAX_PAGE_LIMIT}
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={onClearFilters}>
              Clear filters
            </button>
            <button type="button" className={styles.button} onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

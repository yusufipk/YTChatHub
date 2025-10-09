'use client';

import type { BadgeFilterState, MessageTypeFilter, SearchMode } from '../types';
import { MAX_PAGE_LIMIT } from '../config';

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
    <section className="direction__filters">
      <header className="direction__filters-header">
        <div>
          <h2>Filters</h2>
          <p>Combine filters to narrow down high-signal messages.</p>
        </div>
      </header>

      <div className="direction__filters-grid">
        <div className="direction__filters-main">
          <div className="direction__field">
            <label htmlFor="direction-search">Search</label>
            <input
              id="direction-search"
              type="text"
              placeholder={searchMode === 'regex' ? 'Enter regex pattern…' : 'Search messages…'}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {regexError && searchMode === 'regex' && (
              <p className="direction__hint direction__hint--error">{regexError}</p>
            )}
            {!regexError && search && (
              <p className="direction__hint">Matched text will be highlighted in results.</p>
            )}
          </div>

          <div className="direction__field">
            <span className="direction__label">Mode</span>
            <div className="direction__segmented">
              {(['plain', 'regex'] as SearchMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === searchMode ? 'direction__segment direction__segment--active' : 'direction__segment'}
                  onClick={() => onSearchModeChange(mode)}
                >
                  {mode === 'plain' ? 'Plain' : 'Regex'}
                </button>
              ))}
            </div>
          </div>

          <div className="direction__field">
            <span className="direction__label">Message Type</span>
            <div className="direction__segmented">
              {typeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={type === messageType ? 'direction__segment direction__segment--active' : 'direction__segment'}
                  onClick={() => onMessageTypeChange(type)}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="direction__field">
            <label htmlFor="direction-author">Author</label>
            <input
              id="direction-author"
              type="text"
              placeholder="Filter by author name"
              value={authorFilter}
              onChange={(event) => onAuthorFilterChange(event.target.value)}
            />
          </div>
        </div>

        <div className="direction__filters-secondary">
          <fieldset className="direction__fieldset direction__fieldset--badges">
            <legend>Badges</legend>
            {badgeOrder.map((badge) => (
              <label key={badge}>
                <input
                  type="checkbox"
                  checked={badgeFilters[badge]}
                  onChange={() => onToggleBadge(badge)}
                />
                {badge.charAt(0).toUpperCase() + badge.slice(1)}
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
              onChange={(event) => onLimitChange(Number(event.target.value))}
            />
          </div>

          <div className="direction__actions">
            <button type="button" className="direction__button direction__button--ghost" onClick={onClearFilters}>
              Clear filters
            </button>
            <button type="button" className="direction__button" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

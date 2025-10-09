'use client';

import styles from '../DirectionPage.module.css';

type ViewerBannerProps = {
  viewer: string | null;
  onClear: () => void;
};

export function ViewerBanner({ viewer, onClear }: ViewerBannerProps) {
  if (!viewer) {
    return null;
  }

  return (
    <div className={styles.viewer}>
      <span className={styles.viewerLabel}>Viewer:</span>
      <span className={styles.viewerName}>{viewer}</span>
      <button type="button" className={styles.viewerClear} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

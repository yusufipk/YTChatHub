'use client';

type ViewerBannerProps = {
  viewer: string | null;
  onClear: () => void;
};

export function ViewerBanner({ viewer, onClear }: ViewerBannerProps) {
  if (!viewer) {
    return null;
  }

  return (
    <div className="direction__viewer">
      <span className="direction__viewer-label">Viewer:</span>
      <span className="direction__viewer-name">{viewer}</span>
      <button type="button" className="direction__viewer-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

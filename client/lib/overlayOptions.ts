export const THEMES = ['dark', 'light', 'blueprint', 'glass', 'youtube'] as const;
export const POSITIONS = ['bl', 'bc', 'br', 'tl', 'tc', 'tr'] as const;
export const SIZES = ['s', 'm', 'l', 'xl'] as const;
export const ANIMATIONS = ['fade', 'slide', 'none'] as const;

export type OverlayOptions = {
  theme: (typeof THEMES)[number];
  pos: (typeof POSITIONS)[number];
  size: (typeof SIZES)[number];
  anim: (typeof ANIMATIONS)[number];
  /** Seconds before the overlay hides the message by itself. 0 keeps it until cleared. */
  hide: number;
  /** Max card width in pixels. */
  width: number;
};

export const DEFAULT_OPTIONS: OverlayOptions = { theme: 'dark', pos: 'bl', size: 'm', anim: 'fade', hide: 0, width: 640 };

function pick<T extends readonly string[]>(list: T, value: string | null, fallback: T[number]): T[number] {
  return value && (list as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

export function parseOverlayOptions(search: string): OverlayOptions {
  const params = new URLSearchParams(search);
  const hide = Number(params.get('hide'));
  const width = Number(params.get('w'));
  return {
    theme: pick(THEMES, params.get('theme'), DEFAULT_OPTIONS.theme),
    pos: pick(POSITIONS, params.get('pos'), DEFAULT_OPTIONS.pos),
    size: pick(SIZES, params.get('size'), DEFAULT_OPTIONS.size),
    anim: pick(ANIMATIONS, params.get('anim'), DEFAULT_OPTIONS.anim),
    hide: Number.isFinite(hide) && hide >= 0 ? Math.floor(hide) : DEFAULT_OPTIONS.hide,
    width: Number.isFinite(width) && width >= 240 ? Math.floor(width) : DEFAULT_OPTIONS.width
  };
}

/** Only non-default values go in the URL so the plain /overlay/ link keeps working. */
export function buildOverlayUrl(origin: string, options: OverlayOptions): string {
  const params = new URLSearchParams();
  if (options.theme !== DEFAULT_OPTIONS.theme) params.set('theme', options.theme);
  if (options.pos !== DEFAULT_OPTIONS.pos) params.set('pos', options.pos);
  if (options.size !== DEFAULT_OPTIONS.size) params.set('size', options.size);
  if (options.anim !== DEFAULT_OPTIONS.anim) params.set('anim', options.anim);
  if (options.hide !== DEFAULT_OPTIONS.hide) params.set('hide', String(options.hide));
  if (options.width !== DEFAULT_OPTIONS.width) params.set('w', String(options.width));
  const query = params.toString();
  return `${origin}/overlay/${query ? `?${query}` : ''}`;
}

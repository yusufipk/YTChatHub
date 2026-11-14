'use client';

import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ANIMATIONS, buildOverlayUrl, DEFAULT_OPTIONS, LANGS, POSITIONS, SIZES, THEMES, type OverlayOptions } from '../lib/overlayOptions';
import { useStrings } from '../lib/i18n';

const STORAGE_KEY = 'ytchathub.overlay';

function load(): OverlayOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    // storage unavailable or corrupt
  }
  return DEFAULT_OPTIONS;
}

export function OverlaySettings({ onClose }: { onClose: () => void }) {
  const t = useStrings();
  const [options, setOptions] = useState<OverlayOptions>(DEFAULT_OPTIONS);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOptions(load());
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // storage unavailable
    }
  }, [options]);

  const url = buildOverlayUrl(origin, options);
  const set = <K extends keyof OverlayOptions>(key: K, value: OverlayOptions[K]) => setOptions((prev) => ({ ...prev, [key]: value }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the URL is still selectable in the field
    }
  };

  const select = <K extends 'theme' | 'pos' | 'size' | 'anim' | 'lang'>(key: K, label: string, values: readonly OverlayOptions[K][]) => (
    <label className="field">
      <span>{label}</span>
      <select value={options[key]} onChange={(event) => set(key, event.target.value as OverlayOptions[K])}>
        {values.map((value) => (
          <option key={value} value={value}>{t.options[key === 'lang' ? `lang${value === 'tr' ? 'Tr' : 'En'}` : value] ?? value}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card modal__card--wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>{t.overlayHeading}</h2>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label={t.close}>
            <X size={16} />
          </button>
        </div>
        <p className="muted">{t.overlayHint}</p>
        <div className="fields">
          {select('theme', t.theme, THEMES)}
          {select('pos', t.position, POSITIONS)}
          {select('size', t.textSize, SIZES)}
          {select('anim', t.animation, ANIMATIONS)}
          {select('lang', t.language, LANGS)}
          <label className="field">
            <span>{t.hideAfter}</span>
            <input type="number" min={0} max={600} value={options.hide} onChange={(event) => set('hide', Math.max(0, Number(event.target.value) || 0))} />
          </label>
          <label className="field">
            <span>{t.maxWidth}</span>
            <input type="number" min={240} max={1920} step={20} value={options.width} onChange={(event) => set('width', Math.max(240, Number(event.target.value) || 240))} />
          </label>
        </div>
        <div className="urlbox">
          <input readOnly value={url} onFocus={(event) => event.target.select()} />
          <button type="button" className="btn" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t.copied : t.copy}
          </button>
          <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            {t.open}
          </a>
        </div>
        <p className="muted">{t.overlaySize}</p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Copy, Eye, EyeOff, Minus, Play, Plus, Square, Timer, Upload, X } from 'lucide-react';
import type { ShowState } from '@shared/show';
import { api } from '../../lib/api';
import { BACKEND_URL } from '../../lib/config';
import { useEvents } from '../../lib/useEvents';
import { useNow } from '../../lib/useShowOverlay';
import { setLang, STRINGS, useLang } from '../../lib/i18n';

function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function clock(epoch: number, locale: string): string {
  return new Date(epoch).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

type Form = {
  title: string;
  topic: string;
  likeStep: string;
  name: string;
  url: string;
  caption: string;
  auto: boolean;
  everySeconds: string;
  showSeconds: string;
};

function formFrom(show: ShowState): Form {
  return {
    title: show.countdown.title,
    topic: show.countdown.topic,
    likeStep: String(show.likes.step),
    name: show.sponsor.name,
    url: show.sponsor.url,
    caption: show.sponsor.caption,
    auto: show.sponsor.auto,
    everySeconds: String(show.sponsor.everySeconds),
    showSeconds: String(show.sponsor.showSeconds)
  };
}

// Corner sources scale up by themselves on a portrait (vertical canvas) source, so one URL serves both canvases.
// Titles and notes live in lib/i18n.ts under `sources`, keyed by `key`.
const SOURCES = [
  { key: 'countdownMain', path: 'countdown', query: 'lang=tr&scene=Full%20Cam' },
  { key: 'countdownVertical', path: 'countdown', query: 'lang=tr' },
  { key: 'goalTr', path: 'goal', query: 'lang=tr&pos=tr' },
  { key: 'goalTl', path: 'goal', query: 'lang=tr&pos=tl' },
  { key: 'goalBl', path: 'goal', query: 'lang=tr&pos=bl' },
  { key: 'goalBr', path: 'goal', query: 'lang=tr&pos=br' },
  { key: 'sponsorTl', path: 'sponsor', query: 'lang=tr&pos=tl' },
  { key: 'sponsorTr', path: 'sponsor', query: 'lang=tr&pos=tr' },
  { key: 'musicBl', path: 'music', query: 'pos=bl' },
  { key: 'musicBr', path: 'music', query: 'pos=br' },
  { key: 'musicTl', path: 'music', query: 'pos=tl' },
  { key: 'musicTr', path: 'music', query: 'pos=tr' },
  { key: 'outro', path: 'outro', query: 'lang=tr' }
];

const PREVIEWS = [
  { key: 'previewCountdown', src: 'countdown/?lang=tr', portrait: false },
  { key: 'previewCountdownVertical', src: 'countdown/?lang=tr', portrait: true },
  { key: 'previewGoal', src: 'goal/?lang=tr&pos=tr&demo=1', portrait: false },
  { key: 'previewGoalVertical', src: 'goal/?lang=tr&pos=tl&demo=1', portrait: true },
  { key: 'previewSponsor', src: 'sponsor/?lang=tr&pos=tl', portrait: false },
  { key: 'previewSponsorVertical', src: 'sponsor/?lang=tr&pos=tl', portrait: true },
  { key: 'previewMusic', src: 'music/?pos=bl', portrait: false },
  { key: 'previewOutro', src: 'outro/?lang=tr', portrait: false }
];

export default function ShowControlPage() {
  const { show, clockOffset, stream } = useEvents();
  const lang = useLang();
  const t = STRINGS[lang];
  const [form, setForm] = useState<Form | null>(null);
  const [minutes, setMinutes] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const endsAt = show?.countdown.endsAt ?? null;
  const now = useNow(clockOffset, false, 500);

  useEffect(() => setOrigin(BACKEND_URL || window.location.origin), []);
  // Fill the form once from the server; later snapshots must not overwrite what is being typed.
  useEffect(() => {
    if (show && !form) setForm(formFrom(show));
  }, [show, form]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const field = (key: keyof Form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value } : f));

  const saveSettings = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    void run(() => api.showSettings({ title: form.title, topic: form.topic, likeStep: Number(form.likeStep) }));
  };

  const saveSponsor = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    void run(() =>
      api.sponsor({
        name: form.name,
        url: form.url,
        caption: form.caption,
        auto: form.auto,
        everySeconds: Number(form.everySeconds),
        showSeconds: Number(form.showSeconds)
      })
    );
  };

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void run(() => api.sponsorLogo(String(reader.result)));
    reader.readAsDataURL(file);
  };

  const left = endsAt !== null ? endsAt - now : null;
  // The server refuses shifts inside the last 10 seconds, with a little margin for the request.
  const canShift = left !== null && left > 11_000;
  const sponsorLeft = show?.sponsor.visibleUntil ? show.sponsor.visibleUntil - now : 0;

  return (
    <main className="ctl">
      <header className="ctl__head">
        <h1>{t.showControl}</h1>
        <a className="btn" href="/dashboard/">{t.chatDashboard}</a>
        <button type="button" className="btn" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} title={t.langToggleTitle}>
          {t.langToggle}
        </button>
      </header>
      {stream === 'error' && <p className="ctl__error">{t.backendUnreachable}</p>}
      {error && <p className="ctl__error">{error}</p>}

      <section className="ctl__section">
        <h2>{t.countdown}</h2>
        <p className="ctl__status">
          {left === null ? t.notRunning : left > 0 ? t.leftEnds(formatLeft(left), clock(endsAt!, t.locale)) : t.finished}
        </p>
        <div className="ctl__row">
          <input className="ctl__num" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label={t.minutes} />
          <button type="button" className="btn btn--primary" onClick={() => run(() => api.countdown({ action: 'start', minutes: Number(minutes) }))}>
            <Play size={14} /> {t.start}
          </button>
          <button type="button" className="btn" onClick={() => run(() => api.countdown({ action: 'stop' }))}>
            <Square size={14} /> {t.stop}
          </button>
        </div>
        <div className="ctl__row">
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: -1 }))}>
            <Minus size={14} /> {t.min('1')}
          </button>
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: 1 }))}>
            <Plus size={14} /> {t.min('1')}
          </button>
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: 5 }))}>
            <Plus size={14} /> {t.min('5')}
          </button>
          <button type="button" className="btn" onClick={() => run(() => api.countdown({ action: 'final' }))} title={t.goIn10Title}>
            <Timer size={14} /> {t.goIn10}
          </button>
        </div>
      </section>

      {form && (
        <form className="ctl__section" onSubmit={saveSettings}>
          <h2>{t.streamInfo}</h2>
          <label>
            {t.showName}
            <input value={form.title} onChange={field('title')} maxLength={80} placeholder={t.showNamePlaceholder} />
          </label>
          <label>
            {t.topic}
            <input value={form.topic} onChange={field('topic')} maxLength={160} placeholder={t.topicPlaceholder} />
          </label>
          <label>
            {t.likeStep}
            <input className="ctl__num" type="number" min={5} value={form.likeStep} onChange={field('likeStep')} />
          </label>
          <p className="ctl__status">
            {show?.likes.count === null || show?.likes.count === undefined
              ? show?.viewers != null
                ? t.watchingNoLikes(show.viewers)
                : t.likesNotYet
              : t.likesStatus(show.likes.count, (Math.floor(show.likes.count / show.likes.step) + 1) * show.likes.step, show.viewers)}
          </p>
          <button type="submit" className="btn btn--primary">{t.save}</button>
        </form>
      )}

      {form && show && (
        <form className="ctl__section" onSubmit={saveSponsor}>
          <h2>{t.sponsor}</h2>
          <label>
            {t.name}
            <input value={form.name} onChange={field('name')} maxLength={80} />
          </label>
          <label>
            {t.qrLink}
            <input value={form.url} onChange={field('url')} maxLength={500} placeholder="https://" />
          </label>
          <label>
            {t.captionLine}
            <input value={form.caption} onChange={field('caption')} maxLength={120} placeholder={t.captionPlaceholder} />
          </label>
          <div className="ctl__row">
            <label className="ctl__check">
              <input type="checkbox" checked={form.auto} onChange={field('auto')} /> {t.qrEvery}
            </label>
            <input className="ctl__num" type="number" min={10} max={3600} value={form.everySeconds} onChange={field('everySeconds')} aria-label={t.qrEveryLabel} />
            <span>{t.qrFor}</span>
            <input className="ctl__num" type="number" min={3} max={3600} value={form.showSeconds} onChange={field('showSeconds')} aria-label={t.qrForLabel} />
            <span>{t.qrSeconds}</span>
          </div>
          <div className="ctl__preview">
            {show.sponsor.logoVersion ? (
              <img src={`${BACKEND_URL}/show/sponsor/logo?v=${show.sponsor.logoVersion}`} alt={t.sponsorLogo} />
            ) : (
              <span className="ctl__status">{t.noLogo}</span>
            )}
            {show.sponsor.qr && <img src={`data:image/svg+xml;utf8,${encodeURIComponent(show.sponsor.qr)}`} alt={t.qrPreview} />}
          </div>
          <div className="ctl__row">
            <label className="btn">
              <Upload size={14} /> {t.logo}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadLogo} />
            </label>
            {show.sponsor.logoVersion && (
              <button type="button" className="btn" onClick={() => run(() => api.removeSponsorLogo())}>
                <X size={14} /> {t.removeLogo}
              </button>
            )}
            <button type="submit" className="btn btn--primary">{t.save}</button>
          </div>
          <div className="ctl__row">
            <button type="button" className="btn" onClick={() => run(() => api.showSponsor())}>
              <Eye size={14} /> {t.showQr}
            </button>
            <button type="button" className="btn" disabled={sponsorLeft <= 0} onClick={() => run(() => api.hideSponsor())}>
              <EyeOff size={14} /> {t.closeQr}
            </button>
            {sponsorLeft > 0 && <span className="ctl__status">{t.openFor(formatLeft(sponsorLeft))}</span>}
          </div>
        </form>
      )}

      <section className="ctl__section">
        <h2>{t.music}</h2>
        <p className="ctl__status">
          {show?.music
            ? t.nowPlaying(`${show.music.artist ? `${show.music.artist}, ` : ''}${show.music.title}`)
            : t.nothingPlaying}
        </p>
      </section>

      <section className="ctl__section">
        <h2>{t.endScreen}</h2>
        <p className="ctl__status">
          {show?.outro.startedAt ? t.creditsSince(clock(show.outro.startedAt, t.locale)) : t.endHint}
        </p>
        <div className="ctl__row">
          <button type="button" className="btn btn--primary" onClick={() => run(() => api.outro(true))}>
            <Play size={14} /> {show?.outro.startedAt ? t.restartCredits : t.rollCredits}
          </button>
          <button type="button" className="btn" disabled={!show?.outro.startedAt} onClick={() => run(() => api.outro(false))}>
            <Square size={14} /> {t.reset}
          </button>
        </div>
      </section>

      <section className="ctl__section">
        <h2>{t.preview}</h2>
        <p className="ctl__status">{t.previewHint}</p>
        <div className="ctl__previews">
          {PREVIEWS.map((preview) => (
            <figure key={preview.key} className={`ctl__frame ${preview.portrait ? 'ctl__frame--portrait' : ''}`}>
              <iframe src={`${origin}/${preview.src}`} title={t.sources[preview.key][0]} loading="lazy" />
              <figcaption>{t.sources[preview.key][0]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ctl__section">
        <h2>{t.obsSources}</h2>
        <p className="ctl__status">{t.obsSourcesHint}</p>
        {SOURCES.map((source) => {
          const url = `${origin}/${source.path}/?${source.query}`;
          return (
            <div key={url} className="ctl__source">
              <strong className="ctl__source-title">{t.sources[source.key][0]}</strong>
              <code>{url}</code>
              <button type="button" className="btn btn--icon" onClick={() => void navigator.clipboard?.writeText(url)} title={t.copyUrl}>
                <Copy size={14} />
              </button>
              <span className="ctl__status">{t.sources[source.key][1]}</span>
            </div>
          );
        })}
      </section>
    </main>
  );
}

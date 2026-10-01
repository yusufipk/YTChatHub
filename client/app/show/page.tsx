'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Copy, Eye, EyeOff, Minus, Play, Plus, Square, Timer, Upload, X } from 'lucide-react';
import type { ShowState } from '@shared/show';
import { api } from '../../lib/api';
import { BACKEND_URL } from '../../lib/config';
import { useEvents } from '../../lib/useEvents';
import { useNow } from '../../lib/useShowOverlay';

function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function clock(epoch: number): string {
  return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
const SOURCES = [
  { title: 'Countdown, main canvas', path: 'countdown', query: 'lang=tr&scene=Full%20Cam', note: 'Starting Soon scene. Switches to Full Cam at zero; needs page permission "Advanced access to OBS".' },
  { title: 'Countdown, vertical canvas', path: 'countdown', query: 'lang=tr', note: 'Start Soon scene on the vertical canvas, sized 1440×2560. No scene switch: that only works on the main canvas.' },
  { title: 'Like goal, top right', path: 'goal', query: 'lang=tr&pos=tr', note: 'Size it like the canvas: 1920×1080 or 3840×2160, or 1440×2560 on the vertical canvas.' },
  { title: 'Like goal, top left', path: 'goal', query: 'lang=tr&pos=tl', note: 'Same as above, other corner.' },
  { title: 'Like goal, bottom left', path: 'goal', query: 'lang=tr&pos=bl', note: 'For the end scene.' },
  { title: 'Like goal, bottom right', path: 'goal', query: 'lang=tr&pos=br', note: 'Same as above, other corner.' },
  { title: 'Sponsor, top left', path: 'sponsor', query: 'lang=tr&pos=tl', note: 'Logo always on, the QR code opens to its right on the cycle set above.' },
  { title: 'Sponsor, top right', path: 'sponsor', query: 'lang=tr&pos=tr', note: 'For scenes where the logo sits on the right; the QR code opens to its left.' },
  { title: 'Now playing, bottom left', path: 'music', query: 'pos=bl', note: 'Cover, title and artist of the track the VLC source plays. Needs scripts/now-playing.py running.' },
  { title: 'Now playing, bottom right', path: 'music', query: 'pos=br', note: 'Same as above, other corner.' },
  { title: 'Now playing, top left', path: 'music', query: 'pos=tl', note: 'Same as above, other corner.' },
  { title: 'Now playing, top right', path: 'music', query: 'pos=tr', note: 'Same as above, other corner.' },
  { title: 'End screen', path: 'outro', query: 'lang=tr', note: 'Thanks, Tux and the rolling credits. Start them with "Roll credits" above.' }
];

const PREVIEWS = [
  { title: 'Countdown', src: 'countdown/?lang=tr', portrait: false },
  { title: 'Countdown, vertical', src: 'countdown/?lang=tr', portrait: true },
  { title: 'Like goal (demo numbers)', src: 'goal/?lang=tr&pos=tr&demo=1', portrait: false },
  { title: 'Like goal, vertical', src: 'goal/?lang=tr&pos=tl&demo=1', portrait: true },
  { title: 'Sponsor', src: 'sponsor/?lang=tr&pos=tl', portrait: false },
  { title: 'Sponsor, vertical', src: 'sponsor/?lang=tr&pos=tl', portrait: true },
  { title: 'Now playing', src: 'music/?pos=bl', portrait: false },
  { title: 'End screen', src: 'outro/?lang=tr', portrait: false }
];

export default function ShowControlPage() {
  const { show, clockOffset, stream } = useEvents();
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
        <h1>Show control</h1>
        <a className="btn" href="/dashboard/">Chat dashboard</a>
      </header>
      {stream === 'error' && <p className="ctl__error">Backend unreachable</p>}
      {error && <p className="ctl__error">{error}</p>}

      <section className="ctl__section">
        <h2>Countdown</h2>
        <p className="ctl__status">
          {left === null ? 'Not running' : left > 0 ? `${formatLeft(left)} left, ends ${clock(endsAt!)}` : 'Finished'}
        </p>
        <div className="ctl__row">
          <input className="ctl__num" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" />
          <button type="button" className="btn btn--primary" onClick={() => run(() => api.countdown({ action: 'start', minutes: Number(minutes) }))}>
            <Play size={14} /> Start
          </button>
          <button type="button" className="btn" onClick={() => run(() => api.countdown({ action: 'stop' }))}>
            <Square size={14} /> Stop
          </button>
        </div>
        <div className="ctl__row">
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: -1 }))}>
            <Minus size={14} /> 1 min
          </button>
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: 1 }))}>
            <Plus size={14} /> 1 min
          </button>
          <button type="button" className="btn" disabled={!canShift} onClick={() => run(() => api.countdown({ action: 'shift', minutes: 5 }))}>
            <Plus size={14} /> 5 min
          </button>
          <button type="button" className="btn" onClick={() => run(() => api.countdown({ action: 'final' }))} title="Jump to the last 10 seconds">
            <Timer size={14} /> Go in 10 s
          </button>
        </div>
      </section>

      {form && (
        <form className="ctl__section" onSubmit={saveSettings}>
          <h2>Stream info</h2>
          <label>
            Show name
            <input value={form.title} onChange={field('title')} maxLength={80} placeholder="Shown big on the countdown" />
          </label>
          <label>
            Topic
            <input value={form.topic} onChange={field('topic')} maxLength={160} placeholder="Optional line under the name" />
          </label>
          <label>
            Like goal step
            <input className="ctl__num" type="number" min={5} value={form.likeStep} onChange={field('likeStep')} />
          </label>
          <p className="ctl__status">
            {show?.likes.count === null || show?.likes.count === undefined
              ? show?.viewers != null
                ? `${show.viewers} watching; YouTube is not sharing the like count`
                : 'Live likes start once a stream is connected; the preview below counts demo numbers'
              : `${show.likes.count} likes, next goal ${(Math.floor(show.likes.count / show.likes.step) + 1) * show.likes.step}${show.viewers !== null ? `, ${show.viewers} watching` : ''}`}
          </p>
          <button type="submit" className="btn btn--primary">Save</button>
        </form>
      )}

      {form && show && (
        <form className="ctl__section" onSubmit={saveSponsor}>
          <h2>Sponsor</h2>
          <label>
            Name
            <input value={form.name} onChange={field('name')} maxLength={80} />
          </label>
          <label>
            Link for the QR code
            <input value={form.url} onChange={field('url')} maxLength={500} placeholder="https://" />
          </label>
          <label>
            Line under the logo
            <input value={form.caption} onChange={field('caption')} maxLength={120} placeholder="Optional, shown small under the logo" />
          </label>
          <div className="ctl__row">
            <label className="ctl__check">
              <input type="checkbox" checked={form.auto} onChange={field('auto')} /> Open the QR code every
            </label>
            <input className="ctl__num" type="number" min={10} max={3600} value={form.everySeconds} onChange={field('everySeconds')} aria-label="Seconds between QR showings" />
            <span>s for</span>
            <input className="ctl__num" type="number" min={3} max={3600} value={form.showSeconds} onChange={field('showSeconds')} aria-label="Seconds the QR code stays open" />
            <span>s</span>
          </div>
          <div className="ctl__preview">
            {show.sponsor.logoVersion ? (
              <img src={`${BACKEND_URL}/show/sponsor/logo?v=${show.sponsor.logoVersion}`} alt="Sponsor logo" />
            ) : (
              <span className="ctl__status">No logo, the name is shown instead</span>
            )}
            {show.sponsor.qr && <img src={`data:image/svg+xml;utf8,${encodeURIComponent(show.sponsor.qr)}`} alt="QR code preview" />}
          </div>
          <div className="ctl__row">
            <label className="btn">
              <Upload size={14} /> Logo
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadLogo} />
            </label>
            {show.sponsor.logoVersion && (
              <button type="button" className="btn" onClick={() => run(() => api.removeSponsorLogo())}>
                <X size={14} /> Remove logo
              </button>
            )}
            <button type="submit" className="btn btn--primary">Save</button>
          </div>
          <div className="ctl__row">
            <button type="button" className="btn" onClick={() => run(() => api.showSponsor())}>
              <Eye size={14} /> Show QR now
            </button>
            <button type="button" className="btn" disabled={sponsorLeft <= 0} onClick={() => run(() => api.hideSponsor())}>
              <EyeOff size={14} /> Close QR
            </button>
            {sponsorLeft > 0 && <span className="ctl__status">Open for {formatLeft(sponsorLeft)}</span>}
          </div>
        </form>
      )}

      <section className="ctl__section">
        <h2>Music</h2>
        <p className="ctl__status">
          {show?.music
            ? `Now playing: ${show.music.artist ? `${show.music.artist}, ` : ''}${show.music.title}`
            : 'Nothing playing. scripts/now-playing.py has to run on this machine to read the track from OBS.'}
        </p>
      </section>

      <section className="ctl__section">
        <h2>End screen</h2>
        <p className="ctl__status">
          {show?.outro.startedAt ? `Credits rolling since ${clock(show.outro.startedAt)}` : 'Start this when you switch to the end scene. It freezes the stats and rolls the credits.'}
        </p>
        <div className="ctl__row">
          <button type="button" className="btn btn--primary" onClick={() => run(() => api.outro(true))}>
            <Play size={14} /> {show?.outro.startedAt ? 'Restart credits' : 'Roll credits'}
          </button>
          <button type="button" className="btn" disabled={!show?.outro.startedAt} onClick={() => run(() => api.outro(false))}>
            <Square size={14} /> Reset
          </button>
        </div>
      </section>

      <section className="ctl__section">
        <h2>Preview</h2>
        <p className="ctl__status">The real overlays, live. The countdown shows whatever is running now.</p>
        <div className="ctl__previews">
          {PREVIEWS.map((preview) => (
            <figure key={preview.title} className={`ctl__frame ${preview.portrait ? 'ctl__frame--portrait' : ''}`}>
              <iframe src={`${origin}/${preview.src}`} title={preview.title} loading="lazy" />
              <figcaption>{preview.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ctl__section">
        <h2>OBS browser sources</h2>
        <p className="ctl__status">Set each source to the size of the canvas it sits on.</p>
        {SOURCES.map((source) => {
          const url = `${origin}/${source.path}/?${source.query}`;
          return (
            <div key={url} className="ctl__source">
              <strong className="ctl__source-title">{source.title}</strong>
              <code>{url}</code>
              <button type="button" className="btn btn--icon" onClick={() => void navigator.clipboard?.writeText(url)} title="Copy URL">
                <Copy size={14} />
              </button>
              <span className="ctl__status">{source.note}</span>
            </div>
          );
        })}
      </section>
    </main>
  );
}

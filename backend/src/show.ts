import type { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import * as QRCode from 'qrcode';
import type { ChatMessage } from '@shared/chat';
import type { ShowState, StreamStats, Supporter } from '@shared/show';

const LIKE_POLL_MS = 45_000;
const SPONSOR_TICK_MS = 1_000;
const FINAL_COUNTDOWN_MS = 10_500;
const MAX_LOGO_BYTES = 2.5 * 1024 * 1024;
const MAX_SUPPORTERS = 400;
const MUSIC_POLL_MS = 1_000;
// The watcher touches its file every 5 s; past this the watcher is gone and the song is not trusted.
const MUSIC_STALE_MS = 15_000;

const LOGO_TYPES: { type: string; test: (b: Buffer) => boolean }[] = [
  { type: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
];

/** Settings that survive a restart. Live values (countdown, likes, outro) do not. */
type Persisted = {
  title: string;
  topic: string;
  likeStep: number;
  sponsor: { name: string; url: string; caption: string; auto: boolean; everySeconds: number; showSeconds: number };
  logoType: string | null;
  logoVersion: number | null;
};

const DEFAULTS: Persisted = {
  title: '',
  topic: '',
  likeStep: 50,
  sponsor: { name: '', url: '', caption: '', auto: true, everySeconds: 30, showSeconds: 12 },
  logoType: null,
  logoVersion: null
};

/** Request bodies arrive as parsed JSON objects only; anything else (text/plain from another origin) is rejected. */
function asObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined;
}

function int(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? Math.round(value) : undefined;
}

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export type ShowController = ReturnType<typeof createShow>;

/**
 * Owns the stream furniture state. `emit` receives a fresh snapshot after every change;
 * `fetchLikes` returns the current like count of the connected stream, or null when there is none.
 */
export function createShow(options: { dataDir: string; emit: (show: ShowState) => void; fetchLikes: () => Promise<number | null> }) {
  const { dataDir, emit, fetchLikes } = options;
  const settingsFile = path.join(dataDir, 'show.json');
  const logoFile = path.join(dataDir, 'sponsor-logo');
  const musicFile = path.join(dataDir, 'now-playing.json');
  const coverFile = path.join(dataDir, 'now-playing-cover.jpg');

  let saved: Persisted = load();
  let qr: string | null = null;
  let countdown = { endsAt: null as number | null, durationMs: 0 };
  let likes: number | null = null;
  let viewers: number | null = null;
  let sponsorVisibleUntil: number | null = null;
  let outro: ShowState['outro'] = { startedAt: null, stats: null };
  let music: ShowState['music'] = null;
  let musicMtime = 0;

  const stats = { messages: 0, chatters: new Set<string>(), supporters: [] as Supporter[] };

  function load(): Persisted {
    try {
      const raw = JSON.parse(readFileSync(settingsFile, 'utf8'));
      // Settings saved before the QR cycle existed carry a minutes-based interval; drop it for the new default.
      const { everyMinutes: _old, ...sponsor } = raw?.sponsor ?? {};
      const merged = { ...DEFAULTS.sponsor, ...sponsor };
      // A QR window as long as its cycle would never close.
      if (!(merged.showSeconds < merged.everySeconds)) {
        merged.everySeconds = DEFAULTS.sponsor.everySeconds;
        merged.showSeconds = DEFAULTS.sponsor.showSeconds;
      }
      return { ...DEFAULTS, ...raw, sponsor: merged };
    } catch {
      return { ...DEFAULTS, sponsor: { ...DEFAULTS.sponsor } };
    }
  }

  function save() {
    mkdirSync(dataDir, { recursive: true });
    const tmp = `${settingsFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(saved, null, 2));
    renameSync(tmp, settingsFile);
  }

  async function refreshQr() {
    const url = saved.sponsor.url;
    qr = url ? await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null;
  }

  function snapshot(): ShowState {
    return {
      serverNow: Date.now(),
      countdown: { ...countdown, title: saved.title, topic: saved.topic },
      likes: { count: likes, step: saved.likeStep },
      viewers,
      sponsor: {
        ...saved.sponsor,
        qr,
        logoVersion: saved.logoType ? saved.logoVersion : null,
        visibleUntil: sponsorVisibleUntil
      },
      music,
      outro
    };
  }

  const publish = () => emit(snapshot());

  function currentStats(): StreamStats {
    return { messages: stats.messages, chatters: stats.chatters.size, likes, supporters: [...stats.supporters] };
  }

  /** Counts every chat message for the outro; Super Chats and memberships also go on the credits. */
  function recordMessage(message: ChatMessage) {
    stats.messages += 1;
    stats.chatters.add(message.authorChannelId || message.author);
    if (stats.supporters.length >= MAX_SUPPORTERS) return;
    if (message.superChat) {
      const { amount, currency } = message.superChat;
      stats.supporters.push({ name: message.author, kind: 'super', detail: currency ? `${currency} ${amount}` : amount });
    } else if (message.membershipGiftPurchase) {
      stats.supporters.push({ name: message.author, kind: 'gift', detail: message.giftCount ? String(message.giftCount) : undefined });
    } else if (message.membershipGift) {
      // New members and membership milestones arrive as the same item type, so the credits list both as members.
      stats.supporters.push({ name: message.author, kind: 'member' });
    }
  }

  function resetSession() {
    stats.messages = 0;
    stats.chatters.clear();
    stats.supporters.length = 0;
    likes = null;
    viewers = null;
    publish();
  }

  function resetOutro() {
    outro = { startedAt: null, stats: null };
    publish();
  }

  let likeTimer: NodeJS.Timeout | null = null;
  let likeInFlight = false;

  async function pollLikes() {
    if (likeInFlight) return;
    likeInFlight = true;
    try {
      const count = await fetchLikes();
      if (count !== null && count !== likes) {
        likes = count;
        publish();
      }
    } catch (error) {
      console.warn(`[Show] Like count fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      likeInFlight = false;
    }
  }

  /** Called when a stream connects; `initial` is the like count read during bootstrap. */
  function setViewers(count: number | null) {
    if (count === viewers) return;
    viewers = count;
    publish();
  }

  function startLikes(initial: number | null) {
    stopLikes();
    likes = initial;
    publish();
    likeTimer = setInterval(() => void pollLikes(), LIKE_POLL_MS);
  }

  function stopLikes() {
    if (likeTimer) clearInterval(likeTimer);
    likeTimer = null;
  }

  /** Forces the QR code open for a while, on top of the regular cycle the overlay runs from the clock. */
  function showSponsor(seconds: number) {
    if (!saved.sponsor.url) return false;
    sponsorVisibleUntil = Date.now() + seconds * 1000;
    publish();
    return true;
  }

  const sponsorTimer = setInterval(() => {
    const now = Date.now();
    if (sponsorVisibleUntil !== null && now >= sponsorVisibleUntil) {
      sponsorVisibleUntil = null;
      publish();
    }
  }, SPONSOR_TICK_MS);
  sponsorTimer.unref();

  function readMusic(): ShowState['music'] {
    let mtime: number;
    try {
      mtime = statSync(musicFile).mtimeMs;
    } catch {
      return null;
    }
    if (Date.now() - mtime > MUSIC_STALE_MS) return null;
    if (mtime === musicMtime) return music;
    musicMtime = mtime;
    try {
      const raw = asObject(JSON.parse(readFileSync(musicFile, 'utf8')));
      const title = text(raw?.title, 200);
      if (!raw || !title) return null;
      const since = int(raw.since, 0, Number.MAX_SAFE_INTEGER) ?? Math.round(mtime);
      return {
        title,
        artist: text(raw.artist, 200) ?? '',
        coverVersion: raw.cover === true && existsSync(coverFile) ? since : null,
        since
      };
    } catch {
      return null;
    }
  }

  const musicTimer = setInterval(() => {
    const next = readMusic();
    if (JSON.stringify(next) === JSON.stringify(music)) return;
    music = next;
    publish();
  }, MUSIC_POLL_MS);
  musicTimer.unref();

  function register(fastify: FastifyInstance) {
    fastify.post('/show/countdown', async (request, reply) => {
      const body = asObject(request.body);
      const now = Date.now();
      switch (body?.action) {
        case 'start': {
          const minutes = int(body.minutes, 1, 240);
          if (minutes === undefined) break;
          countdown = { endsAt: now + minutes * 60_000, durationMs: minutes * 60_000 };
          publish();
          return { ok: true };
        }
        case 'shift': {
          const minutes = int(body.minutes, -60, 60);
          // Inside the final seconds a shift would make the overlay jump back up; stop or restart instead.
          if (minutes === undefined || countdown.endsAt === null || countdown.endsAt - now <= FINAL_COUNTDOWN_MS) break;
          // Never shift past the final seconds; a cut that big means "start now", which is its own action.
          const endsAt = Math.max(countdown.endsAt + minutes * 60_000, now + FINAL_COUNTDOWN_MS);
          countdown = { endsAt, durationMs: Math.max(countdown.durationMs + (endsAt - countdown.endsAt), endsAt - now) };
          publish();
          return { ok: true };
        }
        case 'final':
          countdown = { endsAt: now + FINAL_COUNTDOWN_MS, durationMs: countdown.endsAt ? countdown.durationMs : FINAL_COUNTDOWN_MS };
          publish();
          return { ok: true };
        case 'stop':
          countdown = { endsAt: null, durationMs: 0 };
          publish();
          return { ok: true };
      }
      reply.status(400);
      return { error: 'action must be start (minutes 1-240), shift (minutes -60..60, before the last 10 seconds), final or stop' };
    });

    fastify.post('/show/settings', async (request, reply) => {
      const body = asObject(request.body);
      if (!body) {
        reply.status(400);
        return { error: 'JSON body required' };
      }
      const title = text(body.title, 80);
      const topic = text(body.topic, 160);
      const likeStep = int(body.likeStep, 5, 100_000);
      if (body.likeStep !== undefined && likeStep === undefined) {
        reply.status(400);
        return { error: 'Like goal step must be a number from 5 to 100000' };
      }
      if (title !== undefined) saved.title = title;
      if (topic !== undefined) saved.topic = topic;
      if (likeStep !== undefined) saved.likeStep = likeStep;
      save();
      publish();
      return { ok: true };
    });

    fastify.post('/show/sponsor', async (request, reply) => {
      const body = asObject(request.body);
      if (!body) {
        reply.status(400);
        return { error: 'JSON body required' };
      }
      const url = text(body.url, 500);
      if (url !== undefined && url !== '' && !httpUrl(url)) {
        reply.status(400);
        return { error: 'url must start with http:// or https://' };
      }
      const next = { ...saved.sponsor };
      const name = text(body.name, 80);
      const caption = text(body.caption, 120);
      const everySeconds = int(body.everySeconds, 10, 3600);
      const showSeconds = int(body.showSeconds, 3, 3600);
      if ((body.everySeconds !== undefined && everySeconds === undefined) || (body.showSeconds !== undefined && showSeconds === undefined)) {
        reply.status(400);
        return { error: 'Open the QR code every 10-3600 seconds, for 3-3600 seconds' };
      }
      if (name !== undefined) next.name = name;
      if (url !== undefined) next.url = url;
      if (caption !== undefined) next.caption = caption;
      if (everySeconds !== undefined) next.everySeconds = everySeconds;
      if (showSeconds !== undefined) next.showSeconds = showSeconds;
      if (typeof body.auto === 'boolean') next.auto = body.auto;
      if (next.showSeconds >= next.everySeconds) {
        reply.status(400);
        return { error: 'The QR code must stay up for less time than the cycle' };
      }
      const urlChanged = next.url !== saved.sponsor.url;
      saved.sponsor = next;
      save();
      if (urlChanged) await refreshQr();
      publish();
      return { ok: true };
    });

    fastify.post('/show/sponsor/logo', { bodyLimit: Math.ceil(MAX_LOGO_BYTES * 1.4) + 1024 }, async (request, reply) => {
      const dataUrl = text(asObject(request.body)?.dataUrl, MAX_LOGO_BYTES * 2);
      const match = dataUrl?.match(/^data:[^;,]*;base64,(.+)$/);
      const bytes = match ? Buffer.from(match[1], 'base64') : null;
      const kind = bytes && bytes.length <= MAX_LOGO_BYTES ? LOGO_TYPES.find((t) => t.test(bytes)) : undefined;
      if (!bytes || !kind) {
        reply.status(400);
        return { error: 'Logo must be a PNG, JPEG or WebP image under 2.5 MB' };
      }
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(logoFile, bytes);
      saved.logoType = kind.type;
      saved.logoVersion = Date.now();
      save();
      publish();
      return { ok: true };
    });

    fastify.delete('/show/sponsor/logo', async () => {
      rmSync(logoFile, { force: true });
      saved.logoType = null;
      saved.logoVersion = null;
      save();
      publish();
      return { ok: true };
    });

    fastify.get('/show/sponsor/logo', async (_request, reply) => {
      if (!saved.logoType || !existsSync(logoFile)) {
        reply.status(404);
        return { error: 'No sponsor logo' };
      }
      reply.header('Content-Type', saved.logoType);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'no-cache');
      return reply.send(readFileSync(logoFile));
    });

    fastify.get('/show/music/cover', async (_request, reply) => {
      // The watcher writes the next track's cover just before its entry, so a cover newer than the entry is not this track's.
      const cover = music?.coverVersion ? statSync(coverFile, { throwIfNoEntry: false }) : undefined;
      if (!cover || cover.mtimeMs > musicMtime) {
        reply.status(404);
        return { error: 'No cover' };
      }
      reply.header('Content-Type', 'image/jpeg');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'no-cache');
      return reply.send(readFileSync(coverFile));
    });

    fastify.post('/show/sponsor/show', async (request, reply) => {
      const body = asObject(request.body);
      if (!body) {
        reply.status(400);
        return { error: 'JSON body required' };
      }
      if (body.hide === true) {
        sponsorVisibleUntil = null;
        publish();
        return { ok: true };
      }
      if (!showSponsor(int(body.seconds, 5, 300) ?? saved.sponsor.showSeconds)) {
        reply.status(400);
        return { error: 'Set a sponsor link first' };
      }
      return { ok: true };
    });

    fastify.post('/show/outro', async (request, reply) => {
      const body = asObject(request.body);
      if (typeof body?.active !== 'boolean') {
        reply.status(400);
        return { error: 'active must be true or false' };
      }
      outro = body.active ? { startedAt: Date.now(), stats: currentStats() } : { startedAt: null, stats: null };
      publish();
      return { ok: true };
    });
  }

  return {
    ready: refreshQr(),
    snapshot,
    register,
    recordMessage,
    resetSession,
    resetOutro,
    startLikes,
    setViewers,
    stopLikes
  };
}

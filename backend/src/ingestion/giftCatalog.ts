import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import type { GiftPricesStatus } from '@shared/chat';
import https from 'https';
import Innertube from 'youtubei.js';

/**
 * Jewel prices for YouTube's live chat gifts.
 *
 * A gift chat item names the gift but carries no price; the price only appears in the gift picker, which YouTube
 * serves to signed-in viewers. When YT_COOKIE_FILE points at a file holding the Cookie header of a signed-in
 * youtube.com session, the picker is fetched once per stream (at most every few hours) and prices are matched by the
 * gift's image asset, with the English gift name as a fallback. Every successful fetch is saved to disk and loaded
 * at startup, so an expired cookie falls back to the last known prices instead of none; the dashboard shows a
 * warning until the cookie is replaced. Without a cookie or a saved file, gifts show without a price.
 * The cookie is a full Google session: use a throwaway account, keep the file mode 600 and outside the repo.
 */

export type GiftPrices = { byAsset: Map<string, number>; byName: Map<string, number>; fetchedAt: number };

const PANEL_ID = 'PApdg_gift_buy_flow';
const REFRESH_MS = 6 * 60 * 60 * 1000;
// Also the minimum gap between any two attempts, so a stream of unpriced gifts cannot hammer the account.
const MIN_ATTEMPT_GAP_MS = 5 * 60 * 1000;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0';

let prices: GiftPrices | null = null;
let lastAttempt = 0;
let inFlight = false;
let cacheFile: string | null = null;
let status: GiftPricesStatus = { state: 'off', count: 0, updatedAt: null };
let onStatus: (status: GiftPricesStatus) => void = () => {};

class CookieExpiredError extends Error {}
/** The channel has gifts off (or the page changed); the cookie is fine, so this is not shown as a failure. */
class NoGiftsError extends Error {}
let lastCookie: string | null = null;

function setStatus(next: Omit<GiftPricesStatus, 'count' | 'updatedAt'>) {
  const updated: GiftPricesStatus = { ...next, count: prices?.byAsset.size ?? 0, updatedAt: prices?.fetchedAt || null };
  // Unchanged status is not re-broadcast, so a burst of unpriced gifts cannot flood the WebSocket clients.
  if (JSON.stringify(updated) === JSON.stringify(status)) return;
  status = updated;
  onStatus(status);
}

function priceTable(record: unknown): Map<string, number> {
  const table = new Map<string, number>();
  if (!record || typeof record !== 'object') throw new Error('price table missing');
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) table.set(key, value);
  }
  return table;
}

export function giftPricesStatus(): GiftPricesStatus {
  return status;
}

/** Loads the saved price table and reports status changes; call once at startup. */
export function initGiftPrices(dataDir: string, listener: (status: GiftPricesStatus) => void): void {
  cacheFile = path.join(dataDir, 'gift-prices.json');
  onStatus = listener;
  try {
    const saved = JSON.parse(readFileSync(cacheFile, 'utf8')) as { fetchedAt?: unknown; byAsset?: unknown; byName?: unknown };
    const fetchedAt = Number(saved.fetchedAt);
    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) throw new Error('no fetch time');
    prices = { fetchedAt, byAsset: priceTable(saved.byAsset), byName: priceTable(saved.byName) };
    console.log(`[Gifts] Loaded ${prices.byAsset.size} saved jewel prices`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[Gifts] Ignoring unreadable ${cacheFile}: ${(error as Error).message}`);
  }
  setStatus({ state: process.env.YT_COOKIE_FILE || prices ? 'ok' : 'off' });
}

function saveCache(table: GiftPrices) {
  if (!cacheFile) return;
  try {
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.tmp`;
    writeFileSync(tmp, JSON.stringify({ fetchedAt: table.fetchedAt, byAsset: Object.fromEntries(table.byAsset), byName: Object.fromEntries(table.byName) }, null, 1));
    renameSync(tmp, cacheFile);
  } catch (error) {
    console.warn(`[Gifts] Could not save prices: ${(error as Error).message}`);
  }
}

/** "…/assets/one_hundred_v2_320x320.png=w480-h480" -> "one_hundred_v2". Same in every UI language. */
export function giftAsset(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  let file: string;
  try {
    file = new URL(imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl).pathname.split('/').pop() ?? '';
  } catch {
    return undefined;
  }
  return file.replace(/\.(png|webp|gif).*$/, '').replace(/_\d+x\d+$/, '') || undefined;
}

/** Collects every giftItemViewModel in a get_panel response. */
export function parseGiftCatalog(panel: unknown, fetchedAt = Date.now()): GiftPrices {
  const byAsset = new Map<string, number>();
  const byName = new Map<string, number>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const gift = (node as Record<string, any>).giftItemViewModel;
    if (gift) {
      const jewels = Number(String(gift.tokenAmount?.content ?? '').replace(/[^\d]/g, ''));
      if (Number.isFinite(jewels) && jewels > 0) {
        const asset = giftAsset(gift.unselectedGiftImage?.sources?.[0]?.url);
        if (asset) byAsset.set(asset, jewels);
        const name = String(gift.giftName?.content ?? '').trim().toLowerCase();
        if (name) byName.set(name, jewels);
      }
    }
    for (const child of Object.values(node)) walk(child);
  };
  walk(panel);
  return { byAsset, byName, fetchedAt };
}

export function lookupJewels(table: GiftPrices | null, imageUrl: string | undefined, name: string): number | undefined {
  if (!table) return undefined;
  const asset = giftAsset(imageUrl);
  return (asset ? table.byAsset.get(asset) : undefined) ?? table.byName.get(name.trim().toLowerCase());
}

export function currentGiftPrices(): GiftPrices | null {
  return prices;
}

function readCookie(): string | null {
  const file = process.env.YT_COOKIE_FILE;
  if (!file) return null;
  let cookie = '';
  try {
    cookie = readFileSync(file, 'utf8').trim();
  } catch (error) {
    if (status.error !== 'cookie file unreadable') console.warn(`[Gifts] Cannot read YT_COOKIE_FILE: ${(error as Error).message}`);
    setStatus({ state: 'failed', error: 'cookie file unreadable' });
    return null;
  }
  if (!cookie) setStatus({ state: 'failed', error: 'cookie file is empty' });
  return cookie || null;
}

/**
 * GET through node:https rather than fetch: a signed-in page answers a browser user agent with Set-Cookie headers
 * past fetch's fixed 16 KB header limit, and without a browser user agent YouTube serves the signed-out page.
 */
function getPage(url: string, cookie: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Cookie: cookie, 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, maxHeaderSize: 128 * 1024, timeout: 20_000 },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`chat page answered ${response.statusCode}`));
          return;
        }
        response.setEncoding('utf8');
        let body = '';
        response.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 8 * 1024 * 1024) request.destroy(new Error('chat page too large'));
        });
        response.on('end', () => resolve(body));
        response.on('error', reject);
      }
    );
    request.on('timeout', () => request.destroy(new Error('chat page timed out')));
    request.on('error', reject);
  });
}

async function fetchCatalog(videoId: string, cookie: string): Promise<GiftPrices> {
  // The picker's params encode the channel and video, so they are read from the signed-in chat page.
  const html = await getPage(`https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&hl=en`, cookie);
  if (!html.includes('"LOGGED_IN":true')) throw new CookieExpiredError('cookie is not signed in (expired or incomplete)');
  const match = html.match(new RegExp(`"tag":"${PANEL_ID}"[\\s\\S]{0,800}?"params":"([^"]+)"`));
  if (!match) throw new NoGiftsError('no gift button on this chat (gifts off for the channel, or the page changed)');

  const client = await Innertube.create({ cookie, retrieve_player: false });
  const panel = await client.actions.execute('/get_panel', { panelId: PANEL_ID, params: decodeURIComponent(match[1]), parse: false });
  const table = parseGiftCatalog(panel.data);
  if (table.byAsset.size === 0) throw new Error('gift panel held no priced gifts');
  return table;
}

/**
 * Refreshes the price table in the background; never throws and never blocks the chat connection.
 * `missing` is set when a gift arrived without a price: it skips the freshness check (a new gift, or a first load
 * that failed before the stream went live) but still honours the gap between attempts.
 */
export function refreshGiftPrices(videoId: string, missing = false): void {
  const now = Date.now();
  if (inFlight) return;
  // After an expired or failed load, reconnects try again (within the gap below).
  if (!missing && status.state === 'ok' && prices && now - prices.fetchedAt < REFRESH_MS) return;
  const cookie = readCookie();
  // A replaced cookie is tried at once; otherwise attempts keep their gap, whatever triggers them.
  const replaced = cookie !== null && cookie !== lastCookie;
  if (!replaced && now - lastAttempt < MIN_ATTEMPT_GAP_MS) return;
  lastAttempt = now;
  if (!cookie) return;
  lastCookie = cookie;
  inFlight = true;
  fetchCatalog(videoId, cookie)
    .then((table) => {
      prices = table;
      saveCache(table);
      setStatus({ state: 'ok' });
      console.log(`[Gifts] Loaded jewel prices for ${table.byAsset.size} gifts`);
    })
    .catch((error) => {
      const cause = (error as { cause?: { code?: string; message?: string } }).cause;
      const detail = cause ? ` (${cause.code ?? cause.message})` : '';
      console.warn(`[Gifts] Could not load the gift catalog: ${(error as Error).message}${detail}`);
      if (error instanceof CookieExpiredError) setStatus({ state: 'expired' });
      else if (!(error instanceof NoGiftsError)) setStatus({ state: 'failed', error: (error as Error).message });
    })
    .finally(() => {
      inFlight = false;
    });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGift, resolveRunUrl } from './youtubei';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { currentGiftPrices, giftAsset, giftPricesStatus, initGiftPrices, parseGiftCatalog } from './giftCatalog';

test('empty input', () => {
  assert.equal(resolveRunUrl(undefined), undefined);
  assert.equal(resolveRunUrl(''), undefined);
});

test('plain https URL is returned unchanged', () => {
  assert.equal(resolveRunUrl('https://example.com/path?a=1&b=2'), 'https://example.com/path?a=1&b=2');
  assert.equal(resolveRunUrl('http://example.com'), 'http://example.com');
});

test('site-relative path becomes an absolute youtube.com URL', () => {
  assert.equal(resolveRunUrl('/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(resolveRunUrl('/@channel'), 'https://www.youtube.com/@channel');
});

test('redirect wrapper resolves to the encoded q parameter', () => {
  const wrapped =
    'https://www.youtube.com/redirect?event=live_chat&redir_token=TOKEN&q=https%3A%2F%2Fexample.com%2Fp%3Fa%3D1%26b%3D2&html_redirect=1';
  assert.equal(resolveRunUrl(wrapped), 'https://example.com/p?a=1&b=2');
  assert.equal(resolveRunUrl('/redirect?q=https%3A%2F%2Fexample.com'), 'https://example.com');
  assert.equal(resolveRunUrl('https://www.youtube.com/redirect?event=x'), 'https://www.youtube.com/redirect?event=x');
});

test('unparseable input', () => {
  assert.equal(resolveRunUrl('not a url'), undefined);
});

// Shape of a GiftMessageView item as youtubei.js 15.1.1 JIT-parses it (captured 14.11.2026, names invented).
const giftItem = {
  type: 'GiftMessageView',
  id: 'gift-1',
  text: { content: 'sent 100' },
  author_name: { content: '@example ' },
  author_avatar: { image: [{ url: 'https://yt4.ggpht.com/avatar=s64' }] },
  gift_image: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/one_hundred_v2_320x320.png=w480-h480' }] }
};

test('gift item maps to a gift message', () => {
  const message = normalizeGift(giftItem);
  assert.equal(message?.author, '@example');
  assert.equal(message?.authorPhoto, 'https://yt4.ggpht.com/avatar=s64');
  assert.deepEqual(message?.gift, {
    name: '100',
    imageUrl: 'https://www.gstatic.com/youtube/img/pdg/gift/assets/one_hundred_v2_320x320.png=w480-h480'
  });
});

test('gift item without a name or author is dropped', () => {
  assert.equal(normalizeGift({ ...giftItem, text: { content: 'sent ' } }), null);
  assert.equal(normalizeGift({ ...giftItem, author_name: undefined }), null);
});

test('gift image with a non-https scheme is dropped', () => {
  const message = normalizeGift({ ...giftItem, gift_image: { sources: [{ url: 'javascript:alert(1)' }] } });
  assert.equal(message?.gift?.imageUrl, undefined);
});

test('gift image outside Google CDNs is dropped', () => {
  const message = normalizeGift({ ...giftItem, gift_image: { sources: [{ url: 'https://evil.example/x.png' }] } });
  assert.equal(message?.gift?.imageUrl, undefined);
});

// Trimmed giftItemViewModel entries from a get_panel response (gift picker), captured 14.11.2026.
const catalogPanel = {
  contents: [
    { giftItemViewModel: { giftId: 'garlic', giftName: { content: 'Garlic' }, tokenAmount: { content: '20' },
      unselectedGiftImage: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png=w80-h80' }] } } },
    { giftItemViewModel: { giftId: 'one_hundred', giftName: { content: '100' }, tokenAmount: { content: '2' },
      unselectedGiftImage: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/one_hundred_v2.png=w80-h80' }] } } },
    { giftItemViewModel: { giftId: 'disco_party', giftName: { content: 'Disco party' }, tokenAmount: { content: '39,500' },
      unselectedGiftImage: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/disco_ball.png=w80-h80' }] } } }
  ]
};

test('gift catalog parses prices by asset and name', () => {
  const prices = parseGiftCatalog(catalogPanel);
  assert.equal(prices.byAsset.get('garlic'), 20);
  assert.equal(prices.byAsset.get('one_hundred_v2'), 2);
  assert.equal(prices.byAsset.get('disco_ball'), 39500);
  assert.equal(prices.byName.get('disco party'), 39500);
});

test('gift asset ignores size suffixes', () => {
  assert.equal(giftAsset('//www.gstatic.com/youtube/img/pdg/gift/assets/one_hundred_v2_320x320.png=w480-h480'), 'one_hundred_v2');
  assert.equal(giftAsset('https://www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png=w480-h480'), 'garlic');
});

test('gift price comes from the catalog', () => {
  const prices = parseGiftCatalog(catalogPanel);
  assert.equal(normalizeGift(giftItem, prices)?.gift?.jewels, 2);
  const garlic = normalizeGift(
    {
      ...giftItem,
      text: { content: 'sent Garlic' },
      gift_image: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png=w480-h480' }] }
    },
    prices
  );
  assert.deepEqual(garlic?.gift, { name: 'Garlic', imageUrl: 'https://www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png=w480-h480', jewels: 20 });
});

test('gift price falls back to the name when the chat image differs', () => {
  const prices = parseGiftCatalog(catalogPanel);
  const disco = normalizeGift(
    { ...giftItem, text: { content: 'sent Disco party' }, gift_image: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/disco_ball_anim.png' }] } },
    prices
  );
  assert.equal(disco?.gift?.jewels, 39500);
});

test('gift without a catalog or missing from it has no jewel count', () => {
  assert.equal(normalizeGift(giftItem, null)?.gift?.jewels, undefined);
  const message = normalizeGift(
    { ...giftItem, text: { content: 'sent New thing' }, gift_image: { sources: [{ url: '//www.gstatic.com/youtube/img/pdg/gift/assets/new_thing.png=w480-h480' }] } },
    parseGiftCatalog(catalogPanel)
  );
  assert.equal(message?.gift?.jewels, undefined);
});

test('saved gift prices load at startup', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gift-prices-'));
  writeFileSync(path.join(dir, 'gift-prices.json'), JSON.stringify({ fetchedAt: 1, byAsset: { garlic: 20 }, byName: { garlic: 20 } }));
  const seen: string[] = [];
  initGiftPrices(dir, (status) => seen.push(status.state));
  assert.equal(currentGiftPrices()?.byAsset.get('garlic'), 20);
  assert.deepEqual(giftPricesStatus(), { state: 'ok', count: 1, updatedAt: 1 });
  assert.deepEqual(seen, ['ok']);
  rmSync(dir, { recursive: true, force: true });
});

test('saved prices with junk values keep only valid numbers', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gift-prices-'));
  writeFileSync(path.join(dir, 'gift-prices.json'), JSON.stringify({ fetchedAt: 5, byAsset: { garlic: 20, bad: '20', neg: -1 }, byName: {} }));
  initGiftPrices(dir, () => {});
  assert.deepEqual([...(currentGiftPrices()?.byAsset ?? [])], [['garlic', 20]]);
  rmSync(dir, { recursive: true, force: true });
});

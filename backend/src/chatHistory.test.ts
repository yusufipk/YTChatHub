import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ChatMessage } from '@shared/chat';
import { createChatHistory, replayKey } from './chatHistory';

const message = (id: string, text = 'hello'): ChatMessage => ({ id, author: 'Ada', text, publishedAt: '2026-11-14T12:00:00.000Z' });
const session = { messages: 3, chatters: ['Ada'], supporters: [{ name: 'Ada', kind: 'jewel' as const, detail: 'Garlic (20)' }] };

test('saved chat comes back only for the same live id', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chat-history-'));
  const history = createChatHistory(dir, () => ({ liveId: 'aaaaaaaaaaa', messages: [message('m1'), message('m2')], session }));
  history.schedule();
  history.flush();
  const saved = history.load('aaaaaaaaaaa');
  assert.deepEqual(saved?.messages.map((m) => m.id), ['m1', 'm2']);
  assert.deepEqual(saved?.session, session);
  assert.equal(history.load('bbbbbbbbbbb'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('nothing is written while no stream is recorded', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chat-history-'));
  const history = createChatHistory(dir, () => null);
  history.schedule();
  history.flush();
  assert.equal(history.load('aaaaaaaaaaa'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('corrupt history is ignored and malformed messages are dropped', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chat-history-'));
  const history = createChatHistory(dir, () => null);
  writeFileSync(path.join(dir, 'chat-history.json'), '{not json');
  assert.equal(history.load('aaaaaaaaaaa'), null);
  writeFileSync(path.join(dir, 'chat-history.json'), JSON.stringify({ liveId: 'aaaaaaaaaaa', messages: [message('ok'), { id: 5 }, null] }));
  const saved = history.load('aaaaaaaaaaa');
  assert.deepEqual(saved?.messages.map((m) => m.id), ['ok']);
  assert.deepEqual(saved?.session, { messages: 0, chatters: [], supporters: [] });
  rmSync(dir, { recursive: true, force: true });
});

test('replay key ignores the uniqueness suffix but not the text', () => {
  assert.equal(replayKey(message('abc#2')), replayKey(message('abc')));
  assert.notEqual(replayKey(message('abc', 'one')), replayKey(message('abc', 'two')));
});

test('a flush with no new chat leaves the saved stream alone', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chat-history-'));
  let liveId = 'aaaaaaaaaaa';
  const history = createChatHistory(dir, () => ({ liveId, messages: liveId === 'aaaaaaaaaaa' ? [message('m1')] : [], session }));
  history.schedule();
  history.flush();
  // A mistyped id was tried and failed: switching streams flushes, but nothing new was recorded.
  liveId = 'bbbbbbbbbbb';
  history.flush();
  assert.deepEqual(history.load('aaaaaaaaaaa')?.messages.map((m) => m.id), ['m1']);
  rmSync(dir, { recursive: true, force: true });
});

test('restored links and images are held to the live rules', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chat-history-'));
  const history = createChatHistory(dir, () => null);
  const crafted = {
    ...message('x'),
    authorPhoto: 'https://evil.example/a.png',
    runs: [{ text: 'hi', url: 'javascript:alert(1)' }, { text: 'ok', url: 'https://example.com' }],
    gift: { name: 'Garlic', imageUrl: 'https://www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png' }
  };
  writeFileSync(path.join(dir, 'chat-history.json'), JSON.stringify({ liveId: 'aaaaaaaaaaa', messages: [crafted] }));
  const [restored] = history.load('aaaaaaaaaaa')?.messages ?? [];
  assert.equal(restored.authorPhoto, undefined);
  assert.deepEqual(restored.runs?.map((r) => r.url), [undefined, 'https://example.com']);
  assert.equal(restored.gift?.imageUrl, 'https://www.gstatic.com/youtube/img/pdg/gift/assets/garlic.png');
  rmSync(dir, { recursive: true, force: true });
});

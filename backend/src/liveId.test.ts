import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLiveId } from './liveId';

const ID = 'dQw4w9WgXcQ';

test('bare id', () => {
  assert.equal(extractLiveId(ID), ID);
  assert.equal(extractLiveId(`  ${ID}\n`), ID);
});

test('watch URLs', () => {
  assert.equal(extractLiveId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extractLiveId(`https://www.youtube.com/watch?v=${ID}&t=42s&feature=share`), ID);
  assert.equal(extractLiveId(`https://m.youtube.com/watch?feature=share&v=${ID}`), ID);
  assert.equal(extractLiveId(`youtube.com/watch?v=${ID}`), ID);
});

test('short and live URLs', () => {
  assert.equal(extractLiveId(`https://youtu.be/${ID}`), ID);
  assert.equal(extractLiveId(`https://youtu.be/${ID}?si=abc123`), ID);
  assert.equal(extractLiveId(`https://www.youtube.com/live/${ID}`), ID);
  assert.equal(extractLiveId(`https://www.youtube.com/live/${ID}?feature=share`), ID);
  assert.equal(extractLiveId(`https://www.youtube.com/embed/${ID}`), ID);
});

test('junk', () => {
  assert.equal(extractLiveId(undefined), '');
  assert.equal(extractLiveId(''), '');
  assert.equal(extractLiveId('hello world'), '');
  assert.equal(extractLiveId('dQw4w9WgXc'), '');
  assert.equal(extractLiveId('https://www.youtube.com/'), '');
  assert.equal(extractLiveId('https://www.youtube.com/watch?v=short'), '');
  assert.equal(extractLiveId(`https://example.com/${ID}`), '');
  assert.equal(extractLiveId('http://[bad'), '');
});

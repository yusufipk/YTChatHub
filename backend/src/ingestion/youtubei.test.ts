import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRunUrl } from './youtubei';

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

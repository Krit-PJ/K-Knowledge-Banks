// Static safety checks for the GitHub Pages frontend (P2-WP5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../../frontend/${f}`, import.meta.url), 'utf8');

test('console.js: no HTML injection sinks, no token storage, no eval', () => {
  const js = read('console.js');
  for (const bad of [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function\s*\(/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/]) {
    assert.ok(!bad.test(js), String(bad));
  }
  assert.ok(/redirect: 'follow'/.test(js) && /text\/plain/.test(js));
});

test('pages carry a restrictive CSP; index runs no scripts at all', () => {
  const idx = read('index.html'); const con = read('console.html');
  assert.match(idx, /default-src 'none'/); assert.ok(!/<script/i.test(idx));
  assert.match(con, /default-src 'none'; script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client;/);
  assert.ok(!/unsafe-eval/.test(con));
  for (const src of con.match(/<script[^>]*src="([^"]+)"/g) || []) assert.ok(/accounts\.google\.com\/gsi\/client|console\.js/.test(src), src);
});

test('config.json holds only public, non-secret settings', () => {
  const c = JSON.parse(read('config.json'));
  assert.deepEqual(Object.keys(c).sort(), ['apiUrl', 'note', 'oauthClientId']);
  assert.ok(c.apiUrl === '' || /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(c.apiUrl));
  assert.ok(c.oauthClientId === '' || /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(c.oauthClientId));
});

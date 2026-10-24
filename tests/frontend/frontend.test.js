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

test('P2-WP6: templates.json is generated, has no envelope/authority fields and no real data', async () => {
  const { buildTemplates } = await import('../../scripts/build-templates.mjs');
  assert.equal(read('templates.json'), buildTemplates(), 'run: npm run build:templates');
  const { templates } = JSON.parse(read('templates.json'));
  assert.ok(Object.keys(templates).length >= 8);
  for (const [type, t] of Object.entries(templates)) {
    assert.equal(t.type, type);
    for (const f of ['id', 'schemaVersion', 'revision', 'workflowState', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'provenance']) assert.ok(!(f in t), `${type}.${f}`);
    assert.ok(!['SourceAsset', 'ReviewSnapshot'].includes(type));
  }
});

test('P2-WP6: every API action the console calls exists on the backend; mutations send idempotency keys', async () => {
  const js = read('console.js');
  const vm = await import('node:vm');
  const ctx = vm.createContext({});
  for (const f of ['Lib.js', 'Api.js']) vm.runInContext(fs.readFileSync(new URL(`../../backend/apps-script/${f}`, import.meta.url), 'utf8'), ctx);
  const lines = js.split('\n');
  const calls = [];
  lines.forEach((line) => { for (const m of line.matchAll(/\b(api|act)\(.*?'(whoami|[a-z]+\.[a-z]+)'\s*[,)]/g)) calls.push({ fn: m[1], action: m[2] }); });
  const used = new Set(calls.map((c) => c.action));
  assert.ok(used.size >= 12, [...used].join(','));
  for (const a of used) assert.ok(a in ctx.KEKB_API.ACTIONS, a);
  for (const c of calls) {
    const spec = ctx.KEKB_API.ACTIONS[c.action];
    assert.equal(c.fn, spec.mutation ? 'act' : 'api', `${c.action}: mutations go through act() (idempotency key), reads through api()`);
  }
});

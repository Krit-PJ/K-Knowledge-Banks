// P2-WP5: secure write boundary (Api.js) — authentication, authorization, validation, idempotency, audit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ctx = {}; vm.createContext(ctx);
for (const f of ['Lib.js', 'Api.js']) vm.runInContext(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), ctx);
const API = ctx.KEKB_API;
const plain = (v) => JSON.parse(JSON.stringify(v)); // cross-realm → plain objects
const CLIENT = '1234567890-abc.apps.googleusercontent.com';
const NOW = Date.parse('2026-10-24T16:00:00.000Z');
const ACTORS = {
  'owner@example.com': { actorId: 'human:krit', roles: ['CONTRIBUTOR', 'REVIEWER', 'ADMIN'] },
  'viewer@example.com': { actorId: 'human:viewer-1', roles: ['VIEWER'] },
};
const IID = '019a1b2c-3d4e-7f00-8abc-0123456789ab';
const claimsFor = (email, over = {}) => ({ aud: CLIENT, iss: 'https://accounts.google.com', exp: String(NOW / 1000 + 600), email, email_verified: 'true', ...over });
const TOKENS = { 'tok-owner-xxxxxxxxxxxxxxxx': claimsFor('Owner@Example.com'), 'tok-viewer-xxxxxxxxxxxxxxx': claimsFor('viewer@example.com'),
  'tok-stranger-xxxxxxxxxxxxx': claimsFor('stranger@example.com'), 'tok-wrongaud-xxxxxxxxxxxxx': claimsFor('owner@example.com', { aud: 'other' }),
  'tok-expired-xxxxxxxxxxxxxx': claimsFor('owner@example.com', { exp: String(NOW / 1000 - 1) }), 'tok-unverified-xxxxxxxxxxx': claimsFor('owner@example.com', { email_verified: 'false' }),
  'tok-badiss-xxxxxxxxxxxxxxx': claimsFor('owner@example.com', { iss: 'evil.example.com' }) };

function setup() {
  const rows = [{ intakeId: IID, sourceKind: 'application/pdf', sha256: 'a'.repeat(64), accessClassification: 'RESTRICTED', originalLanguage: '', driveFileId: 'drv1', workflowState: 'RECEIVED', assignedTo: '', receivedAt: '2026-10-24T15:00:00.000Z', updatedAt: '2026-10-24T15:00:00.000Z', note: '' }];
  const audit = []; const idem = new Map(); const writes = []; let n = 0; let fetches = 0;
  const deps = {
    nowMs: () => NOW, clientId: CLIENT, actors: ACTORS, newRequestId: () => `req-${++n}`,
    fetchClaims: (t) => { fetches++; if (t === 'tok-down-xxxxxxxxxxxxxxxxx') throw new Error('network'); return TOKENS[t] || null; },
    hash: (s) => crypto.createHash('sha256').update(s).digest('hex'),
    intake: { list: () => rows, find: (id) => { const i = rows.findIndex((r) => r.intakeId === id); return i < 0 ? null : { row: i + 2, obj: rows[i] }; },
      update: (row, ch) => { writes.push({ row, ch: plain(ch) }); Object.assign(rows[row - 2], ch); } },
    idem: { get: (k) => idem.get(k) || null, put: (k, v) => idem.set(k, v) },
    audit: (e) => audit.push(plain(e)),
  };
  return { deps, rows, audit, writes, fetchesRef: () => fetches };
}
const call = (s, body) => plain(API.handle(typeof body === 'string' ? body : JSON.stringify(body), s.deps));
const upd = (over = {}) => ({ action: 'intake.update', idToken: 'tok-owner-xxxxxxxxxxxxxxxx', idempotencyKey: 'key-0000001',
  payload: { intakeId: IID, expectedUpdatedAt: '2026-10-24T15:00:00.000Z', accessClassification: 'PUBLIC', originalLanguage: 'th', assignedTo: 'human:krit', note: 'ตรวจสิทธิ์แล้ว' }, ...over });

test('whoami: identity from verified token + server allowlist; email never echoed', () => {
  const s = setup(); const r = call(s, { action: 'whoami', idToken: 'tok-owner-xxxxxxxxxxxxxxxx' });
  assert.equal(r.ok, true); assert.equal(r.data.actorId, 'human:krit');
  assert.deepEqual(r.data.assignableActors, ['human:krit', 'human:viewer-1']);
  assert.equal(r.contractVersion, 'v1.0-RC1'); assert.ok(r.requestId);
  assert.ok(!JSON.stringify(r).toLowerCase().includes('owner@example.com'));
});

test('authentication: wrong audience / expired / unverified / bad issuer / unknown / missing token → UNAUTHENTICATED', () => {
  for (const t of ['tok-wrongaud-xxxxxxxxxxxxx', 'tok-expired-xxxxxxxxxxxxxx', 'tok-unverified-xxxxxxxxxxx', 'tok-badiss-xxxxxxxxxxxxxxx', 'tok-unknown-xxxxxxxxxxxxxx', 'short']) {
    const s = setup(); assert.equal(call(s, { action: 'whoami', idToken: t }).error.code, 'UNAUTHENTICATED', t);
  }
  const s = setup(); assert.equal(call(s, { action: 'whoami' }).error.code, 'UNAUTHENTICATED');
});

test('authorization: not in allowlist → FORBIDDEN; VIEWER cannot update; browser-supplied roles ignored', () => {
  let s = setup(); assert.equal(call(s, { action: 'whoami', idToken: 'tok-stranger-xxxxxxxxxxxxx' }).error.code, 'FORBIDDEN');
  s = setup(); assert.equal(call(s, upd({ idToken: 'tok-viewer-xxxxxxxxxxxxxxx' })).error.code, 'FORBIDDEN');
  assert.equal(s.writes.length, 0);
  s = setup(); assert.equal(call(s, { ...upd({ idToken: 'tok-viewer-xxxxxxxxxxxxxxx' }), roles: ['ADMIN'] }).error.code, 'INVALID_INPUT', 'extra top-level keys rejected');
});

test('intake.update: writes only allowed columns, sets updatedAt, audits with actorId', () => {
  const s = setup(); const r = call(s, upd());
  assert.equal(r.ok, true); assert.deepEqual(r.data.changed, ['accessClassification', 'assignedTo', 'note', 'originalLanguage', 'updatedAt']);
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].row, 2);
  assert.deepEqual(Object.keys(s.writes[0].ch).sort(), ['accessClassification', 'assignedTo', 'note', 'originalLanguage', 'updatedAt']);
  assert.equal(s.rows[0].workflowState, 'RECEIVED', 'workflow state is not writable from the web');
  assert.deepEqual(s.audit, [{ actor: 'human:krit', action: 'api:intake.update', target: IID, outcome: 'OK', code: '' }]);
});

test('validation: bad enum / language / unknown assignee / unknown field / workflowState / long note / bad JSON / oversize', () => {
  const bad = [
    { accessClassification: 'TOP_SECRET' }, { originalLanguage: '<script>' }, { assignedTo: 'human:nobody' },
    { workflowState: 'APPROVED' }, { note: 'x'.repeat(501) }, { intakeId: 'not-a-uuid' },
  ];
  for (const b of bad) {
    const s = setup(); const r = call(s, upd({ payload: { ...upd().payload, ...b } }));
    assert.equal(r.error.code, 'INVALID_INPUT', JSON.stringify(b)); assert.equal(s.writes.length, 0);
    assert.ok(!JSON.stringify(r).includes('TOP_SECRET') && !JSON.stringify(r).includes('<script>'), 'values never echoed');
  }
  let s = setup(); assert.equal(call(s, '{not json').error.code, 'INVALID_INPUT');
  s = setup(); assert.equal(call(s, 'x'.repeat(140000)).error.code, 'INVALID_INPUT');
  s = setup(); assert.equal(call(s, { action: 'admin.deleteAll', idToken: 'tok-owner-xxxxxxxxxxxxxxxx' }).error.code, 'INVALID_INPUT');
});

test('concurrency: stale expectedUpdatedAt → REVISION_CONFLICT; missing row → NOT_FOUND; failures audited', () => {
  let s = setup(); const r = call(s, upd({ payload: { ...upd().payload, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' } }));
  assert.equal(r.error.code, 'REVISION_CONFLICT'); assert.equal(s.writes.length, 0);
  assert.deepEqual(s.audit, [{ actor: 'human:krit', action: 'api:intake.update', target: '', outcome: 'FAILED', code: 'REVISION_CONFLICT' }]);
  s = setup(); assert.equal(call(s, upd({ payload: { ...upd().payload, intakeId: '019a1b2c-3d4e-7f00-8abc-000000000000' } })).error.code, 'NOT_FOUND');
});

test('idempotency: same key + same payload replays without a second write; different payload conflicts; key required', () => {
  const s = setup();
  const a = call(s, upd()); const b = call(s, upd());
  assert.equal(a.ok, true); assert.equal(b.replayed, true); assert.deepEqual(b.data, a.data); assert.equal(s.writes.length, 1);
  assert.equal(call(s, upd({ payload: { ...upd().payload, note: 'อื่น' } })).error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(call(setup(), upd({ idempotencyKey: undefined })).error.code, 'INVALID_INPUT');
});

test('dependency failure → DEPENDENCY_UNAVAILABLE (no false success), note control chars stripped', () => {
  let s = setup(); assert.equal(call(s, { action: 'whoami', idToken: 'tok-down-xxxxxxxxxxxxxxxxx' }).error.code, 'DEPENDENCY_UNAVAILABLE');
  s = setup(); call(s, upd({ payload: { ...upd().payload, note: ' ok\u0007\u0000 ' } }));
  assert.equal(s.writes[0].ch.note, 'ok');
});

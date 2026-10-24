// P2-WP6: web API for source registration, drafts, validation and human review (Api.js + generated Engine.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sliceDrafts, DRAFT_KEYS } from '../../../core/test/helpers.js';
import { loadScripts, plain, memStore, testClock } from './helpers.js';

const ctx = loadScripts('Lib.js', 'Engine.js', 'Api.js');
const API = ctx.KEKB_API;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const CLIENT = '1234567890-abc.apps.googleusercontent.com';
const NOW = Date.parse('2026-10-25T01:00:00.000Z');
const ACTORS = {
  'owner@example.com': { actorId: 'human:krit', roles: ['CONTRIBUTOR', 'REVIEWER', 'ADMIN'] },
  'contrib@example.com': { actorId: 'human:c1', roles: ['CONTRIBUTOR'] },
  'reviewer@example.com': { actorId: 'human:r1', roles: ['REVIEWER'] },
};
const claims = (email) => ({ aud: CLIENT, iss: 'accounts.google.com', exp: String(NOW / 1000 + 600), email, email_verified: true });
const TOK = { owner: 'tok-owner-xxxxxxxxxxxxxxxx', contrib: 'tok-contrib-xxxxxxxxxxxxxx', reviewer: 'tok-reviewer-xxxxxxxxxxxxx' };
const TOKENS = { [TOK.owner]: claims('owner@example.com'), [TOK.contrib]: claims('contrib@example.com'), [TOK.reviewer]: claims('reviewer@example.com') };
const IID = '019a1b2c-3d4e-7f00-8abc-0123456789ab';
const DIGEST = sha256('synthetic pdf bytes');

function setup({ verify } = {}) {
  const rows = [{ intakeId: IID, sourceAssetId: '', sourceRevision: '', sourceKind: 'application/pdf', sourceVersion: '2026-10-25T00:00:00.000Z', sha256: DIGEST,
    accessClassification: 'PUBLIC', originalLanguage: 'th', driveFileId: 'drv1', workflowState: 'RECEIVED', assignedTo: '', receivedAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z', syncedAt: '', note: '' }];
  const m = memStore(); const clk = testClock(); const audit = []; const idem = new Map(); let n = 0;
  m.store.listReviews = () => [...m.reviews.values()].map(plain);
  const deps = {
    nowMs: () => NOW, clientId: CLIENT, actors: ACTORS, newRequestId: () => `req-${++n}`,
    fetchClaims: (t) => TOKENS[t] || null, hash: sha256,
    intake: { list: () => rows, find: (id) => { const i = rows.findIndex((r) => r.intakeId === id); return i < 0 ? null : { row: i + 2, obj: rows[i] }; },
      update: (row, ch) => Object.assign(rows[row - 2], plain(ch)) },
    engine: ctx.KEKB_ENGINE.createEngine({ store: m.store, now: clk.now, newId: clk.newId, sha256 }),
    store: m.store,
    source: { verify: verify || (() => ({ sha256: DIGEST, mimeType: 'application/pdf', modifiedAt: '2026-10-25T00:00:00.000Z' })) },
    idem: { get: (k) => idem.get(k) || null, put: (k, v) => idem.set(k, v) },
    audit: (e) => audit.push(plain(e)),
  };
  let k = 0;
  const call = (action, payload, who = 'owner', key) => plain(API.handle(JSON.stringify({
    action, idToken: TOK[who], ...(payload === undefined ? {} : { payload }), ...(API.ACTIONS[action].mutation ? { idempotencyKey: key || `idem-key-${String(++k).padStart(4, '0')}` } : {}),
  }), deps));
  return { rows, m, audit, deps, call, clk };
}
const register = (s, who = 'owner') => s.call('source.register', { intakeId: IID, expectedUpdatedAt: s.rows[0].updatedAt, locatorCapabilities: ['page', 'paragraph'] }, who);

function modelAll(s, who = 'owner') {
  const r = register(s, who); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(s.call('source.extracted', { sourceId: r.data.sourceAssetId }, who).ok, true);
  const SA = { id: r.data.sourceAssetId, type: 'SourceAsset', revision: 1 };
  const id = Object.fromEntries(DRAFT_KEYS.map((x) => [x, s.clk.newId()]));
  for (const [i, rec] of sliceDrafts(id, SA)) {
    const out = s.call('draft.save', { id: i, record: rec, sourceRefs: [SA] }, who);
    assert.equal(out.ok, true, JSON.stringify(out));
  }
  return { SA, id, targets: [SA.id, ...Object.values(id)] };
}

test('end-to-end via API: register → extracted → drafts → validate → review request → self-review flagged (OD-08)', () => {
  const s = setup();
  const { id, targets, SA } = modelAll(s);
  assert.equal(s.rows[0].sourceAssetId, SA.id); assert.equal(s.rows[0].workflowState, 'REGISTERED');
  const list = s.call('draft.list');
  assert.equal(list.data.items.length, 11);
  const sa = s.call('draft.get', { id: SA.id }).data.record;
  assert.equal(sa.storageRef, `kekb-intake:${IID}`, 'no Drive file id inside records');
  assert.ok(!JSON.stringify(sa).includes('drv1'));
  const v = s.call('draft.validate');
  assert.equal(v.ok, true); assert.equal(v.data.valid, true, JSON.stringify(v.data.issues)); assert.equal(v.data.validated.length, 11);
  const rq = s.call('review.request', { targetIds: targets, protocolId: id.P });
  assert.equal(rq.ok, true);
  assert.equal(s.call('review.list').data.items[0].status, 'OPEN');
  const d = s.call('review.decide', { requestId: rq.data.requestId, decision: 'APPROVE', reason: { th: 'ตรวจหลักฐานครบ' } });
  assert.equal(d.ok, true, JSON.stringify(d)); assert.equal(d.data.selfReview, true); assert.equal(d.data.validationResult, 'PASS');
  const closed = s.call('review.list').data.items[0];
  assert.equal(closed.status, 'CLOSED'); assert.equal(closed.selfReview, true); assert.equal(closed.reviewerId, 'human:krit');
  assert.ok(s.audit.some((a) => a.action === 'api:review.decide' && a.outcome === 'OK' && a.code === 'SELF_REVIEW'));
  assert.ok(s.m.audit.some((a) => a.action === 'review:APPROVE' && a.code === 'SELF_REVIEW'));
});

test('separate contributor and reviewer: no self-review flag; roles enforced per action', () => {
  const s = setup();
  const { id, targets } = modelAll(s, 'contrib');
  assert.equal(s.call('draft.validate', undefined, 'reviewer').error.code, 'FORBIDDEN', 'reviewer cannot validate (contributor action)');
  assert.equal(s.call('draft.validate', undefined, 'contrib').data.valid, true);
  const rq = s.call('review.request', { targetIds: targets, protocolId: id.P }, 'contrib');
  assert.equal(s.call('review.decide', { requestId: rq.data.requestId, decision: 'APPROVE', reason: { th: 'x' } }, 'contrib').error.code, 'FORBIDDEN');
  const d = s.call('review.decide', { requestId: rq.data.requestId, decision: 'REJECT', reason: { en: 'insufficient evidence' } }, 'reviewer');
  assert.equal(d.ok, true); assert.equal(d.data.selfReview, false);
  assert.equal(s.call('draft.save', { record: { type: 'Claim' } }, 'reviewer').error.code, 'FORBIDDEN');
});

test('source.register: re-hash mismatch, missing language, double registration, Drive failure', () => {
  let s = setup({ verify: () => ({ sha256: 'b'.repeat(64), mimeType: 'application/pdf', modifiedAt: 'x' }) });
  assert.equal(register(s).error.code, 'REVISION_CONFLICT'); assert.equal(s.m.drafts.size, 0); assert.equal(s.rows[0].workflowState, 'RECEIVED');
  s = setup({ verify: () => { throw new Error('drive down'); } });
  assert.equal(register(s).error.code, 'DEPENDENCY_UNAVAILABLE');
  s = setup(); s.rows[0].originalLanguage = '';
  assert.deepEqual(register(s).error, { code: 'INVALID_INPUT', field: 'originalLanguage' });
  s = setup(); const before = s.rows[0].updatedAt; assert.equal(register(s).ok, true);
  assert.notEqual(s.rows[0].updatedAt, before);
  assert.equal(s.call('source.register', { intakeId: IID, expectedUpdatedAt: before, locatorCapabilities: ['page'] }).error.code, 'REVISION_CONFLICT', 'stale row');
  assert.equal(register(s).error.code, 'INVALID_TRANSITION', 'already registered');
  // classification is frozen after registration
  const u = s.call('intake.update', { intakeId: IID, expectedUpdatedAt: s.rows[0].updatedAt, accessClassification: 'RESTRICTED' });
  assert.equal(u.error.code, 'INVALID_TRANSITION');
  assert.equal(s.call('intake.update', { intakeId: IID, expectedUpdatedAt: s.rows[0].updatedAt, note: 'ok' }).ok, true, 'note still editable');
  assert.deepEqual(register(setup(), 'reviewer').error, { code: 'FORBIDDEN' });
});

test('draft.save: engine rules surface as safe error codes; idempotent replay creates no extra revision', () => {
  const s = setup(); const { id } = modelAll(s);
  const sys = s.call('draft.save', { record: { type: 'Claim', workflowState: 'APPROVED' } });
  assert.deepEqual(sys.error, { code: 'INVALID_INPUT', field: 'workflowState', details: { field: 'workflowState' } });
  assert.equal(s.call('draft.save', { record: { type: 'ReviewSnapshot' } }).error.code, 'INVALID_INPUT');
  const cl = s.call('draft.get', { id: id.Cl }).data.record;
  const body = { type: 'Claim', claimFrameRef: cl.claimFrameRef, evidenceRefs: cl.evidenceRefs, epistemicStatus: 'PROPOSED' };
  const stale = s.call('draft.save', { id: id.Cl, expectedRevision: 5, record: body });
  assert.equal(stale.error.code, 'REVISION_CONFLICT'); assert.equal(stale.error.details.currentRevision, 1);
  const a = s.call('draft.save', { id: id.Cl, expectedRevision: 1, record: body }, 'owner', 'same-key-0001');
  const b = s.call('draft.save', { id: id.Cl, expectedRevision: 1, record: body }, 'owner', 'same-key-0001');
  assert.equal(a.data.revision, 2); assert.equal(b.replayed, true); assert.deepEqual(s.call('draft.get', { id: id.Cl }).data.revisions, [1, 2]);
  for (const bad of [{ record: [] }, { record: {}, id: 'nope' }, { record: {}, expectedRevision: 1 }, { record: {}, sourceRefs: [{ id: 'x' }] }, { record: {}, extra: 1 }]) {
    assert.equal(s.call('draft.save', bad).error.code, 'INVALID_INPUT', JSON.stringify(bad));
  }
  assert.equal(s.call('draft.get', { id: '019a1b2c-3d4e-7f00-8abc-000000000000' }).error.code, 'NOT_FOUND');
});

test('validation failures: issues returned as data; review request refused with VALIDATION_FAILED codes', () => {
  const s = setup(); const { id, targets } = modelAll(s);
  s.call('draft.save', { record: { type: 'Claim', claimFrameRef: { id: id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [], epistemicStatus: 'PROPOSED' } });
  const v = s.call('draft.validate');
  assert.equal(v.ok, true); assert.equal(v.data.valid, false);
  assert.ok(v.data.issues.every((i) => typeof i.code === 'string' && !('value' in i)));
  const rq = s.call('review.request', { targetIds: targets, protocolId: id.P });
  assert.equal(rq.error.code, 'VALIDATION_FAILED'); assert.ok(rq.error.details.codes.includes('MISSING_EVIDENCE'));
  assert.ok(s.audit.some((a) => a.action === 'api:review.request' && a.outcome === 'FAILED' && a.code === 'VALIDATION_FAILED'));
});

test('review.decide input: reason keys/length, decision enum; browser cannot assert reviewer identity', () => {
  const s = setup(); const { id, targets } = modelAll(s); s.call('draft.validate');
  const rq = s.call('review.request', { targetIds: targets, protocolId: id.P }).data.requestId;
  const bad = [
    { requestId: rq, decision: 'APPROVE', reason: { th: 'x', html: '<b>' } }, { requestId: rq, decision: 'APPROVE', reason: { th: '   ' } },
    { requestId: rq, decision: 'APPROVE', reason: { th: 'x'.repeat(2001) } }, { requestId: rq, decision: 'AUTO_APPROVE', reason: { th: 'x' } },
    { requestId: rq, decision: 'APPROVE', reason: { th: 'x' }, reviewerId: 'human:someone-else' },
  ];
  for (const b of bad) assert.equal(s.call('review.decide', b).error.code, 'INVALID_INPUT', JSON.stringify(b));
  assert.equal(s.call('review.list').data.items[0].status, 'OPEN');
});

test('unexpected engine/store failure → INTERNAL without leaking messages', () => {
  const s = setup(); s.deps.store.latestDrafts = () => { throw new Error('secret path /drive/xyz'); };
  const r = s.call('draft.list');
  assert.deepEqual(r.error, { code: 'INTERNAL' }); assert.ok(!JSON.stringify(r).includes('secret'));
});

test('role table: decisions are REVIEWER-only, writes CONTRIBUTOR-only, all writes are idempotent mutations', () => {
  const A = plain(API.ACTIONS);
  assert.deepEqual(A['review.decide'], { roles: ['REVIEWER'], mutation: true });
  for (const a of ['intake.update', 'source.register', 'source.extracted', 'draft.save', 'draft.validate', 'review.request']) assert.deepEqual(A[a], { roles: ['CONTRIBUTOR'], mutation: true }, a);
  for (const a of ['intake.list', 'draft.list', 'draft.get', 'review.list']) assert.equal(A[a].mutation, false, a);
});

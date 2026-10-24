// P2-WP1 / GT-07: derivation lineage traceability + dependency staleness after a new revision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as k from '../src/index.js';
import { seed, codeOf, C, RV, PUB } from './helpers.js';

const K = (v) => ({ state: 'KNOWN', value: v });
const ref = (id, type, revision = 1) => ({ id, type, revision });
// helper: revise → validate → review-ready → approve → commit (returns review result or error code)
function cycle(s, items, keyName) {
  for (const it of items) if (it.save) k.saveDraft(s.root, { actorId: C, now: s.now, ...it.save });
  k.validateDrafts(s.root, { actorId: C, ids: items.map((i) => i.id), now: s.now });
  const req = k.markReviewReady(s.root, { actorId: C, targetIds: items.map((i) => i.id), protocolId: s.id.P, now: s.now });
  const rv = k.review(s.root, { actorId: RV, requestId: req.requestId, decision: 'APPROVE', reason: { th: 'ตรวจแล้ว' }, now: s.now });
  return k.commit(s.root, { actorId: PUB, snapshotId: rv.snapshotId, idempotencyKey: keyName, now: s.now });
}
const claimBody = (s, evRev) => ({ type: 'Claim', claimFrameRef: ref(s.id.CF, 'ClaimFrame'), evidenceRefs: [ref(s.id.E, 'Evidence', evRev), ref(s.id.ER, 'Evidence')], epistemicStatus: 'PROPOSED' });
const evidenceBody = (s) => ({ type: 'Evidence', sourceAssetRef: ref(s.sa.id, 'SourceAsset'), reportRef: ref(s.id.R, 'Report'), locator: { kind: 'page', value: '3' }, studyRefs: [ref(s.id.S, 'Study')], originalExcerpt: K('ผลผลิตเพิ่มขึ้นร้อยละ 11.8 (แก้ไขข้อมูลสมมติ)'), accessClassification: 'PUBLIC' });

test('GT-07: new Evidence revision marks dependents stale; citing the superseded revision is blocked', () => {
  const s = seed('published');
  assert.equal(k.staleDependents(s.root).items.length, 0);
  cycle(s, [{ id: s.id.E, save: { id: s.id.E, expectedRevision: 1, record: evidenceBody(s) } }], 'commit-ev-rev2');
  k.buildReadModel(s.root, { actorId: PUB, now: s.now });

  const stale = new Map(k.staleDependents(s.root).items.map((i) => [i.id, i]));
  for (const id of [s.id.Cl, s.id.F, s.id.X]) assert.equal(stale.get(id).reason, 'REF_SUPERSEDED');
  assert.ok(stale.get(s.id.Cl).via.includes(`${s.id.E}@1`));
  assert.equal(stale.get(s.id.AR).reason, 'DEPENDS_ON_STALE'); // AnalysisRun → stale Result
  assert.equal(stale.has(s.id.E), false); assert.equal(stale.has(s.id.S), false);
  const claim = k.search(s.root, { query: 'ปุ๋ยสูตร A' }).items.find((i) => i.type === 'Claim');
  assert.equal(claim.dependencyStale, true);
  assert.equal(k.trace(s.root, { id: s.id.Cl }).dependencyStale, true);

  // a new Claim revision that still cites Evidence@1 cannot be approved
  k.saveDraft(s.root, { actorId: C, id: s.id.Cl, expectedRevision: 1, record: claimBody(s, 1), now: s.now });
  k.validateDrafts(s.root, { actorId: C, ids: [s.id.Cl], now: s.now });
  const req = k.markReviewReady(s.root, { actorId: C, targetIds: [s.id.Cl], protocolId: s.id.P, now: s.now });
  assert.equal(codeOf(() => k.review(s.root, { actorId: RV, requestId: req.requestId, decision: 'APPROVE', reason: { th: 'x' }, now: s.now })), 'STALE_REFERENCE');

  // re-modeled on Evidence@2 → approvable; Claim no longer stale after rebuild, Finding still is
  cycle(s, [{ id: s.id.Cl, save: { id: s.id.Cl, expectedRevision: 2, record: claimBody(s, 2) } }], 'commit-claim-rev3');
  k.buildReadModel(s.root, { actorId: PUB, now: s.now });
  const after = new Set(k.staleDependents(s.root).items.map((i) => i.id));
  assert.equal(after.has(s.id.Cl), false); assert.equal(after.has(s.id.F), true);
});

test('GT-07: derivation output stays traceable to the input revision used, and becomes stale when input changes', () => {
  const s = seed('published');
  const DR = k.newId(s.now); const F2 = k.newId(s.now);
  const xRecord = k.search(s.root, { query: 'yield-change' }).items[0];
  assert.equal(xRecord.id, s.id.X);
  const inputDigest = crypto.createHash('sha256').update(`${s.id.X}@1`).digest('hex');
  cycle(s, [
    { id: F2, save: { id: F2, derivationRunRef: ref(DR, 'DerivationRun'), record: { type: 'Finding', resultRefs: [ref(s.id.X, 'Result')], explanation: { th: 'ข้อค้นพบจากการคำนวณซ้ำแบบกฎ', en: 'Rule-based recomputed finding' }, context: K('ฤดูนาปี 2568'), evidenceRefs: [ref(s.id.E, 'Evidence')] } } },
    { id: DR, save: { id: DR, record: { type: 'DerivationRun', engine: 'manual-rules', engineVersion: '1', ruleSet: 'yield-recompute', ruleVersion: '1', softwareVersion: 'p2-wp1', inputSnapshot: { algorithm: 'sha256', digest: inputDigest }, parameters: { rounding: 1 }, inputRefs: [ref(s.id.X, 'Result')], outputRefs: [ref(F2, 'Finding')], outcome: 'SUCCEEDED' } } },
  ], 'commit-derivation');
  k.buildReadModel(s.root, { actorId: PUB, now: s.now });
  let t = k.trace(s.root, { id: F2 });
  assert.deepEqual(t.derivation.inputRefs, [ref(s.id.X, 'Result', 1)]);
  assert.equal(t.derivation.ruleSet, 'yield-recompute'); assert.equal(t.derivation.parameters, undefined);
  assert.equal(t.dependencyStale, false);

  cycle(s, [{ id: s.id.X, save: { id: s.id.X, expectedRevision: 1, record: { type: 'Result', analysisRunRef: ref(s.id.AR, 'AnalysisRun'), measure: 'yield-change', value: K(13), unit: K('percent'), context: K('ฤดูนาปี 2568'), evidenceRefs: [ref(s.id.E, 'Evidence')] } } }], 'commit-result-rev2');
  k.buildReadModel(s.root, { actorId: PUB, now: s.now });
  const stale = new Map(k.staleDependents(s.root).items.map((i) => [i.id, i]));
  assert.equal(stale.get(DR).reason, 'REF_SUPERSEDED');
  assert.ok(stale.get(F2)); // cites Result@1 and is an output of a stale run
  t = k.trace(s.root, { id: F2 });
  assert.equal(t.dependencyStale, true);
  assert.equal(t.derivation.inputRefs[0].revision, 1, 'output remains traceable to the old input revision');
});

test('commit re-checks staleness: approval granted before a conflicting commit cannot land', () => {
  const s = seed('published');
  // approve Claim rev2 citing Evidence@1 while Evidence@1 is still latest
  k.saveDraft(s.root, { actorId: C, id: s.id.Cl, expectedRevision: 1, record: { ...claimBody(s, 1), epistemicStatus: 'P2' }, now: s.now });
  k.validateDrafts(s.root, { actorId: C, ids: [s.id.Cl], now: s.now });
  const req = k.markReviewReady(s.root, { actorId: C, targetIds: [s.id.Cl], protocolId: s.id.P, now: s.now });
  const rv = k.review(s.root, { actorId: RV, requestId: req.requestId, decision: 'APPROVE', reason: { th: 'ok' }, now: s.now });
  // meanwhile Evidence@2 is committed
  cycle(s, [{ id: s.id.E, save: { id: s.id.E, expectedRevision: 1, record: evidenceBody(s) } }], 'commit-ev-race');
  assert.equal(codeOf(() => k.commit(s.root, { actorId: PUB, snapshotId: rv.snapshotId, idempotencyKey: 'commit-claim-race', now: s.now })), 'STALE_REFERENCE');
});

test('computeStale: a DerivationRun output that does not cite its inputs still inherits staleness from the run', () => {
  const r = (id, revision, extra = {}) => ({ id, type: extra.type || 'Result', revision, ...extra });
  const recs = [
    r('x', 1), r('x', 2),
    r('run', 1, { type: 'DerivationRun', inputRefs: [ref('x', 'Result', 1)], outputRefs: [ref('out', 'Finding', 1)] }),
    r('out', 1, { type: 'Finding' }), r('other', 1, { type: 'Finding' }),
  ];
  const stale = new Map(k.computeStale(recs).map((s) => [s.id, s]));
  assert.equal(stale.get('run').reason, 'REF_SUPERSEDED');
  assert.deepEqual(stale.get('out'), { id: 'out', type: 'Finding', revision: 1, reason: 'DEPENDS_ON_STALE', via: ['run@1'] });
  assert.equal(stale.has('other'), false); assert.equal(stale.has('x'), false);
});

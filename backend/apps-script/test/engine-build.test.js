// P2-WP6: the generated Apps Script engine (Engine.js) must be (1) up to date with its sources, (2) runnable with no
// Node APIs, (3) result-identical to the Node validator on every golden case, and (4) enforce the same workflow rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildAppsScriptEngine } from '../../../scripts/build-apps-script.mjs';
import { parseRecordText, validateRecordSet } from '../../../validator/src/index.js';
import { sliceDrafts, DRAFT_KEYS } from '../../../core/test/helpers.js';
import { loadScripts, readScript, plain, memStore, testClock, codeOf } from './helpers.js';

const E = loadScripts('Engine.js').KEKB_ENGINE;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const HUMAN = { id: 'human:krit', kind: 'human', roles: ['CONTRIBUTOR', 'REVIEWER', 'ADMIN'] };
const CONTRIB = { id: 'human:c1', kind: 'human', roles: ['CONTRIBUTOR'] };

test('Engine.js is byte-identical to a fresh build (no hand edits, deterministic)', async () => {
  assert.equal(readScript('Engine.js'), await buildAppsScriptEngine(), 'run: npm run build:apps-script');
});

test('Engine.js runs without Node/Apps Script globals and never compiles code at runtime', () => {
  const src = readScript('Engine.js');
  assert.ok(!/\bnew Function\b|\beval\s*\(/.test(src), 'no runtime code generation');
  assert.ok(!/\bprocess\.env\b|\bUrlFetchApp\b|\bDriveApp\b|\bSpreadsheetApp\b/.test(src), 'engine is storage/network free');
  assert.equal(typeof E.createEngine, 'function');
  assert.deepEqual(plain(E.SUPPORTED_VERSIONS), ['v1.0-RC1', 'v1.0-RC2']);
});

const ROOT = new URL('../../../fixtures/golden/records/', import.meta.url);
const cases = [
  ...JSON.parse(fs.readFileSync(new URL('cases.json', ROOT), 'utf8')).cases,
  ...JSON.parse(fs.readFileSync(new URL('phase2-cases.json', ROOT), 'utf8')).cases,
];
test(`parity: bundled validator == Node validator on all ${cases.length} golden cases`, () => {
  let issues = 0;
  for (const c of cases) {
    const abs = new URL(`${c.dir}/`, ROOT); const records = []; const preIssues = [];
    for (const f of fs.readdirSync(abs).sort()) {
      const r = parseRecordText(fs.readFileSync(new URL(f, abs)), `${c.dir}/${f}`); records.push(r.record); preIssues.push(...r.issues);
    }
    const node = plain(validateRecordSet(plain(records), { preIssues: plain(preIssues) }));
    const gas = plain(E.validateRecordSet(plain(records), { preIssues: plain(preIssues) }));
    assert.deepEqual(gas, node, `${c.id} ${c.variant}`);
    issues += node.issues.length;
  }
  assert.ok(issues > 0, 'parity must cover failing cases too');
});

function flow(actorFor = () => HUMAN) {
  const m = memStore(); const clk = testClock();
  const eng = E.createEngine({ store: m.store, now: clk.now, newId: clk.newId, sha256 });
  const digest = sha256('synthetic source bytes');
  const sa = eng.registerSource(actorFor('register'), {
    digest, storageRef: 'drive:synthetic', sourceKind: 'application/pdf', sourceVersion: '2026-10-25T00:00:00.000Z',
    originalLanguage: 'th', accessClassification: 'PUBLIC', locatorCapabilities: ['page', 'paragraph'],
  });
  eng.completeExtraction(actorFor('extract'), { sourceId: sa.id });
  const id = Object.fromEntries(DRAFT_KEYS.map((n) => [n, clk.newId()]));
  const SA = { id: sa.id, type: 'SourceAsset', revision: 1 };
  for (const [i, rec] of sliceDrafts(id, SA)) eng.saveDraft(actorFor('draft'), { id: i, record: rec, sourceRefs: [SA] });
  return { m, eng, id, sa, SA, targets: [sa.id, ...Object.values(id)] };
}

test('bundled engine: register → drafts → validate → review-ready → self-review is allowed but flagged (OD-08)', () => {
  const { m, eng, id, targets } = flow();
  assert.equal(eng.registerSource(HUMAN, { digest: sha256('synthetic source bytes'), storageRef: 'drive:other', sourceKind: 'x', sourceVersion: '2026-10-25T00:00:00.000Z', originalLanguage: 'th', accessClassification: 'PUBLIC', locatorCapabilities: ['page'] }).reused, true);
  const v = plain(eng.validateDrafts(HUMAN));
  assert.equal(v.valid, true, JSON.stringify(v.issues)); assert.equal(v.validated.length, 11);
  const { requestId } = eng.markReviewReady(HUMAN, { targetIds: targets, protocolId: id.P });
  const r = plain(eng.review(HUMAN, { requestId, decision: 'APPROVE', reason: { th: 'ตรวจหลักฐานแล้ว' } }));
  assert.equal(r.decision, 'APPROVE'); assert.equal(r.validationResult, 'PASS'); assert.equal(r.selfReview, true);
  assert.equal(m.reviews.get(requestId).status, 'CLOSED'); assert.equal(m.reviews.get(requestId).selfReview, true);
  assert.ok(m.audit.some((a) => a.action === 'review:APPROVE' && a.code === 'SELF_REVIEW'));
  for (const t of targets) assert.equal(m.store.getDraft(t).workflowState, 'APPROVED');
  // the ReviewSnapshot itself is a valid record in the working set
  assert.equal(E.validateRecordSet(eng.workingSet()).valid, true);
});

test('bundled engine: different reviewer → no self-review flag', () => {
  const RV = { id: 'human:r1', kind: 'human', roles: ['REVIEWER'] };
  const { eng, id, targets, m } = flow(() => CONTRIB);
  eng.validateDrafts(CONTRIB);
  const { requestId } = eng.markReviewReady(CONTRIB, { targetIds: targets, protocolId: id.P });
  assert.equal(eng.review(RV, { requestId, decision: 'NEEDS_REVISION', reason: { th: 'แก้ locator' } }).selfReview, false);
  assert.ok(!m.audit.some((a) => a.code === 'SELF_REVIEW'));
});

test('bundled engine: authority, envelope and revision rules', () => {
  const { eng, id, targets } = flow();
  // contributor-only actor cannot review; AI/service kinds never gain authority from roles
  eng.validateDrafts(HUMAN);
  const { requestId } = eng.markReviewReady(HUMAN, { targetIds: targets, protocolId: id.P });
  const dec = (actor) => () => eng.review(actor, { requestId, decision: 'APPROVE', reason: { th: 'x' } });
  assert.equal(codeOf(dec(CONTRIB)), 'FORBIDDEN');
  assert.equal(codeOf(dec({ id: 'ai:x', kind: 'ai', roles: ['REVIEWER'] })), 'FORBIDDEN');
  assert.equal(codeOf(dec({ id: 'service:x', kind: 'service', roles: ['REVIEWER'] })), 'FORBIDDEN');
  assert.equal(codeOf(() => eng.review(HUMAN, { requestId, decision: 'MAYBE', reason: { th: 'x' } })), 'INVALID_INPUT');
  assert.equal(codeOf(() => eng.review(HUMAN, { requestId, decision: 'APPROVE', reason: {} })), 'INVALID_INPUT');
  // client-supplied envelope/authority fields and forbidden types
  for (const f of ['workflowState', 'createdBy', 'provenance', 'revision']) {
    assert.equal(codeOf(() => eng.saveDraft(HUMAN, { record: { type: 'Claim', [f]: 'x' } })), 'INVALID_INPUT', f);
  }
  assert.equal(codeOf(() => eng.saveDraft(HUMAN, { record: { type: 'ReviewSnapshot' } })), 'INVALID_INPUT');
  assert.equal(codeOf(() => eng.saveDraft(HUMAN, { record: { type: 'SourceAsset' } })), 'INVALID_INPUT');
  // stale expectedRevision
  assert.equal(codeOf(() => eng.saveDraft(HUMAN, { id: id.Cl, expectedRevision: 2, record: { type: 'Claim' } })), 'REVISION_CONFLICT');
});

test('bundled engine: editing a pinned target after review-ready blocks the decision (REVISION_CONFLICT)', () => {
  const { eng, id, targets } = flow();
  eng.validateDrafts(HUMAN);
  const { requestId } = eng.markReviewReady(HUMAN, { targetIds: targets, protocolId: id.P });
  const cl = eng.workingSet().find((r) => r.id === id.Cl);
  const { type, claimFrameRef, evidenceRefs } = cl;
  eng.saveDraft(HUMAN, { id: id.Cl, expectedRevision: 1, record: { type, claimFrameRef, evidenceRefs, epistemicStatus: 'PROPOSED' } });
  assert.equal(codeOf(() => eng.review(HUMAN, { requestId, decision: 'APPROVE', reason: { th: 'x' } })), 'REVISION_CONFLICT');
});

test('bundled engine: invalid drafts stay EXTRACTED with stable issue codes; review-ready refuses', () => {
  const { eng, id, targets, m } = flow();
  eng.saveDraft(HUMAN, { record: { type: 'Claim', claimFrameRef: { id: id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [], epistemicStatus: 'PROPOSED' } });
  const v = plain(eng.validateDrafts(HUMAN));
  assert.equal(v.valid, false); assert.ok(v.issues.some((i) => i.code === 'MISSING_EVIDENCE'));
  assert.ok(v.failed.length >= 1);
  const bad = v.failed[0];
  assert.equal(m.store.getDraft(bad).workflowState, 'EXTRACTED');
  assert.equal(codeOf(() => eng.markReviewReady(HUMAN, { targetIds: targets, protocolId: id.P })), 'VALIDATION_FAILED');
});

test('bundled engine: same-revision tampering of a pinned draft (e.g. a hand-edited Drive file) blocks the decision', () => {
  const { eng, id, targets, m } = flow();
  eng.validateDrafts(HUMAN);
  const { requestId } = eng.markReviewReady(HUMAN, { targetIds: targets, protocolId: id.P });
  const k = `${id.Cl}@1`; const rec = m.drafts.get(k);
  m.drafts.set(k, { ...rec, epistemicStatus: 'SUPPORTED' }); // same id, same revision, different content
  assert.equal(codeOf(() => eng.review(HUMAN, { requestId, decision: 'APPROVE', reason: { th: 'x' } })), 'REVISION_CONFLICT');
});

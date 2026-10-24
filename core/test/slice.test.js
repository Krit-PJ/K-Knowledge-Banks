// P1-WP3: GT-12 No-AI vertical slice + human-authority / revision / publication negative cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import * as k from '../src/index.js';
import { seed, codeOf, readAllFiles, C, RV, AI, PUB, SOURCE_TEXT } from './helpers.js';

const readCanonical = (root) => JSON.parse(fs.readFileSync(path.join(root, 'canonical', 'manifest.json'), 'utf8'));

test('GT-12: manual intake → validate → human review → commit → read model → Thai search + evidence trace (AI off)', () => {
  const s = seed('published');
  console.log(`GT-12 run log: ${JSON.stringify(s.log.map((l) => ({ step: l.step, ...(l.valid !== undefined ? { valid: l.valid, validated: l.validated.length } : {}), ...(l.decision ? { decision: l.decision, validationResult: l.validationResult } : {}), ...(l.canonicalRevision !== undefined ? { canonicalRevision: l.canonicalRevision } : {}), ...(l.readModelId ? { readModelId: l.readModelId, counts: l.counts } : {}) })))}`);
  assert.equal(s.log.find((l) => l.step === 'validate').valid, true);
  assert.equal(s.review.decision, 'APPROVE'); assert.equal(s.review.validationResult, 'PASS');
  assert.equal(s.commit.canonicalRevision, 1);
  const m = readCanonical(s.root);
  assert.equal(m.records.length, 12); // 11 approved records + ReviewSnapshot
  for (const key of m.records) assert.equal(JSON.parse(fs.readFileSync(path.join(s.root, 'canonical', 'records', `${key}.json`), 'utf8')).workflowState, 'COMMITTED');

  const r = k.search(s.root, { query: 'ปุ๋ยสูตร A' });
  assert.equal(r.stale, false); assert.equal(r.canonicalRevision, 1); assert.equal(r.readModelRevision, 1);
  assert.deepEqual(r.items.map((i) => i.type).sort(), ['Claim', 'Finding']);
  const t = k.trace(s.root, { id: s.id.Cl });
  assert.equal(t.evidence.length, 2);
  const pub = t.evidence.find((e) => e.evidence.accessClassification === 'PUBLIC');
  assert.deepEqual(pub.evidence.locator, { kind: 'page', value: '3' });
  assert.equal(pub.sourceAsset.sourceVersion, 'v1');
  assert.equal(pub.sourceAsset.hash.digest, crypto.createHash('sha256').update(SOURCE_TEXT).digest('hex'));
  assert.ok(pub.evidence.excerpt.includes('ร้อยละ 12'));

  // lifecycle order for the source asset, from the audit log (no state skipped)
  const audit = fs.readFileSync(path.join(s.root, 'workflow', 'audit.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const saStates = audit.filter((a) => a.target === `${s.sa.id}@1` && a.action.startsWith('state:')).map((a) => a.action.slice(6));
  assert.deepEqual(saStates, ['RECEIVED', 'REGISTERED', 'EXTRACTED', 'VALIDATED', 'REVIEW_READY', 'APPROVED']);
  assert.ok(audit.some((a) => a.action === 'commit') && audit.some((a) => a.action === 'publish'));
  assert.ok(!audit.some((a) => a.actor.startsWith('ai:')), 'no AI actor in the run');
});

test('public allowlist: RESTRICTED excerpt and storageRef never reach read models', () => {
  const s = seed('published');
  const all = readAllFiles(path.join(s.root, 'read-models'));
  assert.ok(!all.includes('RESTRICTED-MARKER')); assert.ok(!all.includes('local:sources/'));
  const restricted = k.trace(s.root, { id: s.id.Cl }).evidence.find((e) => e.evidence.accessClassification === 'RESTRICTED');
  assert.equal(restricted.evidence.excerpt, undefined);
  assert.equal(k.search(s.root, { query: 'RESTRICTED-MARKER' }).items.length, 0);
});

test('human authority: CONTRIBUTOR, AI (even with REVIEWER role) and unknown actors cannot review', () => {
  const s = seed('review-ready');
  const args = (actorId) => ({ actorId, requestId: s.request.requestId, decision: 'APPROVE', reason: { th: 'x' } });
  assert.equal(codeOf(() => k.review(s.root, args(C))), 'FORBIDDEN');
  assert.equal(codeOf(() => k.review(s.root, args(AI))), 'FORBIDDEN');
  assert.equal(codeOf(() => k.review(s.root, args('human:nobody'))), 'UNAUTHENTICATED');
  assert.equal(codeOf(() => k.review(s.root, args(RV))), 'NO_ERROR');
});

test('services only: humans cannot commit or publish; reviewer cannot commit', () => {
  const s = seed('approved');
  assert.equal(codeOf(() => k.commit(s.root, { actorId: C, snapshotId: s.review.snapshotId, idempotencyKey: 'k-human-0001' })), 'FORBIDDEN');
  assert.equal(codeOf(() => k.commit(s.root, { actorId: RV, snapshotId: s.review.snapshotId, idempotencyKey: 'k-human-0002' })), 'FORBIDDEN');
  assert.equal(codeOf(() => k.buildReadModel(s.root, { actorId: AI })), 'FORBIDDEN');
});

test('no state skipping: review-ready before validation, re-validation of committed draft', () => {
  const s = seed('drafts');
  assert.equal(codeOf(() => k.markReviewReady(s.root, { actorId: C, targetIds: s.targets, protocolId: s.id.P })), 'INVALID_TRANSITION');
  const p = seed('published');
  assert.equal(codeOf(() => k.validateDrafts(p.root, { actorId: C, ids: [p.id.Cl] })), 'INVALID_TRANSITION');
});

test('commit requires an APPROVE snapshot (NEEDS_REVISION is not approval)', () => {
  const s = seed('approved', 'NEEDS_REVISION');
  assert.equal(codeOf(() => k.commit(s.root, { actorId: PUB, snapshotId: s.review.snapshotId, idempotencyKey: 'k-needs-rev-01' })), 'APPROVAL_REQUIRED');
  assert.equal(readCanonical(s.root).canonicalRevision, 0);
});

test('edit after approval invalidates commit (revision pinned); stale expectedRevision rejected', () => {
  const s = seed('approved');
  assert.equal(codeOf(() => k.saveDraft(s.root, { actorId: C, id: s.id.Cl, expectedRevision: 2, record: { type: 'Claim', claimFrameRef: { id: s.id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [{ id: s.id.E, type: 'Evidence', revision: 1 }], epistemicStatus: 'X' } })), 'REVISION_CONFLICT');
  k.saveDraft(s.root, { actorId: C, id: s.id.Cl, expectedRevision: 1, record: { type: 'Claim', claimFrameRef: { id: s.id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [{ id: s.id.E, type: 'Evidence', revision: 1 }], epistemicStatus: 'EDITED-AFTER-APPROVAL' } });
  assert.equal(codeOf(() => k.commit(s.root, { actorId: PUB, snapshotId: s.review.snapshotId, idempotencyKey: 'k-edited-0001' })), 'REVISION_CONFLICT');
  assert.equal(readCanonical(s.root).canonicalRevision, 0);
});

test('idempotent commit: same key replays, different payload conflicts, no duplicate canonical revision', () => {
  const s = seed('committed');
  const again = k.commit(s.root, { actorId: PUB, snapshotId: s.review.snapshotId, idempotencyKey: 'commit-key-0001' });
  assert.equal(again.replayed, true); assert.equal(again.canonicalRevision, 1);
  assert.equal(codeOf(() => k.commit(s.root, { actorId: PUB, snapshotId: s.id.P, idempotencyKey: 'commit-key-0001' })), 'IDEMPOTENCY_CONFLICT');
  assert.equal(codeOf(() => k.commit(s.root, { actorId: PUB, snapshotId: s.review.snapshotId, idempotencyKey: 'commit-key-0002' })), 'APPROVAL_REQUIRED');
  assert.equal(readCanonical(s.root).canonicalRevision, 1);
});

test('client cannot supply authority/envelope fields or create ReviewSnapshot/SourceAsset drafts', () => {
  const s = seed('drafts');
  const base = { type: 'Claim', claimFrameRef: { id: s.id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [{ id: s.id.E, type: 'Evidence', revision: 1 }], epistemicStatus: 'P' };
  for (const extra of [{ workflowState: 'APPROVED' }, { createdBy: 'human:reviewer-1' }, { revision: 9 }, { provenance: {} }]) {
    assert.equal(codeOf(() => k.saveDraft(s.root, { actorId: C, record: { ...base, ...extra } })), 'INVALID_INPUT');
  }
  assert.equal(codeOf(() => k.saveDraft(s.root, { actorId: C, record: { type: 'ReviewSnapshot', decision: 'APPROVE' } })), 'INVALID_INPUT');
  assert.equal(codeOf(() => k.saveDraft(s.root, { actorId: AI, record: base })), 'FORBIDDEN');
});

test('stale flag + last-known-good: failed rebuild keeps previous read model active', () => {
  const s = seed('published');
  k.saveDraft(s.root, { actorId: C, id: s.id.Cl, expectedRevision: 1, now: s.now, record: { type: 'Claim', claimFrameRef: { id: s.id.CF, type: 'ClaimFrame', revision: 1 }, evidenceRefs: [{ id: s.id.E, type: 'Evidence', revision: 1 }], epistemicStatus: 'REVISED' } });
  k.validateDrafts(s.root, { actorId: C, ids: [s.id.Cl], now: s.now });
  const req = k.markReviewReady(s.root, { actorId: C, targetIds: [s.id.Cl], protocolId: s.id.P, now: s.now });
  const rv = k.review(s.root, { actorId: RV, requestId: req.requestId, decision: 'APPROVE', reason: { th: 'ตรวจ revision 2' }, now: s.now });
  assert.equal(k.commit(s.root, { actorId: PUB, snapshotId: rv.snapshotId, idempotencyKey: 'commit-key-rev2', now: s.now }).canonicalRevision, 2);

  let r = k.search(s.root, { query: 'ปุ๋ยสูตร A' });
  assert.equal(r.stale, true); assert.equal(r.readModelRevision, 1);
  assert.equal(r.items.find((i) => i.type === 'Claim').revision, 1);
  assert.equal(codeOf(() => k.buildReadModel(s.root, { actorId: PUB, now: s.now, faultInject: 'beforeActivate' })), 'READ_MODEL_INCOMPLETE');
  r = k.search(s.root, { query: 'ปุ๋ยสูตร A' });
  assert.equal(r.stale, true); assert.equal(r.readModelRevision, 1, 'last-known-good still active');
  k.buildReadModel(s.root, { actorId: PUB, now: s.now });
  r = k.search(s.root, { query: 'ปุ๋ยสูตร A' });
  assert.equal(r.stale, false); assert.equal(r.readModelRevision, 2);
  assert.equal(r.items.find((i) => i.type === 'Claim').revision, 2);
});

test('AI-independent core: no network, process or AI-provider imports in core/ or validator/', () => {
  const root = new URL('../../', import.meta.url);
  const forbidden = /from\s+['"](node:)?(http|https|http2|net|tls|dns|dgram|child_process|worker_threads)['"]|\bfetch\s*\(|openai|anthropic|gemini|\bllm\b/i;
  for (const dir of ['core/src', 'validator/src', 'core/bin', 'validator/bin']) {
    const abs = new URL(`${dir}/`, root);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) assert.ok(!forbidden.test(fs.readFileSync(new URL(f, abs), 'utf8')), `${dir}/${f}`);
  }
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as k from '../src/index.js';

export const ACTORS = [
  { id: 'human:contributor-1', kind: 'human', roles: ['CONTRIBUTOR'] },
  { id: 'human:reviewer-1', kind: 'human', roles: ['REVIEWER'] },
  { id: 'ai:assistant', kind: 'ai', roles: ['REVIEWER', 'CONTRIBUTOR'] }, // must still have no authority
  { id: 'service:publisher', kind: 'service', roles: [], permissions: ['commit', 'publish'] },
];
export const C = 'human:contributor-1'; export const RV = 'human:reviewer-1'; export const AI = 'ai:assistant'; export const PUB = 'service:publisher';
export const SOURCE_TEXT = 'รายงานการทดลองสมมติ: ปุ๋ยสูตร A กับผลผลิตข้าว (synthetic fixture, no real data)\n';
const K = (v) => ({ state: 'KNOWN', value: v });
const r1 = (id, type) => ({ id, type, revision: 1 });

export function clock(start = Date.parse('2026-10-24T00:00:00.000Z')) { let t = start; return () => new Date(t++).toISOString(); }
export function tmpStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kekb-slice-'));
  const src = path.join(root, 'input-source.txt'); fs.writeFileSync(src, SOURCE_TEXT);
  return { root: path.join(root, 'store'), src };
}

/** Runs the manual slice; `until` stops early: 'drafts' | 'validated' | 'review-ready' | 'approved' | 'committed' | 'published'. */
export function seed(until = 'published', decision = 'APPROVE') {
  const { root, src } = tmpStore(); const now = clock(); const log = [];
  const step = (name, out) => { log.push({ step: name, ...(out && typeof out === 'object' ? out : {}) }); return out; };
  k.initStore(root, { actors: ACTORS });
  const sa = step('intake', k.intakeSource(root, { actorId: C, filePath: src, sourceKind: 'synthetic-field-report', sourceVersion: 'v1', originalLanguage: 'th', accessClassification: 'PUBLIC', locatorCapabilities: ['page', 'paragraph'], now }));
  k.completeExtraction(root, { actorId: C, sourceId: sa.id, now });
  const id = Object.fromEntries(DRAFT_KEYS.map((n) => [n, k.newId(now)]));
  const SA = r1(sa.id, 'SourceAsset');
  const drafts = sliceDrafts(id, SA);
  for (const [i, rec] of drafts) k.saveDraft(root, { actorId: C, id: i, record: rec, sourceRefs: [SA], now });
  step('drafts', { count: drafts.length });
  const ctx = { root, src, now, id, sa, log, targets: [sa.id, ...Object.values(id)] };
  if (until === 'drafts') return ctx;
  step('validate', k.validateDrafts(root, { actorId: C, now }));
  if (until === 'validated') return ctx;
  ctx.request = step('review-ready', k.markReviewReady(root, { actorId: C, targetIds: ctx.targets, protocolId: id.P, now }));
  if (until === 'review-ready') return ctx;
  ctx.review = step('review', k.review(root, { actorId: RV, requestId: ctx.request.requestId, decision, reason: { th: 'ตรวจสอบหลักฐานแล้ว' }, now }));
  if (until === 'approved') return ctx;
  ctx.commit = step('commit', k.commit(root, { actorId: PUB, snapshotId: ctx.review.snapshotId, idempotencyKey: 'commit-key-0001', now }));
  if (until === 'committed') return ctx;
  ctx.readModel = step('publish', k.buildReadModel(root, { actorId: PUB, now }));
  return ctx;
}

export const DRAFT_KEYS = ['S', 'R', 'E', 'ER', 'AR', 'X', 'F', 'CF', 'Cl', 'P'];
/** The synthetic slice records (no AI, no real data). id: {S,R,E,ER,AR,X,F,CF,Cl,P} → UUID v7; SA: SourceAsset ref. */
export function sliceDrafts(id, SA) {
  return [
    [id.S, { type: 'Study', design: K('field-trial'), context: K('แปลงนาสมมติ จ.นครสวรรค์'), reportRefs: [r1(id.R, 'Report')], dependencyKeys: ['cohort:synthetic-plots-2025'] }],
    [id.R, { type: 'Report', sourceAssetRef: SA, studyRefs: [r1(id.S, 'Study')], reportLanguage: 'th', reportVersion: 'v1' }],
    [id.E, { type: 'Evidence', sourceAssetRef: SA, reportRef: r1(id.R, 'Report'), locator: { kind: 'page', value: '3' }, studyRefs: [r1(id.S, 'Study')], originalExcerpt: K('ผลผลิตเพิ่มขึ้นร้อยละ 12 (ข้อมูลสมมติ)'), accessClassification: 'PUBLIC' }],
    [id.ER, { type: 'Evidence', sourceAssetRef: SA, reportRef: r1(id.R, 'Report'), locator: { kind: 'paragraph', value: '5' }, studyRefs: [r1(id.S, 'Study')], originalExcerpt: K('RESTRICTED-MARKER ข้อความจำกัดสิทธิ์'), accessClassification: 'RESTRICTED' }],
    [id.AR, { type: 'AnalysisRun', studyRef: r1(id.S, 'Study'), method: 'ANCOVA', methodVersion: '1', resultRefs: [r1(id.X, 'Result')] }],
    [id.X, { type: 'Result', analysisRunRef: r1(id.AR, 'AnalysisRun'), measure: 'yield-change', value: K(12), unit: K('percent'), context: K('ฤดูนาปี 2568'), evidenceRefs: [r1(id.E, 'Evidence')] }],
    [id.F, { type: 'Finding', resultRefs: [r1(id.X, 'Result')], explanation: { th: 'ข้อค้นพบสมมติ: ปุ๋ยสูตร A เพิ่มผลผลิตข้าว', en: 'Synthetic finding: fertilizer A increases rice yield' }, context: K('ฤดูนาปี 2568'), evidenceRefs: [r1(id.E, 'Evidence')] }],
    [id.CF, { type: 'ClaimFrame', predicateId: 'increases', participants: [{ roleId: 'subject', literal: K('ปุ๋ยสูตร A') }, { roleId: 'outcome', literal: K('ผลผลิตข้าว') }, { roleId: 'population', literal: K('แปลงนาสมมติ') }], qualifiers: [] }],
    [id.Cl, { type: 'Claim', claimFrameRef: r1(id.CF, 'ClaimFrame'), evidenceRefs: [r1(id.E, 'Evidence'), r1(id.ER, 'Evidence')], epistemicStatus: 'PROPOSED' }],
    [id.P, { type: 'ReviewProtocol', protocolVersion: 'v1', criteria: ['หลักฐานย้อนถึง SourceAsset และ locator ได้'], requiredChecks: ['schema-validation', 'evidence-trace'], reviewerRole: 'REVIEWER', decisionPolicy: 'single-human-reviewer' }],
  ];
}
export const codeOf = (fn) => { try { fn(); } catch (e) { return e.code ?? `UNEXPECTED:${e.message}`; } return 'NO_ERROR'; };
export function readAllFiles(dir) {
  let out = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name); out += e.isDirectory() ? readAllFiles(p) : fs.readFileSync(p, 'utf8');
  }
  return out;
}

// P2-WP6: Code.js adapters end-to-end against in-memory fakes of Drive / Sheets / Properties / tokeninfo.
// Exercises the real doPost → apiDeps_ → KEKB_API → KEKB_ENGINE → driveStore_ → flushMirror_ path offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sliceDrafts, DRAFT_KEYS } from '../../../core/test/helpers.js';
import { readScript, plain, testClock } from './helpers.js';
import { fakeDrive, fakeSheets, fakeServices } from './fake-gas.js';

const contract = JSON.parse(fs.readFileSync(new URL('../../../contracts/workflow-sheet/kekb-workflow-sheet-v1.json', import.meta.url), 'utf8'));
const CLIENT = '1234567890-abc.apps.googleusercontent.com';
const TOKEN = 'tok-owner-xxxxxxxxxxxxxxxx';
const PDF = Buffer.from('%PDF-1.4 synthetic test file, no real data\n');

function env() {
  const drive = fakeDrive();
  const sourceFolder = drive.mkFolder('SourceAssets', null);
  const rawFile = sourceFolder.addRaw('paper.pdf', PDF, 'application/pdf');
  const sheets = fakeSheets(contract.tabs);
  const props = {
    SOURCE_FOLDER_ID: sourceFolder.getId(), GITHUB_REPO: 'owner/repo', GITHUB_BRANCH: 'main', CANONICAL_ROOT: 'knowledge', OAUTH_CLIENT_ID: CLIENT,
    ACTORS_JSON: JSON.stringify({ 'Owner@Example.com': { actorId: 'human:krit', roles: ['CONTRIBUTOR', 'REVIEWER', 'ADMIN'] } }),
  };
  const tokens = { [TOKEN]: { aud: CLIENT, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email: 'owner@example.com', email_verified: 'true' } };
  const svc = fakeServices({ props, tokens, drive, sheets });
  const ctx = vm.createContext({ ...svc, console });
  for (const f of ['Lib.js', 'Engine.js', 'Api.js', 'Code.js']) vm.runInContext(readScript(f), ctx, { filename: f });
  let k = 0;
  const post = (action, payload) => plain(JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({
    action, idToken: TOKEN, ...(payload === undefined ? {} : { payload }), ...(ctx.KEKB_API.ACTIONS[action].mutation ? { idempotencyKey: `adapter-key-${++k}` } : {}),
  }) } }).content));
  const rows = (tab) => { const [h, ...rs] = sheets.sheets[tab].data; return rs.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] ?? '']))); };
  return { ctx, drive, sheets, props, post, rows, rawFile, svc };
}

test('before setupDrafts: identity + intake work, draft actions fail safely; setupDrafts is idempotent', () => {
  const e = env();
  assert.equal(e.post('whoami').data.actorId, 'human:krit');
  const r = e.post('draft.list');
  assert.equal(r.ok, false); assert.deepEqual(Object.keys(r.error), ['code']);
  assert.equal(e.ctx.setupDrafts(), 'OK: drafts folder ready');
  const id = e.props.DRAFTS_FOLDER_ID; assert.ok(id);
  e.ctx.setupDrafts();
  assert.equal(e.props.DRAFTS_FOLDER_ID, id);
  assert.equal(e.svc.rest.ops.filter((o) => o[0] === 'createFolder' && o[1] === 'KEKB Drafts (private)').length, 1);
  assert.equal(e.svc.rest.ops.filter((o) => o[0] === 'createFolder').length, 3, 'drafts root + records + reviews, once');
  assert.ok(!e.svc.fetches.some((u) => /ya-fake-script-token/.test(u)), 'OAuth token never in URLs');
  assert.deepEqual(e.post('draft.list').data.items, []);
});

test('full flow through doPost: Drive JSON drafts, Sheet mirrors (RecordStatus / ReviewQueue / IntakeQueue / AuditLog)', () => {
  const e = env(); e.ctx.setupDrafts();
  e.ctx.runSync();
  const intake = e.post('intake.list').data.items;
  assert.equal(intake.length, 1); assert.equal(intake[0].workflowState, 'RECEIVED');
  const u = e.post('intake.update', { intakeId: intake[0].intakeId, expectedUpdatedAt: intake[0].updatedAt, accessClassification: 'PUBLIC', originalLanguage: 'th' });
  assert.equal(u.ok, true, JSON.stringify(u));
  const reg = e.post('source.register', { intakeId: intake[0].intakeId, expectedUpdatedAt: u.data.updatedAt, locatorCapabilities: ['page', 'paragraph'] });
  assert.equal(reg.ok, true, JSON.stringify(reg));
  const saId = reg.data.sourceAssetId;
  assert.equal(e.post('source.extracted', { sourceId: saId }).ok, true);
  const SA = { id: saId, type: 'SourceAsset', revision: 1 };
  const clk = testClock(Date.now());
  const ids = Object.fromEntries(DRAFT_KEYS.map((x) => [x, clk.newId()]));
  for (const [i, rec] of sliceDrafts(ids, SA)) assert.equal(e.post('draft.save', { id: i, record: rec, sourceRefs: [SA] }).ok, true);
  const v = e.post('draft.validate');
  assert.equal(v.data.valid, true, JSON.stringify(v.data.issues));
  const targets = [saId, ...Object.values(ids)];
  const rq = e.post('review.request', { targetIds: targets, protocolId: ids.P });
  assert.equal(rq.ok, true, JSON.stringify(rq));
  const d = e.post('review.decide', { requestId: rq.data.requestId, decision: 'APPROVE', reason: { th: 'ตรวจครบ' } });
  assert.equal(d.ok, true, JSON.stringify(d)); assert.equal(d.data.selfReview, true);

  // Drive: one JSON file per id@revision (11 records + ReviewSnapshot), one review file; no Drive ids inside records
  const R = e.svc.rest;
  const sub = (name) => R.children(e.props.DRAFTS_FOLDER_ID).find((f) => f.name === name);
  const recFiles = R.children(sub('records').id); assert.equal(recFiles.length, 12);
  assert.ok(R.ops.some((o) => o[0] === 'update'), 'state changes rewrite the same id@revision file');
  const allText = recFiles.map((f) => f.content).join('\n');
  assert.ok(allText.includes('ปุ๋ยสูตร A'), 'Thai text round-trips as UTF-8');
  assert.ok(!allText.includes(e.rawFile.getId()) && !allText.includes(e.props.SOURCE_FOLDER_ID), 'no Drive ids in records');
  assert.equal(R.children(sub('reviews').id).length, 1);

  // Sheets mirrors
  const status = e.rows('RecordStatus');
  assert.equal(status.length, 12);
  assert.equal(status.filter((r) => r.workflowState === 'APPROVED').length, 11);
  assert.ok(status.every((r) => /^[0-9a-f]{64}$/.test(r.contentHash)));
  const rqRow = e.rows('ReviewQueue');
  assert.equal(rqRow.length, 1); assert.equal(rqRow[0].status, 'CLOSED'); assert.equal(rqRow[0].decision, 'APPROVE'); assert.equal(rqRow[0].reviewerId, 'human:krit');
  assert.equal(e.rows('IntakeQueue')[0].workflowState, 'APPROVED'); assert.equal(e.rows('IntakeQueue')[0].sourceAssetId, saId);
  const audit = e.rows('AuditLog');
  assert.deepEqual(audit.map((a) => Number(a.seq)), audit.map((_, i) => i + 1), 'sequential');
  assert.ok(audit.some((a) => a.action === 'api:review.decide' && a.code === 'SELF_REVIEW'));
  const saStates = audit.filter((a) => a.target === `${saId}@1` && a.action.startsWith('state:')).map((a) => a.action.slice(6));
  assert.deepEqual(saStates, ['RECEIVED', 'REGISTERED', 'EXTRACTED', 'VALIDATED', 'REVIEW_READY', 'APPROVED']);
  const sheetText = JSON.stringify(e.sheets.sheets);
  assert.ok(!sheetText.toLowerCase().includes('owner@example.com'), 'no email in the Sheet');
  assert.ok(!sheetText.includes('ตรวจครบ'), 'review reason text stays in Drive, not in the Sheet');
});

test('source.register refuses when the Drive bytes no longer match the queued hash', () => {
  const e = env(); e.ctx.setupDrafts(); e.ctx.runSync();
  const it = e.post('intake.list').data.items[0];
  const u = e.post('intake.update', { intakeId: it.intakeId, expectedUpdatedAt: it.updatedAt, originalLanguage: 'en' });
  e.rawFile.setContent('tampered bytes');
  const r = e.post('source.register', { intakeId: it.intakeId, expectedUpdatedAt: u.data.updatedAt, locatorCapabilities: ['page'] });
  assert.equal(r.error.code, 'REVISION_CONFLICT');
  assert.equal(e.rows('IntakeQueue')[0].workflowState, 'RECEIVED');
  assert.ok(e.rows('AuditLog').some((a) => a.action === 'api:source.register' && a.outcome === 'FAILED'));
});

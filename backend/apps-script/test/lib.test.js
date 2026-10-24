// P2-WP4: Apps Script pure logic (Lib.js) tested in Node via vm (no Google services).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../Lib.js', import.meta.url), 'utf8'), ctx);
const K = ctx.KEKB;
const contract = JSON.parse(fs.readFileSync(new URL('../../../contracts/workflow-sheet/kekb-workflow-sheet-v1.json', import.meta.url), 'utf8'));
const NOW = '2026-10-24T15:00:00.000Z';
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
let n = 0; const newId = () => K.uuidv7(Date.parse(NOW) + n++, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const H = (tab) => [...K.TABS[tab].columns];
// simulate the sheet: apply a plan and return rows as display strings (what getDisplayValues returns)
const apply = (rows, plan) => {
  const out = rows.map((r) => [...r]);
  const disp = (v) => (typeof v === 'string' ? v.replace(/^'/, '') : typeof v === 'boolean' ? String(v).toUpperCase() : String(v));
  for (const u of plan.updates) out[u.row - 2] = u.values.map(disp);
  for (const a of plan.appends) out.push(a.map(disp));
  return out;
};

test('tab columns match the workflow-sheet contract', () => {
  for (const tab of ['IntakeQueue', 'RecordStatus', 'ReviewQueue', 'AuditLog']) assert.deepEqual(H(tab), contract.tabs[tab]);
});

test('uuidv7 / bytesToHex: valid v7 format, signed bytes handled', () => {
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(K.bytesToHex([-1, 0, 15, -128]), 'ff000f80'); // Apps Script digests are signed bytes
});

test('sanitizeCell blocks formula injection and keeps plain values', () => {
  for (const bad of ['=IMPORTXML("x")', '+1', '-1', '@SUM(A1)', '\tx']) assert.ok(K.sanitizeCell(bad).startsWith("'"));
  assert.equal(K.sanitizeCell('ok'), 'ok'); assert.equal(K.sanitizeCell(3), 3); assert.equal(K.sanitizeCell(null), '');
});

test('Drive intake: new files appended RECEIVED + RESTRICTED; rerun is a no-op (idempotent)', () => {
  const files = [
    { id: 'f1', mimeType: 'application/pdf', size: 10, modifiedAt: NOW, sha256: sha('a'), error: '' },
    { id: 'f2', mimeType: 'application/vnd.google-apps.document', size: 0, modifiedAt: NOW, sha256: '', error: 'UNSUPPORTED_GOOGLE_NATIVE_TYPE' },
  ];
  let rows = [];
  const p1 = K.planUpsert('IntakeQueue', H('IntakeQueue'), rows, K.intakeDesired(files, [], NOW, newId), NOW);
  assert.equal(p1.appends.length, 2); assert.equal(p1.updates.length, 0);
  rows = apply(rows, p1);
  const o = K.rowsToObjects(H('IntakeQueue'), rows);
  assert.equal(o[0].workflowState, 'RECEIVED'); assert.equal(o[0].accessClassification, 'RESTRICTED'); assert.equal(o[0].sha256, sha('a'));
  assert.equal(o[1].workflowState, 'ERROR'); assert.equal(o[1].note, 'UNSUPPORTED_GOOGLE_NATIVE_TYPE');
  const p2 = K.planUpsert('IntakeQueue', H('IntakeQueue'), rows, K.intakeDesired(files, o, '2026-10-24T16:00:00.000Z', newId), '2026-10-24T16:00:00.000Z');
  assert.deepEqual({ u: p2.updates.length, a: p2.appends.length }, { u: 0, a: 0 });
});

test('Drive intake: changed content → new row, old row kept; human edits preserved; rows never deleted', () => {
  let rows = apply([], K.planUpsert('IntakeQueue', H('IntakeQueue'), [], K.intakeDesired([{ id: 'f1', mimeType: 'text/plain', size: 1, modifiedAt: NOW, sha256: sha('v1'), error: '' }], [], NOW, newId), NOW));
  const h = H('IntakeQueue');
  rows[0][h.indexOf('assignedTo')] = 'human:contributor-1';
  rows[0][h.indexOf('accessClassification')] = 'PUBLIC';
  rows[0][h.indexOf('workflowState')] = 'REGISTERED';
  const files = [{ id: 'f1', mimeType: 'text/plain', size: 1, modifiedAt: '2026-10-25T00:00:00.000Z', sha256: sha('v2'), error: '' }];
  const p = K.planUpsert('IntakeQueue', h, rows, K.intakeDesired(files, K.rowsToObjects(h, rows), NOW, newId), NOW);
  assert.equal(p.appends.length, 1); assert.equal(p.updates.length, 0);
  rows = apply(rows, p);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][h.indexOf('assignedTo')], 'human:contributor-1');
  assert.equal(rows[0][h.indexOf('accessClassification')], 'PUBLIC');
  assert.equal(rows[0][h.indexOf('workflowState')], 'REGISTERED', 'sync never regresses a curator-advanced state');
});

const rec = (id, revision, extra = {}) => ({ id, type: 'Claim', revision, schemaVersion: 'v1.0-RC2', workflowState: 'COMMITTED', updatedAt: NOW, updatedBy: 'human:contributor-1', ...extra });

test('canonical mirror: COMMITTED → PUBLISHED by active read model, older revision SUPERSEDED, stale flag, content hash', () => {
  const records = { 'c@1': rec('c', 1), 'c@2': rec('c', 2, { epistemicStatus: 'X' }), 'e@1': rec('e', 1, { type: 'Evidence' }) };
  const manifest = { canonicalRevision: 2, records: Object.keys(records), history: [{ canonicalRevision: 1, keys: ['c@1', 'e@1'] }, { canonicalRevision: 2, keys: ['c@2'] }] };
  const d = K.statusDesired(manifest, records, { canonicalRevision: 1, readModelId: 'rm-1' }, [{ id: 'e', revision: 1 }], sha);
  const by = Object.fromEntries(d.map((x) => [`${x.recordId}@${x.revision}`, x]));
  assert.equal(by['c@1'].workflowState, 'SUPERSEDED');
  assert.equal(by['c@2'].workflowState, 'COMMITTED'); // committed at rev 2, read model only at rev 1
  assert.equal(by['e@1'].workflowState, 'PUBLISHED');
  assert.equal(by['e@1'].dependencyStale, 'TRUE'); assert.equal(by['c@2'].dependencyStale, 'FALSE');
  const { workflowState, updatedAt, ...content } = records['c@2'];
  assert.equal(by['c@2'].contentHash, sha(K.canonicalJson(content)), 'hash excludes workflow metadata');
});

test('canonical mirror: state changes update the row (canonical wins), rerun is idempotent', () => {
  const h = H('RecordStatus');
  const records = { 'c@1': rec('c', 1) };
  let manifest = { canonicalRevision: 1, records: ['c@1'], history: [{ canonicalRevision: 1, keys: ['c@1'] }] };
  let rows = apply([], K.planUpsert('RecordStatus', h, [], K.statusDesired(manifest, records, null, [], sha), NOW));
  rows[0][h.indexOf('workflowState')] = 'APPROVED'; // someone hand-edited a system column
  const p = K.planUpsert('RecordStatus', h, rows, K.statusDesired(manifest, records, { canonicalRevision: 1 }, [], sha), NOW);
  assert.equal(p.updates.length, 1);
  rows = apply(rows, p);
  assert.equal(rows[0][h.indexOf('workflowState')], 'PUBLISHED');
  const again = K.planUpsert('RecordStatus', h, rows, K.statusDesired(manifest, records, { canonicalRevision: 1 }, [], sha), '2026-10-24T17:00:00.000Z');
  assert.deepEqual({ u: again.updates.length, a: again.appends.length }, { u: 0, a: 0 });
});

test('schema drift is refused instead of writing into wrong columns', () => {
  assert.throws(() => K.planUpsert('RecordStatus', ['recordId', 'oops'], [], [], NOW), /SHEET_SCHEMA_MISMATCH/);
});

test('audit rows: sequential, sync actor, sanitized', () => {
  const r = K.auditRows(7, [{ action: 'sync:intake', target: '=1+1', outcome: 'OK' }], NOW);
  assert.deepEqual([...r[0]], [8, NOW, 'service:apps-script-sync', 'sync:intake', "'=1+1", 'OK', '']);
});

test('Code.js uses no secrets and only the declared services', () => {
  const code = fs.readFileSync(new URL('../Code.js', import.meta.url), 'utf8');
  // no hardcoded credential literals (e.g. token: 'abc…', API_KEY = "…", Bearer xyz)
  assert.ok(!/(token|password|secret|api_?key)\w*['"]?\s*[:=]\s*['"][^'"]{8,}['"]/i.test(code), 'hardcoded secret literal');
  assert.ok(!/Bearer\s+[A-Za-z0-9._-]{10,}/.test(code), 'hardcoded bearer token');
  for (const probe of ["token: 'abcdefghijkl'", 'API_KEY = "0123456789abcdef"']) assert.ok(/(token|password|secret|api_?key)\w*['"]?\s*[:=]\s*['"][^'"]{8,}['"]/i.test(probe), 'detector self-check');
  const manifest = JSON.parse(fs.readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8'));
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'));
  assert.ok(!manifest.oauthScopes.some((s) => /auth\/drive$/.test(s)), 'no full Drive write scope');
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive.file'), 'drafts: write only files this script created');
});

test('Drive intake: same file rerun keeps human/curator edits on that row (no overwrite, no write)', () => {
  const h = H('IntakeQueue');
  const files = [{ id: 'f9', mimeType: 'application/pdf', size: 5, modifiedAt: NOW, sha256: sha('same'), error: '' }];
  let rows = apply([], K.planUpsert('IntakeQueue', h, [], K.intakeDesired(files, [], NOW, newId), NOW));
  rows[0][h.indexOf('accessClassification')] = 'PUBLIC';
  rows[0][h.indexOf('workflowState')] = 'REGISTERED';
  rows[0][h.indexOf('assignedTo')] = 'human:contributor-1';
  rows[0][h.indexOf('note')] = 'ตรวจลิขสิทธิ์แล้ว';
  const p = K.planUpsert('IntakeQueue', h, rows, K.intakeDesired(files, K.rowsToObjects(h, rows), NOW, newId), NOW);
  assert.deepEqual({ u: p.updates.length, a: p.appends.length }, { u: 0, a: 0 });
});

test('P2-WP6 mirrors: draft → RecordStatus row, review → ReviewQueue row (refs only, no reason text), idempotent upsert', () => {
  const rec = { id: '019a1b2c-3d4e-7f00-8abc-0123456789ab', type: 'Claim', revision: 2, workflowState: 'VALIDATED', updatedAt: NOW, updatedBy: 'human:krit', reason: 'x' };
  const row = K.draftStatusRow(rec, 'h'.repeat(64));
  assert.deepEqual(Object.keys(row).sort(), H('RecordStatus').filter((c) => c !== 'syncedAt').sort());
  assert.equal(row.dependencyStale, 'FALSE'); assert.equal(row.canonicalRevision, '');
  const req = { requestId: 'r1', status: 'CLOSED', targets: [{ id: 'a', revision: 1, type: 'Claim', contentHash: 'z' }, { id: 'b', revision: 3 }],
    protocolRef: { id: 'p', type: 'ReviewProtocol', revision: 1 }, decision: 'APPROVE', snapshotId: 's', reviewerId: 'human:krit', createdAt: NOW, closedAt: NOW, reason: { th: 'ลับ' } };
  const rr = K.reviewRow(req);
  assert.equal(rr.targets, 'a@1,b@3'); assert.equal(rr.protocolRef, 'p@1'); assert.ok(!JSON.stringify(rr).includes('ลับ'));
  const plan = K.planUpsert('ReviewQueue', H('ReviewQueue'), [], [rr], NOW);
  assert.equal(plan.appends.length, 1);
  const again = K.planUpsert('ReviewQueue', H('ReviewQueue'), plan.appends.map((r) => r.map(String)), [rr], NOW);
  assert.equal(again.updates.length + again.appends.length, 0);
});

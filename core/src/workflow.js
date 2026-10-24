// Workflow: intake → draft → validate → review-ready → human review. No AI path exists.
import fs from 'node:fs';
import path from 'node:path';
import { validateRecordSet } from '../../validator/src/index.js';
import { ERR, fail } from './errors.js';
import { uuidv7, sha256, canonicalJson } from './ids.js';
import {
  paths, key, getActor, requireRole, audit, putDraft, getDraft, draftRevisions, latestDrafts,
  canonicalRecords, writeJsonAtomic, readJson,
} from './store.js';

export const SCHEMA_VERSION = 'v1.0-RC2';
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const nowIso = (now) => (now ? now() : new Date().toISOString());

// Allowed same-revision state moves. Content edits create a new revision in EXTRACTED instead.
export const TRANSITIONS = Object.freeze({
  RECEIVED: ['REGISTERED', 'ERROR'], REGISTERED: ['EXTRACTED', 'ERROR'], EXTRACTED: ['VALIDATED', 'ERROR'],
  VALIDATED: ['REVIEW_READY'], REVIEW_READY: ['APPROVED', 'NEEDS_REVISION', 'REJECTED'], APPROVED: ['COMMITTED'],
  COMMITTED: ['PUBLISHED', 'SUPERSEDED'], PUBLISHED: ['SUPERSEDED'], NEEDS_REVISION: [], ERROR: ['EXTRACTED'],
  REJECTED: [], SUPERSEDED: [],
});
export function assertTransition(record, to) {
  if (!(TRANSITIONS[record.workflowState] || []).includes(to)) fail(ERR.INVALID_TRANSITION, { recordId: record.id, from: record.workflowState, to });
}
function setState(root, record, to, actor, now) {
  assertTransition(record, to);
  const next = { ...record, workflowState: to, updatedAt: nowIso(now) };
  putDraft(root, next);
  audit(root, { at: next.updatedAt, actor: actor.id, action: `state:${to}`, target: key(record.id, record.revision), outcome: 'OK' });
  return next;
}
/** Content hash excludes workflow metadata so state moves never alter what was reviewed. */
export function contentHash(record) {
  const { workflowState, updatedAt, ...content } = record;
  return sha256(canonicalJson(content));
}
export const newId = (now) => uuidv7(now ? Date.parse(now()) : Date.now());

/** Working set = canonical records + drafts not yet committed (by id@revision). */
export function workingSet(root) {
  const map = new Map(canonicalRecords(root).map((r) => [key(r.id, r.revision), r]));
  for (const d of latestDrafts(root)) if (!map.has(key(d.id, d.revision))) map.set(key(d.id, d.revision), d);
  return [...map.values()];
}
function currentRevision(root, id) {
  const revs = [...draftRevisions(root, id), ...canonicalRecords(root).filter((r) => r.id === id).map((r) => r.revision)];
  return revs.length ? Math.max(...revs) : 0;
}
function envelope(type, id, revision, actor, at, extra) {
  return {
    id, type, schemaVersion: SCHEMA_VERSION, revision, workflowState: 'EXTRACTED', createdAt: at, updatedAt: at,
    createdBy: actor.id, updatedBy: actor.id, ...extra,
  };
}

/** Register a raw source file (≈ Drive). Content-addressed, never executed. */
export function intakeSource(root, { actorId, filePath, sourceKind, sourceVersion, originalLanguage, accessClassification, locatorCapabilities, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'CONTRIBUTOR');
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size === 0 || st.size > MAX_SOURCE_BYTES) fail(ERR.INVALID_INPUT, { field: 'filePath' });
  const bytes = fs.readFileSync(filePath); const digest = sha256(bytes);
  const existing = workingSet(root).find((r) => r.type === 'SourceAsset' && r.hash.digest === digest && r.sourceVersion === sourceVersion);
  if (existing) return { id: existing.id, revision: existing.revision, reused: true };
  const P = paths(root); const blob = path.join(P.sources, digest);
  if (!fs.existsSync(blob)) fs.writeFileSync(blob, bytes, { mode: 0o444 });
  const at = nowIso(now); const id = newId(now);
  const record = {
    ...envelope('SourceAsset', id, 1, actor, at, {}), workflowState: 'RECEIVED',
    provenance: { actorId: actor.id, action: 'source-intake', timestamp: at, sourceRefs: [] },
    sourceKind, sourceVersion, hash: { algorithm: 'sha256', digest }, accessClassification, originalLanguage,
    storageRef: `local:sources/${digest}`, locatorCapabilities,
  };
  audit(root, { at, actor: actor.id, action: 'state:RECEIVED', target: key(id, 1), outcome: 'OK' });
  putDraft(root, record);
  setState(root, record, 'REGISTERED', actor, now);
  return { id, revision: 1, reused: false };
}

export function completeExtraction(root, { actorId, sourceId, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'CONTRIBUTOR');
  const src = getDraft(root, sourceId); if (!src || src.type !== 'SourceAsset') fail(ERR.NOT_FOUND, { recordId: sourceId });
  setState(root, src, 'EXTRACTED', actor, now);
}

const SYSTEM_FIELDS = ['id', 'schemaVersion', 'revision', 'workflowState', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'provenance'];
/**
 * Manual modeling: create (optional pre-allocated opaque id) or update (expectedRevision required).
 * Envelope, actor and provenance are set server-side; client-supplied authority fields are rejected.
 */
export function saveDraft(root, { actorId, record, id, expectedRevision, sourceRefs = [], derivationRunRef, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'CONTRIBUTOR');
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(ERR.INVALID_INPUT, { field: 'record' });
  for (const f of SYSTEM_FIELDS) if (f in record) fail(ERR.INVALID_INPUT, { field: f });
  if (['ReviewSnapshot', 'SourceAsset'].includes(record.type)) fail(ERR.INVALID_INPUT, { field: 'type' });
  const at = nowIso(now);
  const provenance = { actorId: actor.id, action: 'manual-modeling', timestamp: at, sourceRefs, ...(derivationRunRef ? { derivationRunRef } : {}) };
  let draft;
  if (expectedRevision === undefined) {
    const newIdValue = id ?? newId(now);
    if (!UUID_V7.test(newIdValue) || currentRevision(root, newIdValue) !== 0) fail(ERR.INVALID_INPUT, { field: 'id' });
    draft = { ...envelope(record.type, newIdValue, 1, actor, at, {}), provenance, ...record };
  } else {
    const cur = currentRevision(root, id);
    if (cur === 0) fail(ERR.NOT_FOUND, { recordId: id });
    if (cur !== expectedRevision) fail(ERR.REVISION_CONFLICT, { recordId: id, expectedRevision, currentRevision: cur });
    const prev = getDraft(root, id, cur) || canonicalRecords(root).find((r) => r.id === id && r.revision === cur);
    if (prev.type !== record.type) fail(ERR.INVALID_INPUT, { field: 'type' });
    if (['REJECTED', 'SUPERSEDED'].includes(prev.workflowState)) fail(ERR.INVALID_TRANSITION, { recordId: id, from: prev.workflowState, to: 'EXTRACTED' });
    draft = { ...envelope(record.type, id, cur + 1, actor, at, {}), createdAt: prev.createdAt, createdBy: prev.createdBy, provenance, ...record };
  }
  putDraft(root, draft);
  audit(root, { at, actor: actor.id, action: expectedRevision === undefined ? 'draft:create' : 'draft:revise', target: key(draft.id, draft.revision), outcome: 'OK' });
  return { id: draft.id, revision: draft.revision };
}

/** Deterministic validation of the working set; passing EXTRACTED targets move to VALIDATED. */
export function validateDrafts(root, { actorId, ids, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'CONTRIBUTOR');
  const result = validateRecordSet(workingSet(root));
  const bad = new Set(result.issues.map((i) => i.recordId));
  const targets = (ids ? ids.map((id) => getDraft(root, id)) : latestDrafts(root).filter((d) => d.workflowState === 'EXTRACTED'));
  const validated = []; const failed = [];
  for (const t of targets) {
    if (!t) fail(ERR.NOT_FOUND);
    if (t.workflowState !== 'EXTRACTED') fail(ERR.INVALID_TRANSITION, { recordId: t.id, from: t.workflowState, to: 'VALIDATED' });
    if (bad.has(t.id)) failed.push(t.id); else { setState(root, t, 'VALIDATED', actor, now); validated.push(t.id); }
  }
  audit(root, { at: nowIso(now), actor: actor.id, action: 'validate', target: `${targets.length} records`, outcome: result.valid ? 'PASS' : 'FAIL' });
  return { valid: result.valid, validated, failed, issues: result.issues };
}

/** Freeze exact target revisions + content hashes and a ReviewProtocol for a human REVIEWER. */
export function markReviewReady(root, { actorId, targetIds, protocolId, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'CONTRIBUTOR');
  const targets = targetIds.map((id) => getDraft(root, id) || fail(ERR.NOT_FOUND, { recordId: id }));
  for (const t of targets) assertTransition(t, 'REVIEW_READY');
  const protocol = workingSet(root).filter((r) => r.id === protocolId && r.type === 'ReviewProtocol').sort((a, b) => b.revision - a.revision)[0];
  if (!protocol) fail(ERR.NOT_FOUND, { recordId: protocolId });
  const check = validateRecordSet(workingSet(root));
  if (!check.valid) fail(ERR.VALIDATION_FAILED, { codes: [...new Set(check.issues.map((i) => i.code))] });
  const at = nowIso(now); const requestId = newId(now);
  const pinned = targets.map((t) => ({ id: t.id, type: t.type, revision: t.revision, contentHash: contentHash(t) }));
  for (const t of targets) setState(root, t, 'REVIEW_READY', actor, now);
  writeJsonAtomic(path.join(paths(root).reviews, `${requestId}.json`), {
    requestId, status: 'OPEN', targets: pinned, protocolRef: { id: protocol.id, type: 'ReviewProtocol', revision: protocol.revision }, createdBy: actor.id, createdAt: at,
  });
  audit(root, { at, actor: actor.id, action: 'review:request', target: requestId, outcome: 'OK' });
  return { requestId };
}

/** Human decision only: actor must be a human with REVIEWER role. Creates an immutable ReviewSnapshot. */
export function review(root, { actorId, requestId, decision, reason, now }) {
  const actor = getActor(root, actorId); requireRole(actor, 'REVIEWER');
  if (!['APPROVE', 'NEEDS_REVISION', 'REJECT'].includes(decision)) fail(ERR.INVALID_INPUT, { field: 'decision' });
  if (!reason || typeof reason !== 'object' || Object.keys(reason).length === 0) fail(ERR.INVALID_INPUT, { field: 'reason' });
  const reqFile = path.join(paths(root).reviews, `${requestId}.json`);
  if (!fs.existsSync(reqFile)) fail(ERR.NOT_FOUND, { requestId });
  const req = readJson(reqFile);
  if (req.status !== 'OPEN') fail(ERR.INVALID_TRANSITION, { requestId, from: req.status });
  const targets = req.targets.map((p) => {
    const latest = getDraft(root, p.id);
    if (!latest || latest.revision !== p.revision || contentHash(latest) !== p.contentHash || latest.workflowState !== 'REVIEW_READY') {
      fail(ERR.REVISION_CONFLICT, { recordId: p.id, pinnedRevision: p.revision });
    }
    return latest;
  });
  const check = validateRecordSet(workingSet(root));
  if (decision === 'APPROVE' && !check.valid) fail(ERR.VALIDATION_FAILED, { codes: [...new Set(check.issues.map((i) => i.code))] });
  const evidence = new Map();
  for (const t of targets) {
    if (t.type === 'Evidence') evidence.set(key(t.id, t.revision), { id: t.id, type: t.type, revision: t.revision });
    for (const e of t.evidenceRefs || []) evidence.set(key(e.id, e.revision), e);
  }
  if (evidence.size === 0) fail(ERR.INVALID_INPUT, { field: 'evidenceRefs' });
  const at = nowIso(now); const id = newId(now);
  const snapshot = {
    id, type: 'ReviewSnapshot', schemaVersion: SCHEMA_VERSION, revision: 1, workflowState: 'VALIDATED', createdAt: at, updatedAt: at,
    createdBy: actor.id, updatedBy: actor.id, provenance: { actorId: actor.id, action: 'human-review', timestamp: at, sourceRefs: [] },
    targetRefs: req.targets.map(({ id: i, type, revision }) => ({ id: i, type, revision })), evidenceRefs: [...evidence.values()],
    protocolRef: req.protocolRef, validationResult: check.valid ? 'PASS' : 'FAIL', reviewerId: actor.id, decision, reason, decidedAt: at,
  };
  putDraft(root, snapshot);
  const to = { APPROVE: 'APPROVED', NEEDS_REVISION: 'NEEDS_REVISION', REJECT: 'REJECTED' }[decision];
  for (const t of targets) setState(root, t, to, actor, now);
  writeJsonAtomic(reqFile, { ...req, status: 'CLOSED', snapshotId: id, decision, closedAt: at });
  audit(root, { at, actor: actor.id, action: `review:${decision}`, target: key(id, 1), outcome: 'OK' });
  return { snapshotId: id, decision, validationResult: snapshot.validationResult };
}

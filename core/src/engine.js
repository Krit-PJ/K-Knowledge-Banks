// Storage-agnostic KEKB workflow engine (P2-WP6): intake registration → draft → validate → review-ready → human review.
// Pure: no fs, network, clock, randomness or crypto — every side effect comes through `deps`, so the same code runs on
// the local file store (core/src/workflow.js) and inside Google Apps Script (Drive JSON drafts + Sheets mirror).
// No AI path exists. Authority comes only from the `actor` object resolved by the caller's trusted boundary.
import { validateRecordSet } from '../../validator/src/index.js';
import { ERR, fail } from './errors.js';
import { canonicalJson } from './canonical-json.js';
import { staleReferences } from './dependency.js';

export const SCHEMA_VERSION = 'v1.0-RC2';
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const key = (id, rev) => `${id}@${rev}`;

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
/** Only humans act through roles; AI and service principals never gain authority from a role list. */
export function requireRole(actor, role) {
  if (!actor || actor.kind !== 'human' || !Array.isArray(actor.roles) || !actor.roles.includes(role)) fail(ERR.FORBIDDEN, { required: role });
}
/** Content hash excludes workflow metadata so state moves never alter what was reviewed. */
export function contentHash(record, sha256) {
  const { workflowState, updatedAt, ...content } = record;
  return sha256(canonicalJson(content));
}
export const SYSTEM_FIELDS = Object.freeze(['id', 'schemaVersion', 'revision', 'workflowState', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'provenance']);
const LOCATOR_KINDS = ['page', 'section', 'table', 'figure', 'paragraph', 'row', 'timeRange', 'dataRange'];
const ACCESS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];

/**
 * deps = {
 *   store: {
 *     putDraft(record), getDraft(id, revision?) → record|undefined (latest when revision omitted),
 *     draftRevisions(id) → number[] ascending, latestDrafts() → records (latest revision per id),
 *     canonicalRecords() → records, getReview(requestId) → object|undefined, putReview(object), audit(entry)
 *   },
 *   now() → ISO 8601 UTC string, newId() → UUID v7, sha256(text) → lowercase hex
 * }
 */
export function createEngine(deps) {
  const { store } = deps;
  const hashOf = (record) => contentHash(record, deps.sha256);

  function setState(record, to, actor) {
    assertTransition(record, to);
    const next = { ...record, workflowState: to, updatedAt: deps.now() };
    store.putDraft(next);
    store.audit({ at: next.updatedAt, actor: actor.id, action: `state:${to}`, target: key(record.id, record.revision), outcome: 'OK' });
    return next;
  }
  /** Working set = canonical records + drafts not yet committed (by id@revision). */
  function workingSet() {
    const map = new Map(store.canonicalRecords().map((r) => [key(r.id, r.revision), r]));
    for (const d of store.latestDrafts()) if (!map.has(key(d.id, d.revision))) map.set(key(d.id, d.revision), d);
    return [...map.values()];
  }
  function currentRevision(id) {
    const revs = [...store.draftRevisions(id), ...store.canonicalRecords().filter((r) => r.id === id).map((r) => r.revision)];
    return revs.length ? Math.max(...revs) : 0;
  }
  function envelope(type, id, revision, actor, at) {
    return { id, type, schemaVersion: SCHEMA_VERSION, revision, workflowState: 'EXTRACTED', createdAt: at, updatedAt: at, createdBy: actor.id, updatedBy: actor.id };
  }

  /**
   * Register a raw source the trusted adapter has already hashed (bytes never executed). Content-addressed:
   * the same digest + sourceVersion reuses the existing SourceAsset. RECEIVED → REGISTERED.
   */
  function registerSource(actor, { digest, storageRef, sourceKind, sourceVersion, originalLanguage, accessClassification, locatorCapabilities }) {
    requireRole(actor, 'CONTRIBUTOR');
    if (!/^[0-9a-f]{64}$/.test(digest || '')) fail(ERR.INVALID_INPUT, { field: 'digest' });
    if (!ACCESS.includes(accessClassification)) fail(ERR.INVALID_INPUT, { field: 'accessClassification' });
    if (!Array.isArray(locatorCapabilities) || !locatorCapabilities.length || locatorCapabilities.some((c) => !LOCATOR_KINDS.includes(c))
      || new Set(locatorCapabilities).size !== locatorCapabilities.length) fail(ERR.INVALID_INPUT, { field: 'locatorCapabilities' });
    for (const [f, v] of Object.entries({ storageRef, sourceKind, sourceVersion, originalLanguage })) if (typeof v !== 'string' || !v.trim()) fail(ERR.INVALID_INPUT, { field: f });
    const existing = workingSet().find((r) => r.type === 'SourceAsset' && r.hash.digest === digest && r.sourceVersion === sourceVersion);
    if (existing) return { id: existing.id, revision: existing.revision, reused: true };
    const at = deps.now(); const id = deps.newId();
    const record = {
      ...envelope('SourceAsset', id, 1, actor, at), workflowState: 'RECEIVED',
      provenance: { actorId: actor.id, action: 'source-intake', timestamp: at, sourceRefs: [] },
      sourceKind, sourceVersion, hash: { algorithm: 'sha256', digest }, accessClassification, originalLanguage, storageRef, locatorCapabilities,
    };
    store.audit({ at, actor: actor.id, action: 'state:RECEIVED', target: key(id, 1), outcome: 'OK' });
    store.putDraft(record);
    setState(record, 'REGISTERED', actor);
    return { id, revision: 1, reused: false };
  }

  function completeExtraction(actor, { sourceId }) {
    requireRole(actor, 'CONTRIBUTOR');
    const src = store.getDraft(sourceId); if (!src || src.type !== 'SourceAsset') fail(ERR.NOT_FOUND, { recordId: sourceId });
    const next = setState(src, 'EXTRACTED', actor);
    return { id: next.id, revision: next.revision, workflowState: next.workflowState };
  }

  /**
   * Manual modeling: create (optional pre-allocated opaque id) or update (expectedRevision required).
   * Envelope, actor and provenance are set here; client-supplied authority/envelope fields are rejected.
   */
  function saveDraft(actor, { record, id, expectedRevision, sourceRefs = [], derivationRunRef }) {
    requireRole(actor, 'CONTRIBUTOR');
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail(ERR.INVALID_INPUT, { field: 'record' });
    for (const f of SYSTEM_FIELDS) if (f in record) fail(ERR.INVALID_INPUT, { field: f });
    if (typeof record.type !== 'string' || ['ReviewSnapshot', 'SourceAsset'].includes(record.type)) fail(ERR.INVALID_INPUT, { field: 'type' });
    const at = deps.now();
    const provenance = { actorId: actor.id, action: 'manual-modeling', timestamp: at, sourceRefs, ...(derivationRunRef ? { derivationRunRef } : {}) };
    let draft;
    if (expectedRevision === undefined) {
      const newIdValue = id ?? deps.newId();
      if (!UUID_V7.test(newIdValue) || currentRevision(newIdValue) !== 0) fail(ERR.INVALID_INPUT, { field: 'id' });
      draft = { ...envelope(record.type, newIdValue, 1, actor, at), provenance, ...record };
    } else {
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) fail(ERR.INVALID_INPUT, { field: 'expectedRevision' });
      const cur = currentRevision(id);
      if (cur === 0) fail(ERR.NOT_FOUND, { recordId: id });
      if (cur !== expectedRevision) fail(ERR.REVISION_CONFLICT, { recordId: id, expectedRevision, currentRevision: cur });
      const prev = store.getDraft(id, cur) || store.canonicalRecords().find((r) => r.id === id && r.revision === cur);
      if (prev.type !== record.type) fail(ERR.INVALID_INPUT, { field: 'type' });
      if (['REJECTED', 'SUPERSEDED'].includes(prev.workflowState)) fail(ERR.INVALID_TRANSITION, { recordId: id, from: prev.workflowState, to: 'EXTRACTED' });
      draft = { ...envelope(record.type, id, cur + 1, actor, at), createdAt: prev.createdAt, createdBy: prev.createdBy, provenance, ...record };
    }
    store.putDraft(draft);
    store.audit({ at, actor: actor.id, action: expectedRevision === undefined ? 'draft:create' : 'draft:revise', target: key(draft.id, draft.revision), outcome: 'OK' });
    return { id: draft.id, revision: draft.revision };
  }

  /** Deterministic validation of the working set; passing EXTRACTED targets move to VALIDATED. */
  function validateDrafts(actor, { ids } = {}) {
    requireRole(actor, 'CONTRIBUTOR');
    const result = validateRecordSet(workingSet());
    const bad = new Set(result.issues.map((i) => i.recordId));
    const targets = (ids ? ids.map((id) => store.getDraft(id)) : store.latestDrafts().filter((d) => d.workflowState === 'EXTRACTED'));
    const validated = []; const failed = [];
    for (const t of targets) {
      if (!t) fail(ERR.NOT_FOUND);
      if (t.workflowState !== 'EXTRACTED') fail(ERR.INVALID_TRANSITION, { recordId: t.id, from: t.workflowState, to: 'VALIDATED' });
      if (bad.has(t.id)) failed.push(t.id); else { setState(t, 'VALIDATED', actor); validated.push(t.id); }
    }
    store.audit({ at: deps.now(), actor: actor.id, action: 'validate', target: `${targets.length} records`, outcome: result.valid ? 'PASS' : 'FAIL' });
    return { valid: result.valid, validated, failed, issues: result.issues };
  }

  /** Freeze exact target revisions + content hashes and a ReviewProtocol for a human REVIEWER. */
  function markReviewReady(actor, { targetIds, protocolId }) {
    requireRole(actor, 'CONTRIBUTOR');
    if (!Array.isArray(targetIds) || !targetIds.length) fail(ERR.INVALID_INPUT, { field: 'targetIds' });
    const targets = targetIds.map((id) => store.getDraft(id) || fail(ERR.NOT_FOUND, { recordId: id }));
    for (const t of targets) assertTransition(t, 'REVIEW_READY');
    const protocol = workingSet().filter((r) => r.id === protocolId && r.type === 'ReviewProtocol').sort((a, b) => b.revision - a.revision)[0];
    if (!protocol) fail(ERR.NOT_FOUND, { recordId: protocolId });
    const check = validateRecordSet(workingSet());
    if (!check.valid) fail(ERR.VALIDATION_FAILED, { codes: [...new Set(check.issues.map((i) => i.code))] });
    const at = deps.now(); const requestId = deps.newId();
    const pinned = targets.map((t) => ({ id: t.id, type: t.type, revision: t.revision, contentHash: hashOf(t) }));
    for (const t of targets) setState(t, 'REVIEW_READY', actor);
    store.putReview({
      requestId, status: 'OPEN', targets: pinned, protocolRef: { id: protocol.id, type: 'ReviewProtocol', revision: protocol.revision }, createdBy: actor.id, createdAt: at,
    });
    store.audit({ at, actor: actor.id, action: 'review:request', target: requestId, outcome: 'OK' });
    return { requestId };
  }

  /**
   * Human decision only: actor must be a human with REVIEWER role. Creates an immutable ReviewSnapshot.
   * OD-08 (approved lenient): a reviewer may decide on records they authored, but it is flagged (selfReview)
   * on the closed request and in the audit trail; it is never hidden.
   */
  function review(actor, { requestId, decision, reason }) {
    requireRole(actor, 'REVIEWER');
    if (!['APPROVE', 'NEEDS_REVISION', 'REJECT'].includes(decision)) fail(ERR.INVALID_INPUT, { field: 'decision' });
    if (!reason || typeof reason !== 'object' || Array.isArray(reason) || Object.keys(reason).length === 0) fail(ERR.INVALID_INPUT, { field: 'reason' });
    const req = store.getReview(requestId);
    if (!req) fail(ERR.NOT_FOUND, { requestId });
    if (req.status !== 'OPEN') fail(ERR.INVALID_TRANSITION, { requestId, from: req.status });
    const targets = req.targets.map((p) => {
      const latest = store.getDraft(p.id);
      if (!latest || latest.revision !== p.revision || hashOf(latest) !== p.contentHash || latest.workflowState !== 'REVIEW_READY') {
        fail(ERR.REVISION_CONFLICT, { recordId: p.id, pinnedRevision: p.revision });
      }
      return latest;
    });
    const check = validateRecordSet(workingSet());
    if (decision === 'APPROVE' && !check.valid) fail(ERR.VALIDATION_FAILED, { codes: [...new Set(check.issues.map((i) => i.code))] });
    if (decision === 'APPROVE') {
      const staleRefs = staleReferences(targets, store.canonicalRecords());
      if (staleRefs.length) fail(ERR.STALE_REFERENCE, { refs: staleRefs });
    }
    const evidence = new Map();
    for (const t of targets) {
      if (t.type === 'Evidence') evidence.set(key(t.id, t.revision), { id: t.id, type: t.type, revision: t.revision });
      for (const e of t.evidenceRefs || []) evidence.set(key(e.id, e.revision), e);
    }
    if (evidence.size === 0) fail(ERR.INVALID_INPUT, { field: 'evidenceRefs' });
    const selfReview = req.createdBy === actor.id || targets.some((t) => t.createdBy === actor.id || t.updatedBy === actor.id);
    const at = deps.now(); const id = deps.newId();
    const snapshot = {
      id, type: 'ReviewSnapshot', schemaVersion: SCHEMA_VERSION, revision: 1, workflowState: 'VALIDATED', createdAt: at, updatedAt: at,
      createdBy: actor.id, updatedBy: actor.id, provenance: { actorId: actor.id, action: 'human-review', timestamp: at, sourceRefs: [] },
      targetRefs: req.targets.map(({ id: i, type, revision }) => ({ id: i, type, revision })), evidenceRefs: [...evidence.values()],
      protocolRef: req.protocolRef, validationResult: check.valid ? 'PASS' : 'FAIL', reviewerId: actor.id, decision, reason, decidedAt: at,
    };
    store.putDraft(snapshot);
    const to = { APPROVE: 'APPROVED', NEEDS_REVISION: 'NEEDS_REVISION', REJECT: 'REJECTED' }[decision];
    for (const t of targets) setState(t, to, actor);
    store.putReview({ ...req, status: 'CLOSED', snapshotId: id, decision, reviewerId: actor.id, closedAt: at, ...(selfReview ? { selfReview: true } : {}) });
    store.audit({ at, actor: actor.id, action: `review:${decision}`, target: key(id, 1), outcome: 'OK', ...(selfReview ? { code: 'SELF_REVIEW' } : {}) });
    return { snapshotId: id, decision, validationResult: snapshot.validationResult, selfReview };
  }

  return { registerSource, completeExtraction, saveDraft, validateDrafts, markReviewReady, review, workingSet, contentHash: hashOf };
}

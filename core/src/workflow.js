// Workflow on the local file store: intake → draft → validate → review-ready → human review. No AI path exists.
// The rules live in the storage-agnostic engine (./engine.js), which Apps Script also runs; this module only
// resolves actors from the local registry and adapts the file store.
import fs from 'node:fs';
import path from 'node:path';
import { ERR, fail } from './errors.js';
import { uuidv7, sha256 } from './ids.js';
import { createEngine, contentHash as engineContentHash } from './engine.js';
import {
  paths, getActor, audit, putDraft, getDraft, draftRevisions, latestDrafts, canonicalRecords, writeJsonAtomic, readJson,
} from './store.js';

export { SCHEMA_VERSION, TRANSITIONS, assertTransition } from './engine.js';
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const nowIso = (now) => (now ? now() : new Date().toISOString());

/** Content hash excludes workflow metadata so state moves never alter what was reviewed. */
export const contentHash = (record) => engineContentHash(record, sha256);
export const newId = (now) => uuidv7(now ? Date.parse(now()) : Date.now());

function engineFor(root, now) {
  const reviewFile = (requestId) => path.join(paths(root).reviews, `${requestId}.json`);
  return createEngine({
    now: () => nowIso(now),
    newId: () => newId(now),
    sha256,
    store: {
      putDraft: (r) => putDraft(root, r),
      getDraft: (id, rev) => getDraft(root, id, rev),
      draftRevisions: (id) => draftRevisions(root, id),
      latestDrafts: () => latestDrafts(root),
      canonicalRecords: () => canonicalRecords(root),
      getReview: (requestId) => (typeof requestId === 'string' && fs.existsSync(reviewFile(requestId)) ? readJson(reviewFile(requestId)) : undefined),
      putReview: (req) => writeJsonAtomic(reviewFile(req.requestId), req),
      audit: (entry) => audit(root, entry),
    },
  });
}

/** Working set = canonical records + drafts not yet committed (by id@revision). */
export const workingSet = (root) => engineFor(root).workingSet();

/** Register a raw source file (≈ Drive). Content-addressed, never executed. */
export function intakeSource(root, { actorId, filePath, sourceKind, sourceVersion, originalLanguage, accessClassification, locatorCapabilities, now }) {
  const actor = getActor(root, actorId);
  if (actor.kind !== 'human' || !actor.roles.includes('CONTRIBUTOR')) fail(ERR.FORBIDDEN, { actorId: actor.id, required: 'CONTRIBUTOR' });
  const st = fs.statSync(filePath);
  if (!st.isFile() || st.size === 0 || st.size > MAX_SOURCE_BYTES) fail(ERR.INVALID_INPUT, { field: 'filePath' });
  const bytes = fs.readFileSync(filePath); const digest = sha256(bytes);
  const blob = path.join(paths(root).sources, digest);
  if (!fs.existsSync(blob)) fs.writeFileSync(blob, bytes, { mode: 0o444 });
  return engineFor(root, now).registerSource(actor, {
    digest, storageRef: `local:sources/${digest}`, sourceKind, sourceVersion, originalLanguage, accessClassification, locatorCapabilities,
  });
}

export function completeExtraction(root, { actorId, sourceId, now }) {
  engineFor(root, now).completeExtraction(getActor(root, actorId), { sourceId });
}
export function saveDraft(root, { actorId, now, ...args }) {
  return engineFor(root, now).saveDraft(getActor(root, actorId), args);
}
export function validateDrafts(root, { actorId, ids, now }) {
  return engineFor(root, now).validateDrafts(getActor(root, actorId), { ids });
}
export function markReviewReady(root, { actorId, targetIds, protocolId, now }) {
  return engineFor(root, now).markReviewReady(getActor(root, actorId), { targetIds, protocolId });
}
export function review(root, { actorId, requestId, decision, reason, now }) {
  const { selfReview, ...out } = engineFor(root, now).review(getActor(root, actorId), { requestId, decision, reason });
  return selfReview ? { ...out, selfReview } : out;
}

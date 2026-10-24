// Canonical commit (Publisher service principal) and deterministic read-model generation.
import fs from 'node:fs';
import path from 'node:path';
import { validateRecordSet, resolveTopicNavigation } from '../../validator/src/index.js';
import { ERR, fail } from './errors.js';
import { sha256, canonicalJson } from './ids.js';
import {
  paths, key, getActor, requireService, audit, putDraft, getDraft, canonicalManifest, canonicalRecords,
  writeJsonAtomic, readJson, readJsonIf,
} from './store.js';
import { contentHash } from './workflow.js';

const nowIso = (now) => (now ? now() : new Date().toISOString());
export const READ_MODEL_RULESET = 'p1-wp3-readmodel-v1';

/** Commit an approved batch to canonical. Idempotent per key; exact revision + content hash pinned by review. */
export function commit(root, { actorId, snapshotId, idempotencyKey, now }) {
  const actor = getActor(root, actorId); requireService(actor, 'commit');
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) fail(ERR.INVALID_INPUT, { field: 'idempotencyKey' });
  const P = paths(root);
  const idem = readJsonIf(P.idempotency, {});
  const payloadHash = sha256(canonicalJson({ op: 'commit', snapshotId }));
  if (idem[idempotencyKey]) {
    if (idem[idempotencyKey].payloadHash !== payloadHash) fail(ERR.IDEMPOTENCY_CONFLICT);
    return { ...idem[idempotencyKey].result, replayed: true };
  }
  const snapshot = getDraft(root, snapshotId);
  if (!snapshot || snapshot.type !== 'ReviewSnapshot') fail(ERR.NOT_FOUND, { recordId: snapshotId });
  if (snapshot.decision !== 'APPROVE' || snapshot.validationResult !== 'PASS') fail(ERR.APPROVAL_REQUIRED, { recordId: snapshotId });
  const req = fs.readdirSync(P.reviews).map((f) => readJson(path.join(P.reviews, f))).find((r) => r.snapshotId === snapshotId);
  if (!req) fail(ERR.APPROVAL_REQUIRED, { recordId: snapshotId });
  const at = nowIso(now);
  const batch = req.targets.map((p) => {
    const latest = getDraft(root, p.id);
    if (!latest || latest.revision !== p.revision || contentHash(latest) !== p.contentHash) fail(ERR.REVISION_CONFLICT, { recordId: p.id, pinnedRevision: p.revision });
    if (latest.workflowState !== 'APPROVED') fail(ERR.APPROVAL_REQUIRED, { recordId: p.id });
    return { ...latest, workflowState: 'COMMITTED', updatedAt: at };
  });
  // The ReviewSnapshot is the decision record itself (assumption B2): committed alongside its targets.
  batch.push({ ...snapshot, workflowState: 'COMMITTED', updatedAt: at });
  const candidate = [...canonicalRecords(root), ...batch];
  const check = validateRecordSet(candidate);
  if (!check.valid) fail(ERR.VALIDATION_FAILED, { codes: [...new Set(check.issues.map((i) => i.code))] });

  const m = canonicalManifest(root);
  for (const r of batch) writeJsonAtomic(path.join(P.canonical, `${key(r.id, r.revision)}.json`), r);
  const keys = batch.map((r) => key(r.id, r.revision)).sort();
  const next = {
    canonicalRevision: m.canonicalRevision + 1,
    records: [...new Set([...m.records, ...keys])].sort(),
    history: [...m.history, { canonicalRevision: m.canonicalRevision + 1, snapshotRef: key(snapshotId, 1), keys, committedAt: at, committedBy: actor.id }],
  };
  writeJsonAtomic(P.canonicalManifest, next); // commit point: records not listed here are not canonical
  for (const r of batch) putDraft(root, r); // workflow mirror (≈ Sheets status), canonical stays authority
  const result = { canonicalRevision: next.canonicalRevision, keys };
  writeJsonAtomic(P.idempotency, { ...idem, [idempotencyKey]: { payloadHash, result } });
  audit(root, { at, actor: actor.id, action: 'commit', target: `canonical@${next.canonicalRevision}`, outcome: 'OK' });
  return result;
}

const isPublic = (r) => r.accessClassification === undefined || r.accessClassification === 'PUBLIC';
const known = (vs) => (vs && vs.state === 'KNOWN' && (typeof vs.value === 'string' || typeof vs.value === 'number') ? String(vs.value) : undefined);
const texts = (lt) => (lt ? Object.keys(lt).sort().map((lang) => ({ lang, text: lt[lang] })) : []);

/** Public field allowlist per type. Never includes storageRef, provenance actors or non-public excerpts. */
function searchDoc(r, byKey) {
  const t = [];
  const add = (text, lang) => { if (text) t.push(lang ? { lang, text } : { text }); };
  switch (r.type) {
    case 'Finding': t.push(...texts(r.explanation)); add(known(r.context)); break;
    case 'Result': add(r.measure); add(known(r.value)); add(known(r.unit)); add(known(r.context)); break;
    case 'Claim': {
      add(r.epistemicStatus);
      const cf = byKey.get(key(r.claimFrameRef.id, r.claimFrameRef.revision));
      if (cf) { add(cf.predicateId); for (const p of [...cf.participants, ...cf.qualifiers]) add(known(p.literal)); }
      break;
    }
    case 'Synthesis': add(r.method); break;
    case 'ResearchQuestion': t.push(...texts(r.question)); break;
    case 'Study': add(known(r.design)); add(known(r.context)); break;
    case 'Evidence': add(r.locator.value); if (isPublic(r)) add(known(r.originalExcerpt)); break;
    case 'SourceAsset': add(r.sourceKind); add(r.sourceVersion); break;
    default: return undefined; // not searchable in Phase 1 (still counted in completeness check)
  }
  return { id: r.id, type: r.type, revision: r.revision, topicIds: r.topicIds || [], text: t };
}

function traceEntry(r, byKey) {
  const evidence = (r.evidenceRefs || []).map((ref) => {
    const ev = byKey.get(key(ref.id, ref.revision));
    if (!ev || ev.type !== 'Evidence') fail(ERR.READ_MODEL_INCOMPLETE, { recordId: r.id, missing: key(ref.id, ref.revision) });
    const src = byKey.get(key(ev.sourceAssetRef.id, ev.sourceAssetRef.revision));
    if (!src) fail(ERR.READ_MODEL_INCOMPLETE, { recordId: ev.id, missing: key(ev.sourceAssetRef.id, ev.sourceAssetRef.revision) });
    return {
      evidence: { id: ev.id, revision: ev.revision, locator: ev.locator, accessClassification: ev.accessClassification, ...(isPublic(ev) && known(ev.originalExcerpt) ? { excerpt: known(ev.originalExcerpt) } : {}) },
      studies: ev.studyRefs.map((s) => ({ id: s.id, revision: s.revision })),
      sourceAsset: { id: src.id, revision: src.revision, sourceKind: src.sourceKind, sourceVersion: src.sourceVersion, hash: src.hash, originalLanguage: src.originalLanguage, accessClassification: src.accessClassification },
    };
  });
  return { id: r.id, type: r.type, revision: r.revision, evidence };
}

/**
 * Build read models for the current canonical revision, then switch ACTIVE only after a completeness check.
 * Any failure leaves the previous ACTIVE (last-known-good) untouched.
 * opts.faultInject = 'beforeActivate' simulates a crash for tests.
 */
export function buildReadModel(root, { actorId, now, faultInject } = {}) {
  const actor = getActor(root, actorId); requireService(actor, 'publish');
  const P = paths(root); const m = canonicalManifest(root);
  const all = canonicalRecords(root);
  const byKey = new Map(all.map((r) => [key(r.id, r.revision), r]));
  const latest = new Map();
  for (const r of all) if (!latest.has(r.id) || latest.get(r.id).revision < r.revision) latest.set(r.id, r);
  const current = [...latest.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  const search = []; const trace = []; const topics = {}; const excluded = [];
  for (const r of current) {
    const doc = searchDoc(r, byKey);
    if (doc) search.push(doc); else excluded.push({ id: r.id, type: r.type, reason: 'NOT_SEARCHABLE_TYPE' });
    if (Array.isArray(r.evidenceRefs)) trace.push(traceEntry(r, byKey));
    for (const tid of r.topicIds || []) for (const t of [tid, ...resolveTopicNavigation([tid], r.schemaVersion)]) (topics[t] ||= []).push(key(r.id, r.revision));
  }
  for (const t of Object.keys(topics)) topics[t] = [...new Set(topics[t])].sort();
  if (search.length + excluded.length !== current.length) fail(ERR.READ_MODEL_INCOMPLETE, { reason: 'count-mismatch' });

  const files = { 'search.json': { items: search }, 'trace.json': { items: trace }, 'topics.json': { topics }, 'excluded.json': { items: excluded } };
  const hashes = Object.fromEntries(Object.entries(files).map(([f, v]) => [f, sha256(canonicalJson(v))]));
  const id = `rm-${m.canonicalRevision}-${sha256(canonicalJson(hashes)).slice(0, 12)}`;
  const finalDir = path.join(P.readModels, id);
  const at = nowIso(now);
  const manifest = { readModelId: id, canonicalRevision: m.canonicalRevision, ruleSet: READ_MODEL_RULESET, builtAt: at, counts: { current: current.length, searchable: search.length, excluded: excluded.length, traced: trace.length }, files: hashes };
  if (!fs.existsSync(finalDir)) {
    const tmp = `${finalDir}.tmp-${process.pid}`;
    for (const [f, v] of Object.entries(files)) writeJsonAtomic(path.join(tmp, f), v);
    writeJsonAtomic(path.join(tmp, 'manifest.json'), manifest);
    for (const [f, h] of Object.entries(hashes)) if (sha256(canonicalJson(readJson(path.join(tmp, f)))) !== h) fail(ERR.READ_MODEL_INCOMPLETE, { file: f });
    if (faultInject === 'beforeActivate') {
      audit(root, { at, actor: actor.id, action: 'read-model:build', target: id, outcome: 'FAILED' });
      fail(ERR.READ_MODEL_INCOMPLETE, { reason: 'fault-injected' });
    }
    fs.renameSync(tmp, finalDir);
  }
  writeJsonAtomic(P.active, { readModelId: id, canonicalRevision: m.canonicalRevision, activatedAt: at });
  audit(root, { at, actor: actor.id, action: 'publish', target: id, outcome: 'OK' });
  return manifest;
}

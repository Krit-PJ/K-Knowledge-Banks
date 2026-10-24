// Local file store. Folder roles stand in for the approved architecture (P1-WP3, user-approved local files):
//   sources/     ≈ Drive raw SourceAsset vault (immutable, content-addressed)
//   workspace/   ≈ draft records (operational, not canonical)
//   workflow/    ≈ Sheets operational state: actors, review requests, idempotency, audit log
//   canonical/   ≈ GitHub canonical structured knowledge (publication authority)
//   read-models/ ≈ generated read models (rebuildable from canonical)
import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic, readJson, readJsonIf, listJson } from './fsx.js';
import { ERR, fail } from './errors.js';

export const key = (id, rev) => `${id}@${rev}`;
export function paths(root) {
  const p = (...s) => path.join(root, ...s);
  return {
    root, sources: p('sources'), workspace: p('workspace', 'records'), actors: p('workflow', 'actors.json'),
    reviews: p('workflow', 'reviews'), idempotency: p('workflow', 'idempotency.json'), audit: p('workflow', 'audit.jsonl'),
    canonical: p('canonical', 'records'), canonicalManifest: p('canonical', 'manifest.json'),
    readModels: p('read-models'), active: p('read-models', 'ACTIVE.json'),
  };
}

/**
 * actors: [{ id, kind: 'human'|'service'|'ai', roles: [...], permissions?: [...] }]
 * NOTE: local registry only — identity is NOT authenticated until OD-04 (auth provider) is decided.
 */
export function initStore(root, { actors }) {
  const P = paths(root);
  for (const d of [P.sources, P.workspace, P.reviews, P.canonical, P.readModels]) fs.mkdirSync(d, { recursive: true });
  if (!fs.existsSync(P.actors)) writeJsonAtomic(P.actors, { actors });
  if (!fs.existsSync(P.canonicalManifest)) writeJsonAtomic(P.canonicalManifest, { canonicalRevision: 0, records: [], history: [] });
  return P;
}

export function getActor(root, actorId) {
  const a = readJson(paths(root).actors).actors.find((x) => x.id === actorId);
  if (!a) fail(ERR.UNAUTHENTICATED);
  return a;
}
export function requireRole(actor, role) {
  if (actor.kind !== 'human' || !actor.roles.includes(role)) fail(ERR.FORBIDDEN, { actorId: actor.id, required: role });
}
export function requireService(actor, permission) {
  if (actor.kind !== 'service' || !(actor.permissions || []).includes(permission)) fail(ERR.FORBIDDEN, { actorId: actor.id, required: permission });
}

export function audit(root, entry) {
  const P = paths(root);
  const seq = fs.existsSync(P.audit) ? fs.readFileSync(P.audit, 'utf8').split('\n').filter(Boolean).length + 1 : 1;
  fs.appendFileSync(P.audit, `${JSON.stringify({ seq, ...entry })}\n`);
}

// ---- workspace (drafts): one file per id@revision; latest revision = current draft ----
export function putDraft(root, record) { writeJsonAtomic(path.join(paths(root).workspace, `${key(record.id, record.revision)}.json`), record); }
export function draftRevisions(root, id) {
  return listJson(paths(root).workspace).filter((f) => f.startsWith(`${id}@`)).map((f) => Number(f.slice(id.length + 1, -5))).sort((a, b) => a - b);
}
export function getDraft(root, id, revision) {
  const revs = draftRevisions(root, id);
  const rev = revision ?? revs[revs.length - 1];
  const f = path.join(paths(root).workspace, `${key(id, rev)}.json`);
  return fs.existsSync(f) ? readJson(f) : undefined;
}
export function latestDrafts(root) {
  const latest = new Map();
  for (const f of listJson(paths(root).workspace)) {
    const [id, rev] = f.slice(0, -5).split('@'); const r = Number(rev);
    if (!latest.has(id) || latest.get(id) < r) latest.set(id, r);
  }
  return [...latest].sort().map(([id, r]) => readJson(path.join(paths(root).workspace, `${key(id, r)}.json`)));
}

// ---- canonical ----
export const canonicalManifest = (root) => readJson(paths(root).canonicalManifest);
export function canonicalRecords(root) {
  const P = paths(root);
  return canonicalManifest(root).records.map((k) => readJson(path.join(P.canonical, `${k}.json`)));
}
export { readJson, readJsonIf, writeJsonAtomic };

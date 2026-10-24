// Read side: search and evidence trace from the ACTIVE read model only (never from drafts).
import path from 'node:path';
import { ERR, fail } from './errors.js';
import { paths, canonicalManifest, readJson, readJsonIf } from './store.js';

const norm = (s) => String(s).normalize('NFC').toLocaleLowerCase('th');
function active(root) {
  const P = paths(root); const a = readJsonIf(P.active, null);
  const canonicalRevision = canonicalManifest(root).canonicalRevision;
  if (!a) return { dir: null, readModelRevision: null, canonicalRevision, stale: true };
  return { dir: path.join(P.readModels, a.readModelId), readModelId: a.readModelId, readModelRevision: a.canonicalRevision, canonicalRevision, stale: canonicalRevision > a.canonicalRevision };
}

/** Substring search (works for Thai without word segmentation). Deterministic order, bounded limit. */
export function search(root, { query, topicId, limit = 20 }) {
  if (typeof query !== 'string' || query.trim().length === 0 || query.length > 200) fail(ERR.INVALID_INPUT, { field: 'query' });
  const n = Math.min(Math.max(1, limit | 0), 100);
  const a = active(root);
  const meta = { canonicalRevision: a.canonicalRevision, readModelRevision: a.readModelRevision, readModelId: a.readModelId ?? null, stale: a.stale };
  if (!a.dir) return { items: [], ...meta };
  const q = norm(query.trim());
  const topicKeys = topicId ? new Set(readJson(path.join(a.dir, 'topics.json')).topics[topicId] || []) : null;
  const items = readJson(path.join(a.dir, 'search.json')).items
    .filter((d) => !topicKeys || topicKeys.has(`${d.id}@${d.revision}`))
    .map((d) => ({ d, matched: d.text.filter((t) => norm(t.text).includes(q)) }))
    .filter((x) => x.matched.length > 0)
    .slice(0, n)
    .map(({ d, matched }) => ({ id: d.id, type: d.type, revision: d.revision, topicIds: d.topicIds, matched }));
  return { items, ...meta };
}

export function trace(root, { id }) {
  const a = active(root);
  if (!a.dir) fail(ERR.NOT_FOUND, { recordId: id });
  const entry = readJson(path.join(a.dir, 'trace.json')).items.find((t) => t.id === id);
  if (!entry) fail(ERR.NOT_FOUND, { recordId: id });
  return { ...entry, canonicalRevision: a.canonicalRevision, readModelRevision: a.readModelRevision, stale: a.stale };
}

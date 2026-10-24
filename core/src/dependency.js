// Dependency staleness (Formal Schema Binding rule 6): when a referenced record gets a newer canonical
// revision, dependents of the old revision become stale and need re-validation/re-review.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isRef = (v) => isObj(v) && typeof v.id === 'string' && typeof v.type === 'string' && Number.isInteger(v.revision) && Object.keys(v).length === 3;
const k = (id, rev) => `${id}@${rev}`;

/** All RecordRefs inside a record (excluding the record itself), with JSON paths. */
export function refsOf(record) {
  const out = [];
  const walk = (v, p) => {
    if (p !== '' && isRef(v)) { out.push({ ref: v, path: p }); return; }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}/${i}`));
    else if (isObj(v)) for (const f of Object.keys(v)) walk(v[f], `${p}/${f}`);
  };
  walk(record, '');
  return out;
}
export function latestRevisions(records) {
  const m = new Map();
  for (const r of records) if (!m.has(r.id) || m.get(r.id) < r.revision) m.set(r.id, r.revision);
  return m;
}

/**
 * Stale set over the current (latest-revision) records:
 *  - REF_SUPERSEDED: the record references id@rev while a newer revision of id exists
 *  - DEPENDS_ON_STALE: the record references (or is an output of) a record that is stale
 * Conservative by design: staleness asks for human re-review, it never edits canonical data.
 */
export function computeStale(records) {
  const latest = latestRevisions(records);
  const current = records.filter((r) => latest.get(r.id) === r.revision);
  const deps = new Map(); // current record key -> [{id, key}]
  for (const r of current) deps.set(k(r.id, r.revision), refsOf(r).map(({ ref }) => ({ id: ref.id, key: k(ref.id, ref.revision) })));
  // an output of a DerivationRun depends on that run
  for (const run of current.filter((r) => r.type === 'DerivationRun')) {
    for (const o of run.outputRefs) {
      const ok = k(o.id, o.revision);
      if (deps.has(ok)) deps.get(ok).push({ id: run.id, key: k(run.id, run.revision) });
    }
  }
  const stale = new Map();
  for (const r of current) {
    const via = deps.get(k(r.id, r.revision)).filter((d) => latest.has(d.id) && Number(d.key.split('@')[1]) < latest.get(d.id)).map((d) => d.key);
    if (via.length) stale.set(r.id, { id: r.id, type: r.type, revision: r.revision, reason: 'REF_SUPERSEDED', via: [...new Set(via)].sort() });
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of current) {
      if (stale.has(r.id)) continue;
      const via = deps.get(k(r.id, r.revision)).filter((d) => stale.has(d.id) && d.id !== r.id).map((d) => d.key);
      if (via.length) { stale.set(r.id, { id: r.id, type: r.type, revision: r.revision, reason: 'DEPENDS_ON_STALE', via: [...new Set(via)].sort() }); changed = true; }
    }
  }
  return [...stale.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** References from a new batch to revisions already superseded in canonical (and not superseded by the batch itself). */
export function staleReferences(batch, canonical) {
  const latest = latestRevisions([...canonical, ...batch]);
  const out = [];
  for (const r of batch) for (const { ref, path } of refsOf(r)) {
    if (latest.has(ref.id) && ref.revision < latest.get(ref.id)) out.push({ recordId: r.id, path, ref: k(ref.id, ref.revision) });
  }
  return out;
}

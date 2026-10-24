// Test helpers for the Apps Script backend: load global script files into an isolated vm context (no require,
// no process, no network — like Apps Script) and an in-memory store that mimics Drive JSON round-trips.
import fs from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../', import.meta.url);
export const readScript = (name) => fs.readFileSync(new URL(name, dir), 'utf8');

/** Evaluate the given Apps Script files (in order) in one fresh global context; returns the context. */
export function loadScripts(...names) {
  const ctx = vm.createContext({ console });
  for (const n of names) vm.runInContext(readScript(n), ctx, { filename: n });
  return ctx;
}
/** Plain-realm deep copy (cross-realm objects from vm fail deepStrictEqual prototype checks). */
export const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** In-memory engine store; every read/write is a JSON round-trip like a Drive file. */
export function memStore(canonical = []) {
  const drafts = new Map(); const reviews = new Map(); const audit = [];
  const revsOf = (id) => [...drafts.values()].filter((r) => r.id === id).map((r) => r.revision).sort((a, b) => a - b);
  return {
    drafts, reviews, audit,
    store: {
      putDraft: (r) => { drafts.set(`${r.id}@${r.revision}`, plain(r)); },
      getDraft: (id, rev) => { const revs = revsOf(id); const r = rev ?? revs[revs.length - 1]; return plain(drafts.get(`${id}@${r}`)); },
      draftRevisions: (id) => revsOf(id),
      latestDrafts: () => [...new Set([...drafts.values()].map((r) => r.id))].sort().map((id) => { const revs = revsOf(id); return plain(drafts.get(`${id}@${revs[revs.length - 1]}`)); }),
      canonicalRecords: () => plain(canonical),
      getReview: (id) => plain(reviews.get(id)),
      putReview: (r) => { reviews.set(r.requestId, plain(r)); },
      audit: (e) => { audit.push(plain(e)); },
    },
  };
}
/** Deterministic clock + UUID v7 generator for tests. */
export function testClock(start = Date.parse('2026-10-25T00:00:00.000Z')) {
  let t = start; let n = 0;
  const hex = (v, w) => v.toString(16).padStart(w, '0');
  return {
    now: () => new Date(t++).toISOString(),
    newId: () => { const ms = t++; n += 1; const h = hex(ms, 12); return `${h.slice(0, 8)}-${h.slice(8, 12)}-7000-8000-${hex(n, 12)}`; },
  };
}
export const codeOf = (fn) => { try { fn(); } catch (e) { return e && e.code ? e.code : `UNEXPECTED:${e && e.message}`; } return 'NO_ERROR'; };

#!/usr/bin/env node
// KEKB local slice CLI (P1-WP3). Usage:
//   node core/bin/kekb.js <command> --store <dir> [--actor <actorId>] [--args <file.json>]
// Commands: init | intake | extract | draft | validate | review-ready | review | commit | publish | search | trace
// --args points to a JSON file with the operation parameters (same names as the core API).
// Output: JSON on stdout. Exit 0 = ok, 1 = domain error (stable code), 2 = usage error.
// NOTE: --actor is NOT authenticated (local registry only) until the auth provider decision (OD-04).
import fs from 'node:fs';
import * as k from '../src/index.js';

const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const usage = () => { process.stderr.write('usage: kekb <command> --store <dir> [--actor <id>] [--args <file.json>]\n'); process.exit(2); };
if (!cmd || !opt.store) usage();
let args = {};
try { if (opt.args) args = JSON.parse(fs.readFileSync(opt.args, 'utf8')); } catch { usage(); }
const a = { ...args, actorId: opt.actor };
const ops = {
  init: () => k.initStore(opt.store, { actors: args.actors }) && { initialized: true },
  intake: () => k.intakeSource(opt.store, a),
  extract: () => k.completeExtraction(opt.store, a) ?? { ok: true },
  draft: () => k.saveDraft(opt.store, a),
  validate: () => k.validateDrafts(opt.store, a),
  'review-ready': () => k.markReviewReady(opt.store, a),
  review: () => k.review(opt.store, a),
  commit: () => k.commit(opt.store, a),
  publish: () => k.buildReadModel(opt.store, a),
  search: () => k.search(opt.store, args),
  trace: () => k.trace(opt.store, args),
};
if (!ops[cmd]) usage();
try {
  process.stdout.write(`${JSON.stringify(ops[cmd](), null, 2)}\n`);
} catch (e) {
  if (e instanceof k.KekbError) { process.stdout.write(`${JSON.stringify({ error: e.toJSON() }, null, 2)}\n`); process.exit(1); }
  process.stdout.write(`${JSON.stringify({ error: { code: 'INTERNAL' } })}\n`); process.exit(1); // no stack/secrets
}

#!/usr/bin/env node
// Usage: node validator/bin/kekb-validate.js <dir-or-file>...
// Validates canonical record files (*.json) as one record set. Output: JSON report on stdout.
// Exit codes: 0 = valid, 1 = validation issues, 2 = usage/IO error.
import fs from 'node:fs';
import path from 'node:path';
import { parseRecordText, validateRecordSet } from '../src/index.js';

const args = process.argv.slice(2);
if (args.length === 0) { process.stderr.write('usage: kekb-validate <dir-or-file>...\n'); process.exit(2); }

const files = [];
const collect = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const e of fs.readdirSync(p).sort()) collect(path.join(p, e));
  else if (p.endsWith('.json')) files.push(p);
};
try { args.forEach(collect); } catch { process.stderr.write('error: cannot read input path\n'); process.exit(2); }

const records = []; const preIssues = [];
for (const f of files) {
  const label = path.relative(process.cwd(), f).split(path.sep).join('/');
  const { record, issues } = parseRecordText(fs.readFileSync(f), label);
  preIssues.push(...issues);
  if (record !== undefined) records.push(record);
}
const result = validateRecordSet(records, { preIssues });
process.stdout.write(`${JSON.stringify({ valid: result.valid, files: files.length, stats: result.stats, issues: result.issues }, null, 2)}\n`);
process.exit(result.valid ? 0 : 1);

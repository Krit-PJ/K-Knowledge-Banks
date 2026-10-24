// Executable golden runner for P1-WP2 (GT-01..06,10,14..17 + RC1 compatibility).
// Expected outputs live in fixtures/golden/records/cases.json (PENDING_HUMAN_CONFIRMATION).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CODES, parseRecordText, validateRecordSet, checkPublication, countIndependentStudies,
  isApprovedFact, resolveTopicNavigation, areMeasuresComparable,
} from '../src/index.js';

const ROOT = new URL('../../fixtures/golden/records/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('cases.json', ROOT), 'utf8'));
const phase2 = JSON.parse(fs.readFileSync(new URL('phase2-cases.json', ROOT), 'utf8'));
const SAFE_KEYS = new Set(['code', 'recordId', 'revision', 'recordType', 'path', 'keyword', 'file', 'role']);
const KNOWN_CODES = new Set(Object.values(CODES));

function load(dir) {
  const abs = new URL(`${dir}/`, ROOT);
  const records = []; const preIssues = [];
  for (const f of fs.readdirSync(abs).sort()) {
    const { record, issues } = parseRecordText(fs.readFileSync(new URL(f, abs)), `${dir}/${f}`);
    preIssues.push(...issues); records.push(record);
  }
  return { records, preIssues };
}
const find = (records, ref) => records.find((r) => r.id === ref.id && r.revision === ref.revision && r.type === ref.type);
const count = (records, type) => records.filter((r) => r.type === type).length;

for (const c of [...manifest.cases, ...phase2.cases]) {
  test(`${c.id} ${c.variant}`, () => {
    const { records, preIssues } = load(c.dir);
    const e = c.expected; const op = c.operation;
    const result = validateRecordSet(records, { preIssues });
    const codes = new Set(result.issues.map((i) => i.code));

    // safe, stable issue shape on every case
    for (const issue of result.issues) {
      assert.ok(KNOWN_CODES.has(issue.code), `unknown code ${issue.code}`);
      for (const k of Object.keys(issue)) assert.ok(SAFE_KEYS.has(k), `unsafe issue key ${k}`);
    }
    if (e.mustNotEcho) assert.ok(!JSON.stringify(result.issues).includes(e.mustNotEcho), 'issue output echoed input value');
    // determinism: reversed input order gives identical issues
    assert.deepEqual(validateRecordSet([...records].reverse(), { preIssues }).issues, result.issues);

    let publish;
    if (op.kind === 'publish') publish = checkPublication(records, op.target);
    const publishCodes = new Set((publish?.issues || []).map((i) => i.code));

    if (e.validation === 'PASS') assert.deepEqual(result.issues, [], 'expected validation PASS');
    else assert.equal(result.valid, false, 'expected validation FAIL');
    for (const code of e.codes || []) assert.ok(codes.has(code) || publishCodes.has(code), `missing expected code ${code}`);
    if (e.publishBlocked) {
      assert.equal(publish.publishable, false);
      if (e.validation === 'FAIL') assert.ok(publishCodes.has(CODES.VALIDATION_FAILED));
    }
    if (e.publishable === true) assert.equal(publish.publishable, true);

    if (e.studyCount !== undefined) assert.equal(count(records, 'Study'), e.studyCount);
    if (e.reportCount !== undefined) assert.equal(count(records, 'Report'), e.reportCount);
    if (op.kind === 'independence') assert.equal(countIndependentStudies(records, op.evidenceRefs).independentStudyCount, e.independentStudyCount);
    if (e.recordTypes) {
      const ids = new Set();
      for (const t of e.recordTypes) { const r = records.filter((x) => x.type === t); assert.equal(r.length, 1); ids.add(r[0].id); }
      assert.equal(ids.size, e.recordTypes.length, 'Result/Finding/Claim must stay distinct records');
    }
    if (op.kind === 'claimFrame') {
      const cf = records.find((r) => r.id === op.recordId);
      assert.deepEqual(cf.participants.map((p) => p.roleId), e.preservedRoles);
      assert.equal(cf.participants.length > 3, !e.flattenedToTriple);
    }
    if (op.kind === 'approvedFact') assert.equal(isApprovedFact(records, op.target), e.approvedFact);
    if (op.kind === 'navigation') {
      const r = find(records, op.target); const before = JSON.stringify(r.topicIds);
      assert.deepEqual(resolveTopicNavigation(r.topicIds, r.schemaVersion), e.parentNavigation);
      assert.equal(JSON.stringify(r.topicIds), before, 'canonical topic IDs must not be rewritten');
    }
    if (op.kind === 'measures') {
      const [a, b] = op.pair.map((p) => find(records, p));
      assert.equal(areMeasuresComparable(a, b), !e.mergedMeasures ? false : true);
      assert.equal(count(records, 'Result'), 2, 'measures must not be merged');
      const st = find(records, op.studyRef);
      assert.equal(st.design.state, e.preservedStates.design); assert.equal(st.context.state, e.preservedStates.context);
    }
    if (op.kind === 'reproducible') {
      assert.deepEqual(validateRecordSet(records, { preIssues }), result, 'repeat run must be identical');
      const f = find(records, op.target); const dr = records.find((r) => r.id === f.provenance.derivationRunRef.id);
      for (const k of ['engine', 'engineVersion', 'ruleSet', 'ruleVersion', 'softwareVersion', 'inputSnapshot', 'parameters', 'inputRefs', 'outputRefs']) assert.ok(dr[k] !== undefined, `DerivationRun.${k}`);
      assert.equal(typeof dr.parameters.metric, 'string'); assert.ok(dr.parameters.timeWindow.from < dr.parameters.timeWindow.to);
    }
  });
}

test('phase 2 golden manifest is human-confirmed regression authority', () => {
  assert.equal(phase2.confirmationStatus, 'CONFIRMED');
  assert.equal(phase2.confirmation.confirmedBy, 'User');
});

test('golden manifest is human-confirmed regression authority', () => {
  assert.equal(manifest.confirmationStatus, 'CONFIRMED');
  assert.equal(manifest.confirmation.confirmedBy, 'User');
  assert.ok(manifest.confirmation.confirmedAt && manifest.confirmation.evidence);
});

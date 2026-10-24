// Deterministic KEKB record-set validator: JSON Schema (per schemaVersion) + cross-record rules.
// AI-independent, no network, no clock. Same input → same issues in the same order.
import { CODES } from './codes.js';
import { loadContracts, SUPPORTED_VERSIONS } from './contracts.js';

const keyOf = (id, revision) => `${id}@${revision}`;
const APPROVED_STATES = new Set(['APPROVED', 'COMMITTED', 'PUBLISHED']);

// Allowed target types per reference field (Formal Schema Binding v1.0-RC1, record-type table).
// Fields not listed (sourceRefs, inputRefs, outputRefs, inputDatasetRefs, recordRef,
// evidenceRelationRefs, targetRefs) are not type-constrained by the binding.
const REF_FIELD_TYPES = {
  sourceAssetRef: ['SourceAsset'], reportRef: ['Report'], reportRefs: ['Report'],
  studyRef: ['Study'], studyRefs: ['Study'], evidenceRefs: ['Evidence'], resultRefs: ['Result'],
  analysisRunRef: ['AnalysisRun'], claimFrameRef: ['ClaimFrame'], derivationRunRef: ['DerivationRun'],
  protocolRef: ['ReviewProtocol'], problemRef: ['ResearchProblem'], goalRef: ['ResearchGoal'],
  goalRefs: ['ResearchGoal'], objectiveRef: ['ResearchObjective'], objectiveRefs: ['ResearchObjective'],
  questionRef: ['ResearchQuestion'], questionRefs: ['ResearchQuestion'], hypothesisRefs: ['Hypothesis'],
  evidenceRequirementRefs: ['EvidenceRequirement'], alignmentRefs: ['EvidenceAlignment'],
  derivedClaimRefs: ['Claim'], claimRefs: ['Claim'],
};
const TYPE_FIELD_OVERRIDES = {
  RelationAssertion: { targetRef: ['Claim', 'Hypothesis'] },
  EvidenceAlignment: { evidenceRef: ['Evidence', 'Study'], requirementRef: ['EvidenceRequirement', 'ResearchQuestion'] },
  Synthesis: { targetRef: ['ResearchQuestion', 'ResearchObjective'] },
  EvidenceRequirement: { targetRef: ['ResearchQuestion', 'ResearchObjective'] },
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isRef = (v) => isObj(v) && typeof v.id === 'string' && typeof v.type === 'string' && Number.isInteger(v.revision)
  && Object.keys(v).length === 3;

function walk(value, path, visit) {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}/${i}`, visit));
  else if (isObj(value)) for (const k of Object.keys(value)) walk(value[k], `${path}/${k}`, visit);
}
const lastField = (path) => path.split('/').filter((s) => s !== '' && !/^\d+$/.test(s)).pop();

function identity(record) {
  return isObj(record)
    ? { recordId: typeof record.id === 'string' ? record.id : undefined,
        revision: Number.isInteger(record.revision) ? record.revision : undefined,
        recordType: typeof record.type === 'string' ? record.type : undefined }
    : {};
}

function mapSchemaErrors(record, errors) {
  const out = []; const seen = new Set();
  for (const e of errors) {
    let path = e.instancePath || '';
    if (e.keyword === 'required') path = `${path}/${e.params.missingProperty}`;
    let code = CODES.SCHEMA_VIOLATION;
    if (/^\/evidenceRefs(\/|$)/.test(path) && ['minItems', 'required', 'type'].includes(e.keyword)) code = CODES.MISSING_EVIDENCE;
    else if (record.type === 'Evidence' && /^\/locator(\/|$)/.test(path)) code = CODES.MISSING_LOCATOR;
    const k = `${code}|${path}|${e.keyword}`;
    if (seen.has(k)) continue; seen.add(k);
    out.push({ code, path, keyword: e.keyword });
  }
  return out;
}

/**
 * Validate a set of canonical records.
 * @param {object[]} records parsed record objects
 * @param {{preIssues?: object[]}} [opts] issues from the strict loader
 * @returns {{valid:boolean, issues:object[], stats:object}}
 */
export function validateRecordSet(records, opts = {}) {
  const { versions } = loadContracts();
  const issues = [...(opts.preIssues || [])];
  const push = (record, issue) => issues.push({ ...identity(record), ...issue });
  const index = new Map(); const idTypes = new Map(); const schemaValid = new Set();

  records.forEach((record) => {
    if (!isObj(record)) { issues.push({ code: CODES.NOT_AN_OBJECT }); return; }
    walk(record, '', (v, p) => { if (v === null) push(record, { code: CODES.NULL_NOT_ALLOWED, path: p }); });

    // identity is indexed before schema so duplicate/dangling detection still works on invalid records
    if (typeof record.id === 'string' && Number.isInteger(record.revision)) {
      const k = keyOf(record.id, record.revision);
      if (index.has(k)) push(record, { code: CODES.DUPLICATE_ID, path: '/id' }); else index.set(k, record);
      const prevType = idTypes.get(record.id);
      if (prevType && prevType !== record.type) push(record, { code: CODES.ID_TYPE_CONFLICT, path: '/type' });
      if (!prevType) idTypes.set(record.id, record.type);
    }

    if (!SUPPORTED_VERSIONS.includes(record.schemaVersion)) { push(record, { code: CODES.SCHEMA_VERSION_UNSUPPORTED, path: '/schemaVersion' }); return; }
    const contract = versions[record.schemaVersion];
    if (!contract.recordTypes.has(record.type)) { push(record, { code: CODES.UNKNOWN_RECORD_TYPE, path: '/type' }); return; }

    const topicIssues = topicRules(record, contract);
    topicIssues.forEach((i) => push(record, i));
    const validate = contract.validators[record.type];
    if (!validate(record)) {
      let mapped = mapSchemaErrors(record, validate.errors);
      // topic identity is reported with dedicated stable codes instead of generic schema errors
      if (topicIssues.length) mapped = mapped.filter((i) => !/^\/topicIds(\/|$)/.test(i.path));
      mapped.forEach((i) => push(record, i));
      if (mapped.length === 0 && topicIssues.length === 0) push(record, { code: CODES.SCHEMA_VIOLATION, path: '' });
      return;
    }
    if (topicIssues.length === 0) schemaValid.add(record);
  });

  for (const record of schemaValid) {
    refRules(record, index).forEach((i) => push(record, i));
    const contract = versions[record.schemaVersion];
    if (record.type === 'ClaimFrame') roleRules(record, contract).forEach((i) => push(record, i));
    if (record.type === 'Evidence') traceRules(record, index).forEach((i) => push(record, i));
    trendRules(record, contract, index).forEach((i) => push(record, i));
    authorityRules(record, index).forEach((i) => push(record, i));
  }

  lineageRules([...schemaValid]).forEach(({ record, issue }) => push(record, issue));

  issues.sort(compareIssues);
  const byType = {};
  for (const r of records) if (isObj(r) && typeof r.type === 'string') byType[r.type] = (byType[r.type] || 0) + 1;
  return { valid: issues.length === 0, issues, stats: { records: records.length, byType } };
}

function compareIssues(a, b) {
  const ka = [a.file || '', a.recordId || '', String(a.revision ?? ''), a.code, a.path || '', a.keyword || ''];
  const kb = [b.file || '', b.recordId || '', String(b.revision ?? ''), b.code, b.path || '', b.keyword || ''];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  return 0;
}

function topicRules(record, contract) {
  const out = [];
  if (!Array.isArray(record.topicIds) || contract.topics.size === 0) return out; // RC1: schema rejects topicIds
  const seen = new Set();
  record.topicIds.forEach((id, i) => {
    const path = `/topicIds/${i}`;
    if (seen.has(id)) { out.push({ code: CODES.DUPLICATE_TOPIC_ID, path }); return; }
    seen.add(id);
    const topic = contract.topics.get(id);
    if (!topic) { out.push({ code: CODES.UNKNOWN_TOPIC_ID, path }); return; }
    if (Array.isArray(topic.applicableTypes) && !topic.applicableTypes.includes(record.type)) out.push({ code: CODES.TOPIC_NOT_APPLICABLE, path });
  });
  return out;
}

function refRules(record, index) {
  const out = [];
  walk(record, '', (v, path) => {
    if (path === '' || !isRef(v)) return;
    const target = index.get(keyOf(v.id, v.revision));
    if (!target) { out.push({ code: CODES.DANGLING_REF, path }); return; }
    if (target.type !== v.type) { out.push({ code: CODES.REF_TYPE_MISMATCH, path }); return; }
    const field = lastField(path);
    const allowed = (TYPE_FIELD_OVERRIDES[record.type] || {})[field] || REF_FIELD_TYPES[field];
    if (allowed && !allowed.includes(v.type)) out.push({ code: CODES.REF_FIELD_TYPE_INVALID, path });
  });
  return out;
}

function roleRules(record, contract) {
  const out = []; const counts = new Map();
  for (const p of record.participants) counts.set(p.roleId, (counts.get(p.roleId) || 0) + 1);
  for (const [id, role] of contract.roles) {
    const n = counts.get(id) || 0;
    if (n < role.min || (role.max !== null && n > role.max)) out.push({ code: CODES.PARTICIPANT_ROLE_CARDINALITY, path: '/participants', role: id });
  }
  return out;
}

function traceRules(record, index) {
  const src = index.get(keyOf(record.sourceAssetRef.id, record.sourceAssetRef.revision));
  if (src && src.type === 'SourceAsset' && !src.locatorCapabilities.includes(record.locator.kind)) {
    return [{ code: CODES.LOCATOR_NOT_SUPPORTED, path: '/locator/kind' }];
  }
  return [];
}

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function trendRules(record, contract, index) {
  const out = [];
  if (!Array.isArray(record.topicIds)) return out;
  const reqs = new Set();
  for (const id of record.topicIds) for (const r of contract.topics.get(id)?.publicationRequirements || []) reqs.add(r);
  if (reqs.size === 0) return out;
  const KNOWN = new Set(['metric', 'timeWindow', 'sourceSnapshot', 'parameters', 'derivationRunRef']);
  for (const r of reqs) if (!KNOWN.has(r)) throw new Error('Vocabulary publicationRequirement not implemented by validator');

  // Binding assumption B1 (needs human confirmation): DerivationRun has no metric/timeWindow fields,
  // so they are read from DerivationRun.parameters; sourceSnapshot = DerivationRun.inputSnapshot.
  let run = record.type === 'DerivationRun' ? record : undefined;
  if (!run) {
    const ref = record.derivationRunRef || record.provenance?.derivationRunRef;
    const target = ref && index.get(keyOf(ref.id, ref.revision));
    if (target && target.type === 'DerivationRun') run = target;
  }
  if (!run) { out.push({ code: CODES.MISSING_TREND_DERIVATION_RUN, path: '/provenance/derivationRunRef' }); return out; }
  const params = isObj(run.parameters) ? run.parameters : {};
  if (reqs.has('metric') && !(typeof params.metric === 'string' && params.metric.length > 0)) {
    out.push({ code: CODES.MISSING_TREND_METRIC, path: '/parameters/metric' });
  }
  if (reqs.has('timeWindow')) {
    const tw = params.timeWindow;
    if (!isObj(tw) || tw.from === undefined || tw.to === undefined) out.push({ code: CODES.MISSING_TREND_TIME_WINDOW, path: '/parameters/timeWindow' });
    else if (!TS.test(tw.from) || !TS.test(tw.to) || !(Date.parse(tw.from) < Date.parse(tw.to))) out.push({ code: CODES.INVALID_TREND_TIME_WINDOW, path: '/parameters/timeWindow' });
  }
  // sourceSnapshot (inputSnapshot) and parameters are schema-required on DerivationRun.
  return out;
}

// Derivation lineage must be acyclic (binding rule 5): no self-cycle and no input that is a
// descendant of the run's own outputs. Semantic relation graphs (RelationAssertion etc.) may cycle.
function lineageRules(records) {
  const runs = records.filter((r) => r.type === 'DerivationRun');
  const edges = new Map(); // input id -> Set(output id), id-level lineage across revisions
  for (const run of runs) for (const i of run.inputRefs) for (const o of run.outputRefs) {
    if (!edges.has(i.id)) edges.set(i.id, new Set()); edges.get(i.id).add(o.id);
  }
  const reaches = (from, target) => {
    const seen = new Set(); const stack = [from];
    while (stack.length) {
      const n = stack.pop(); if (n === target) return true;
      if (seen.has(n)) continue; seen.add(n);
      for (const m of edges.get(n) || []) stack.push(m);
    }
    return false;
  };
  const out = [];
  for (const run of runs) {
    const cyclic = run.outputRefs.some((o) => run.inputRefs.some((i) => i.id === o.id || reaches(o.id, i.id)));
    if (cyclic) out.push({ record: run, issue: { code: CODES.DERIVATION_LINEAGE_CYCLE, path: '/outputRefs' } });
  }
  return out;
}

function approvalFor(index, id, revision) {
  let exact = false; let other = false;
  for (const r of index.values()) {
    if (r.type !== 'ReviewSnapshot' || r.decision !== 'APPROVE' || r.validationResult !== 'PASS' || !Array.isArray(r.targetRefs)) continue;
    for (const t of r.targetRefs) if (t.id === id) { if (t.revision === revision) exact = true; else other = true; }
  }
  return { exact, other };
}

// Human authority: a record cannot sit in APPROVED/COMMITTED/PUBLISHED without an approved
// ReviewSnapshot pinned to its exact revision. ReviewSnapshot itself is the decision record (exempt).
function authorityRules(record, index) {
  if (record.type === 'ReviewSnapshot' || !APPROVED_STATES.has(record.workflowState)) return [];
  const a = approvalFor(index, record.id, record.revision);
  if (a.exact) return [];
  return [{ code: a.other ? CODES.REVISION_MISMATCH : CODES.APPROVAL_REQUIRED, path: '/workflowState' }];
}

/**
 * Publication gate pre-check (rule level only; no write, no read-model manifest — Phase 2/3).
 * @returns {{publishable:boolean, issues:object[]}}
 */
export function checkPublication(records, targetRef) {
  const result = validateRecordSet(records);
  const issues = [];
  if (!result.valid) issues.push({ code: CODES.VALIDATION_FAILED });
  const index = new Map(records.filter(isObj).map((r) => [keyOf(r.id, r.revision), r]));
  const target = index.get(keyOf(targetRef.id, targetRef.revision));
  if (!target || target.type !== targetRef.type) issues.push({ code: CODES.PUBLISH_TARGET_NOT_FOUND });
  else {
    const a = approvalFor(index, targetRef.id, targetRef.revision);
    if (!a.exact) issues.push({ code: a.other ? CODES.REVISION_MISMATCH : CODES.APPROVAL_REQUIRED, recordId: targetRef.id, revision: targetRef.revision });
  }
  return { publishable: issues.length === 0, issues, validation: result };
}

/** Independent-study count: dedupe by Study, merging studies that share dependencyKeys (GT-01). */
export function countIndependentStudies(records, evidenceRefs) {
  const index = new Map(records.filter(isObj).map((r) => [keyOf(r.id, r.revision), r]));
  const studies = new Map();
  for (const ref of evidenceRefs) {
    const ev = index.get(keyOf(ref.id, ref.revision));
    if (!ev || ev.type !== 'Evidence') continue;
    for (const s of ev.studyRefs) { const st = index.get(keyOf(s.id, s.revision)); if (st && st.type === 'Study') studies.set(st.id, st); }
  }
  const parent = new Map([...studies.keys()].map((id) => [id, id]));
  const find = (x) => (parent.get(x) === x ? x : find(parent.get(x)));
  const byKey = new Map();
  for (const st of studies.values()) for (const k of st.dependencyKeys) {
    if (byKey.has(k)) parent.set(find(st.id), find(byKey.get(k))); else byKey.set(k, st.id);
  }
  const roots = new Set([...studies.keys()].map(find));
  return { studyIds: [...studies.keys()].sort(), independentStudyCount: roots.size };
}

/** A record is an approved fact only with an approved state AND a ReviewSnapshot on its exact revision. */
export function isApprovedFact(records, ref) {
  const index = new Map(records.filter(isObj).map((r) => [keyOf(r.id, r.revision), r]));
  const r = index.get(keyOf(ref.id, ref.revision));
  if (!r || !APPROVED_STATES.has(r.workflowState)) return false;
  if (r.reviewState !== undefined && !APPROVED_STATES.has(r.reviewState)) return false;
  return approvalFor(index, r.id, r.revision).exact;
}

/** Parent navigation for topic IDs (GT-16): ancestors in first-appearance order. */
export function resolveTopicNavigation(topicIds, schemaVersion = 'v1.0-RC2') {
  const { topics } = loadContracts().versions[schemaVersion];
  const out = [];
  for (const id of topicIds) {
    let t = topics.get(id);
    if (!t) throw new Error('Unknown topic ID');
    const guard = new Set([id]);
    while (t.parentId) {
      if (guard.has(t.parentId)) throw new Error('Topic hierarchy cycle');
      guard.add(t.parentId);
      if (!out.includes(t.parentId)) out.push(t.parentId);
      t = topics.get(t.parentId);
      if (!t) throw new Error('Topic parent missing');
    }
  }
  return out;
}

/** Measures are comparable only with the same measure, unit and context; never merged (GT-15). */
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  : JSON.stringify(v));
export function areMeasuresComparable(a, b) {
  return a.measure === b.measure && canonical(a.unit) === canonical(b.unit) && canonical(a.context) === canonical(b.context);
}

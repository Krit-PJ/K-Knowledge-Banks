// AC-01 contract consistency: schema ↔ vocabulary ↔ BASELINE version lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadContracts, SUPPORTED_VERSIONS } from '../src/index.js';

const { versions } = loadContracts();
test('supported versions match BASELINE (RC2 current, RC1 retained)', () => {
  const baseline = fs.readFileSync(new URL('../../docs/baseline/BASELINE.md', import.meta.url), 'utf8');
  assert.match(baseline, /Baseline version: \*\*v1\.0-RC2\*\*/);
  assert.deepEqual([...SUPPORTED_VERSIONS].sort(), ['v1.0-RC1', 'v1.0-RC2']);
});
for (const [v, c] of Object.entries(versions)) {
  test(`${v}: schemaVersion const, $id and registry version agree`, () => {
    assert.equal(c.schema.$defs.BaseRecord.properties.schemaVersion.const, v);
    assert.ok(c.schema.$id.endsWith(`kekb-record-${v}.schema.json`));
    assert.equal(c.vocabulary.registryVersion, v);
  });
  test(`${v}: WorkflowState / roles / ValueState enums match vocabulary`, () => {
    assert.deepEqual(c.schema.$defs.WorkflowState.enum, c.vocabulary.enums.WorkflowState);
    assert.deepEqual(c.schema.$defs.TypedParticipant.properties.roleId.enum, c.vocabulary.participantRoles.map((r) => r.id));
    const vs = c.schema.$defs.ValueState.oneOf;
    assert.deepEqual([vs[0].properties.state.const, ...vs[1].properties.state.enum], c.vocabulary.enums.ValueState);
  });
}
test('v1.0-RC2: TopicId enum equals topic registry; hierarchy acyclic with existing parents', () => {
  const c = versions['v1.0-RC2'];
  assert.deepEqual(c.schema.$defs.TopicId.enum, c.vocabulary.topics.map((t) => t.id));
  for (const t of c.vocabulary.topics) {
    const seen = new Set([t.id]); let p = t.parentId;
    while (p) { assert.ok(c.topics.has(p), `parent ${p} exists`); assert.ok(!seen.has(p), 'acyclic'); seen.add(p); p = c.topics.get(p).parentId; }
    assert.ok(t.labels.th && t.labels.en, 'th/en labels present');
  }
});
test('v1.0-RC1 has no topic taxonomy (ADR-0001 compatibility)', () => {
  assert.equal(versions['v1.0-RC1'].schema.$defs.TopicId, undefined);
  assert.equal(versions['v1.0-RC1'].topics.size, 0);
});

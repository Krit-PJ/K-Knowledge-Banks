// Loads the approved executable contracts (schema + vocabulary) per supported schemaVersion.
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('../../contracts/', import.meta.url);
const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, root), 'utf8'));

// Supported versions are exactly those in the BASELINE version lock (RC1 retained for compatibility).
const VERSION_FILES = {
  'v1.0-RC1': { schema: 'schema/kekb-record-v1.0-RC1.schema.json', vocabulary: 'vocabulary/v1.0-RC1.json' },
  'v1.0-RC2': { schema: 'schema/kekb-record-v1.0-RC2.schema.json', vocabulary: 'vocabulary/v1.0-RC2.json' },
};
export const SUPPORTED_VERSIONS = Object.freeze(Object.keys(VERSION_FILES));

let cache;
export function loadContracts() {
  if (cache) return cache;
  const lint = [];
  // strict mode stays on. Two Ajv-specific lints are logged, not thrown, because the contracts
  // are valid JSON Schema 2020-12 (metaschema check passes) and must not be edited here:
  //  - strictTypes: unevaluatedProperties beside allOf without sibling `type: object`
  //  - strictRequired: TypedParticipant oneOf/not.required on properties defined in the parent
  const ajv = new Ajv2020({
    strict: true, strictTypes: 'log', strictRequired: 'log', allErrors: true,
    logger: { log() {}, warn: (m) => lint.push(String(m)), error: (m) => lint.push(String(m)) },
  });
  addFormats(ajv);
  const versions = {};
  for (const [version, files] of Object.entries(VERSION_FILES)) {
    const schema = readJson(files.schema);
    if (!ajv.validateSchema(schema)) throw new Error(`Contract schema ${version} fails JSON Schema 2020-12 metaschema`);
    ajv.addSchema(schema);
    const vocabulary = readJson(files.vocabulary);
    const recordTypes = new Set(schema.$defs.RecordType.enum);
    const validators = {};
    for (const t of recordTypes) validators[t] = ajv.getSchema(`${schema.$id}#/$defs/${t}`);
    const topics = new Map((vocabulary.topics || []).map((t) => [t.id, t]));
    const roles = new Map(vocabulary.participantRoles.map((r) => [r.id, r]));
    versions[version] = { schema, vocabulary, recordTypes, validators, topics, roles };
  }
  cache = { ajv, versions, lint };
  return cache;
}

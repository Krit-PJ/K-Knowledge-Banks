// Builds backend/apps-script/Engine.js: the storage-agnostic workflow engine + deterministic validator as ONE
// Apps Script global file (`var KEKB_ENGINE = ...`). The JSON Schemas are pre-compiled with Ajv standalone at
// build time (same Ajv version and options as validator/src/contracts.js), so Apps Script never compiles code at
// runtime. Same inputs + same pinned tool versions → byte-identical output (checked by engine-build.test.js).
//
//   npm run build:apps-script            write the file
//   npm run build:apps-script -- --check exit 1 if the committed file is out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import * as esbuild from 'esbuild';
import { VERSION_FILE_MAP } from '../validator/src/contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_FILE = path.join(ROOT, 'backend', 'apps-script', 'Engine.js');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function compileValidators() {
  // Options mirror validator/src/contracts.js (strict on; two Ajv lints logged, not thrown) + standalone source.
  const ajv = new Ajv2020({
    strict: true, strictTypes: 'log', strictRequired: 'log', allErrors: true,
    logger: { log() {}, warn() {}, error() {} }, code: { source: true, esm: true, lines: true },
  });
  addFormats(ajv);
  const exportsMap = {}; const versions = [];
  Object.entries(VERSION_FILE_MAP).forEach(([version, files], vi) => {
    const schemaPath = path.join(ROOT, 'contracts', files.schema);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    if (!ajv.validateSchema(schema)) throw new Error(`Contract schema ${version} fails JSON Schema 2020-12 metaschema`);
    ajv.addSchema(schema);
    for (const t of schema.$defs.RecordType.enum) exportsMap[`v${vi}_${t}`] = `${schema.$id}#/$defs/${t}`;
    versions.push({ version, vi, schemaPath, vocabPath: path.join(ROOT, 'contracts', files.vocabulary) });
  });
  return { code: standaloneCode(ajv, exportsMap), versions };
}

function contractsShim(versions) {
  const lines = [
    "import * as V from 'kekb:validators';",
    "import { assembleVersion } from './contracts-assemble.js';",
  ];
  versions.forEach(({ vi, schemaPath, vocabPath }) => {
    lines.push(`import schema${vi} from ${JSON.stringify(schemaPath)};`, `import vocab${vi} from ${JSON.stringify(vocabPath)};`);
  });
  lines.push(
    `export const SUPPORTED_VERSIONS = Object.freeze(${JSON.stringify(versions.map((v) => v.version))});`,
    'let cache;',
    'export function loadContracts() {',
    '  if (cache) return cache;',
    '  const versions = {};',
    ...versions.map(({ version, vi }) => `  versions[${JSON.stringify(version)}] = assembleVersion(schema${vi}, vocab${vi}, (t) => V['v${vi}_' + t]);`),
    '  cache = { ajv: null, versions, lint: [] };',
    '  return cache;',
    '}',
  );
  return lines.join('\n');
}

export async function buildAppsScriptEngine() {
  const { code, versions } = compileValidators();
  const validatorDir = path.join(ROOT, 'validator', 'src');
  const plugin = {
    name: 'kekb-precompiled-contracts',
    setup(b) {
      // validator/src/contracts.js (Ajv runtime compile + fs) is replaced by the pre-compiled shim
      b.onResolve({ filter: /^\.\/contracts\.js$/ }, (a) => (a.importer.startsWith(validatorDir) ? { path: 'contracts', namespace: 'kekb' } : undefined));
      b.onResolve({ filter: /^\.\/contracts-assemble\.js$/ }, () => ({ path: 'assemble', namespace: 'kekb' }));
      b.onResolve({ filter: /^kekb:validators$/ }, () => ({ path: 'validators', namespace: 'kekb' }));
      b.onLoad({ filter: /.*/, namespace: 'kekb' }, (a) => {
        if (a.path === 'validators') return { contents: code, loader: 'js', resolveDir: ROOT };
        if (a.path === 'assemble') {
          // assembleVersion is copied verbatim from contracts.js (single source of truth, no fs import)
          const src = fs.readFileSync(path.join(validatorDir, 'contracts.js'), 'utf8');
          const start = src.indexOf('export function assembleVersion');
          const end = src.indexOf('\n}\n', start) + 3;
          if (start < 0 || end < 3) throw new Error('assembleVersion not found in contracts.js');
          return { contents: src.slice(start, end), loader: 'js', resolveDir: validatorDir };
        }
        return { contents: contractsShim(versions), loader: 'js', resolveDir: validatorDir };
      });
    },
  };
  const result = await esbuild.build({
    stdin: {
      contents: [
        "export { createEngine, SCHEMA_VERSION, TRANSITIONS, SYSTEM_FIELDS, UUID_V7, key } from './core/src/engine.js';",
        "export { canonicalJson } from './core/src/canonical-json.js';",
        "export { ERR, KekbError } from './core/src/errors.js';",
        "export { validateRecordSet, SUPPORTED_VERSIONS, CODES } from './validator/src/index.js';",
      ].join('\n'),
      resolveDir: ROOT, sourcefile: 'apps-script-entry.js', loader: 'js',
    },
    bundle: true, write: false, format: 'iife', globalName: 'KEKB_ENGINE', platform: 'neutral', mainFields: ['module', 'main'],
    target: 'es2019', charset: 'utf8', legalComments: 'inline', minify: true, treeShaking: true, logLevel: 'silent',
    plugins: [plugin],
  });
  const body = result.outputFiles[0].text;
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const header = [
    '/**',
    ' * GENERATED FILE — do not edit. Source: core/src/engine.js + validator/src (contracts pre-compiled with Ajv standalone).',
    ' * Rebuild: npm run build:apps-script   ·   Check: npm run build:apps-script -- --check',
    ` * Tools: ajv ${pkg.devDependencies.ajv}, ajv-formats ${pkg.devDependencies['ajv-formats']}, esbuild ${pkg.devDependencies.esbuild}. Bundled third-party code keeps its MIT license notices.`,
    ` * Contracts: ${versions.map((v) => `${v.version} (${rel(v.schemaPath)})`).join(', ')}`,
    ' */',
  ].join('\n');
  return `${header}\n${body}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = await buildAppsScriptEngine();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (cur !== out) { console.error(`${rel(OUT_FILE)} is out of date — run npm run build:apps-script`); process.exit(1); }
    console.log(`${rel(OUT_FILE)} is up to date`);
  } else {
    fs.writeFileSync(OUT_FILE, out);
    console.log(`wrote ${rel(OUT_FILE)} (${Buffer.byteLength(out)} bytes)`);
  }
}

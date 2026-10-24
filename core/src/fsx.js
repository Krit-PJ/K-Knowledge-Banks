import fs from 'node:fs';
import path from 'node:path';
// Atomic write: temp file in the same directory, then rename. LF + trailing newline, no BOM.
export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const readJsonIf = (file, fallback) => (fs.existsSync(file) ? readJson(file) : fallback);
export const listJson = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

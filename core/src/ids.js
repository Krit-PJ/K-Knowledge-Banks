import crypto from 'node:crypto';
// UUID v7 (RFC 9562): 48-bit unix ms timestamp + version 7 + random; opaque, never derived from labels.
export function uuidv7(nowMs = Date.now(), random = crypto.randomBytes(10)) {
  const b = Buffer.alloc(16);
  b.writeUIntBE(nowMs, 0, 6);
  random.copy(b, 6, 0, 10);
  b[6] = 0x70 | (b[6] & 0x0f);
  b[8] = 0x80 | (b[8] & 0x3f);
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export { canonicalJson } from './canonical-json.js';

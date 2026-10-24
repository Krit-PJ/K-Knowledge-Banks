// Strict loader for canonical record files: UTF-8, no BOM, LF only, no duplicate keys.
import { CODES } from './codes.js';

// Minimal scanner that detects duplicate keys per object without trusting JSON.parse,
// which silently keeps the last duplicate.
function findDuplicateKeyPaths(text) {
  const dups = [];
  const stack = []; // frames: {kind:'obj'|'arr', keys:Set, path:string, nextKey?:string, index:number}
  let i = 0;
  const readString = () => {
    let s = ''; i++; // skip opening quote
    while (i < text.length) {
      const c = text[i];
      if (c === '\\') { s += text.slice(i, i + 2); i += 2; continue; }
      if (c === '"') { i++; return s; }
      s += c; i++;
    }
    return s;
  };
  const curPath = () => (stack.length ? stack[stack.length - 1].path : '');
  const childPath = () => {
    const top = stack[stack.length - 1];
    if (!top) return '';
    if (top.kind === 'obj') return `${top.path}/${top.pendingKey}`;
    return `${top.path}/${top.index}`;
  };
  let expectKey = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '{') { stack.push({ kind: 'obj', keys: new Set(), path: childPath() }); expectKey = true; i++; continue; }
    if (c === '[') { stack.push({ kind: 'arr', path: childPath(), index: 0 }); expectKey = false; i++; continue; }
    if (c === '}' || c === ']') { stack.pop(); expectKey = false; i++; continue; }
    if (c === ',') {
      const top = stack[stack.length - 1];
      if (top && top.kind === 'obj') expectKey = true; else if (top) top.index++;
      i++; continue;
    }
    if (c === '"') {
      const s = readString();
      const top = stack[stack.length - 1];
      if (top && top.kind === 'obj' && expectKey) {
        if (top.keys.has(s)) dups.push(curPath() || "");
        top.keys.add(s); top.pendingKey = s; expectKey = false;
      }
      continue;
    }
    i++;
  }
  return dups;
}

/** Parse one record file buffer. Returns { record, issues } — issues carry no input values. */
export function parseRecordText(buffer, fileLabel) {
  const issues = [];
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer), 'utf8');
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    issues.push({ code: CODES.ENCODING_BOM, file: fileLabel });
  }
  const text = bytes.toString('utf8').replace(/^﻿/, '');
  if (text.includes('\r')) issues.push({ code: CODES.LINE_ENDING_NOT_LF, file: fileLabel });
  let record;
  try { record = JSON.parse(text); } catch {
    issues.push({ code: CODES.JSON_PARSE_ERROR, file: fileLabel });
    return { record: undefined, issues };
  }
  for (const p of findDuplicateKeyPaths(text)) issues.push({ code: CODES.DUPLICATE_JSON_KEY, file: fileLabel, path: p });
  return { record, issues };
}

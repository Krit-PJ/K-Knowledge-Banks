// Minimal in-memory fakes of the Google Apps Script services used by Code.js (test-only).
import crypto from 'node:crypto';

const signed = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
const unsigned = (arr) => Buffer.from(arr.map((b) => b & 0xff));

function iter(list) { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; }

export function fakeDrive() {
  let n = 0; const items = new Map(); const ops = [];
  const mkFile = (name, bytes, mime, parent) => {
    const id = `file-${++n}`; let data = Buffer.from(bytes); const parents = parent ? [parent] : []; let updated = new Date('2026-10-25T00:00:00.000Z');
    const f = {
      kind: 'file', getId: () => id, getName: () => name, getMimeType: () => mime, getSize: () => data.length, getLastUpdated: () => updated,
      getParents: () => iter(parents), getBlob: () => ({ getBytes: () => signed(data), getDataAsString: () => data.toString('utf8') }),
      setContent: (text) => { ops.push(['setContent', name]); data = Buffer.from(text, 'utf8'); updated = new Date(updated.getTime() + 1000); return f; },
    };
    items.set(id, f); return f;
  };
  const mkFolder = (name, parent) => {
    const id = `folder-${++n}`; const children = [];
    const folder = {
      kind: 'folder', getId: () => id, getName: () => name, setDescription: () => folder, parent,
      getFolders: () => iter(children.filter((c) => c.kind === 'folder')),
      getFoldersByName: (nm) => iter(children.filter((c) => c.kind === 'folder' && c.getName() === nm)),
      getFiles: () => iter(children.filter((c) => c.kind === 'file')),
      createFolder: (nm) => { ops.push(['createFolder', nm]); const c = mkFolder(nm, folder); children.push(c); return c; },
      createFile: (nm, text, mime) => { ops.push(['createFile', nm]); const c = mkFile(nm, Buffer.from(text, 'utf8'), mime, folder); children.push(c); return c; },
      addRaw: (nm, bytes, mime) => { const c = mkFile(nm, bytes, mime, folder); children.push(c); return c; },
    };
    items.set(id, folder); return folder;
  };
  const DriveApp = {
    getFolderById: (id) => { const f = items.get(id); if (!f || f.kind !== 'folder') throw new Error('No item with the given ID'); return f; },
    getFileById: (id) => { const f = items.get(id); if (!f || f.kind !== 'file') throw new Error('No item with the given ID'); return f; },
    createFolder: (nm) => { ops.push(['createFolder', nm]); return mkFolder(nm, null); },
  };
  return { DriveApp, mkFolder, ops };
}

export function fakeSheets(tabs) {
  const sheets = {};
  for (const [name, header] of Object.entries(tabs)) {
    const data = [header.slice()];
    const cell = (r, c) => { while (data.length < r) data.push([]); return data[r - 1][c - 1] ?? ''; };
    const set = (r, c, v) => { while (data.length < r) data.push([]); data[r - 1][c - 1] = v; };
    sheets[name] = {
      data,
      getLastRow: () => data.length, getMaxRows: () => Math.max(1000, data.length),
      getRange: (r, c, nr = 1, nc = 1) => ({
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j))),
        // like Sheets: a leading ' marks literal text and is not displayed
        getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String(cell(r + i, c + j)).replace(/^'/, ''))),
        setValues: (vals) => vals.forEach((row, i) => row.forEach((v, j) => set(r + i, c + j, v))),
        setValue: (v) => set(r, c, v),
        setNumberFormat: () => {},
      }),
    };
  }
  return { SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null }) }, sheets };
}

export function fakeServices({ props, tokens, drive, sheets }) {
  const cache = new Map(); const fetches = [];
  return {
    ...drive, ...sheets,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, bytes) => signed(crypto.createHash(alg).update(unsigned(bytes)).digest()),
      newBlob: (text) => ({ getBytes: () => signed(Buffer.from(String(text), 'utf8')) }),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => { const o = { content: s, setMimeType: () => o }; return o; } },
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        fetches.push(url);
        if (url === 'https://oauth2.googleapis.com/tokeninfo') {
          const c = tokens[opts.payload && opts.payload.id_token];
          return { getResponseCode: () => (c ? 200 : 400), getContentText: () => JSON.stringify(c || { error: 'invalid_token' }) };
        }
        return { getResponseCode: () => 404, getContentText: () => '' };
      },
    },
    fetches,
  };
}

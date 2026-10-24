/**
 * KEKB Apps Script backend — pure logic (no Google services). Loaded by Apps Script as a
 * global script file and by Node tests through `vm`. Keep it free of SpreadsheetApp/DriveApp.
 *
 * Role (baseline): Google Sheets = operational workflow state only. Canonical knowledge lives in
 * the GitHub repository; this code only mirrors it. Rows are never deleted; human-editable
 * columns are preserved; canonical wins on system columns.
 */
var KEKB = (function () {
  var SHEET_SCHEMA_VERSION = 'kekb-workflow-sheet-v1';
  var SYNC_ACTOR = 'service:apps-script-sync';

  var TABS = {
    IntakeQueue: {
      columns: ['intakeId', 'sourceAssetId', 'sourceRevision', 'sourceKind', 'sourceVersion', 'sha256', 'accessClassification',
        'originalLanguage', 'driveFileId', 'workflowState', 'assignedTo', 'receivedAt', 'updatedAt', 'syncedAt', 'note'],
      key: ['driveFileId', 'sha256'],
      // humans (or the curator flow) own these; sync never overwrites a non-empty value
      human: ['assignedTo', 'note', 'accessClassification', 'originalLanguage', 'sourceAssetId', 'sourceRevision', 'workflowState'],
    },
    RecordStatus: {
      columns: ['recordId', 'recordType', 'revision', 'workflowState', 'canonicalRevision', 'dependencyStale', 'contentHash',
        'updatedAt', 'updatedBy', 'syncedAt'],
      key: ['recordId', 'revision'],
      human: [],
    },
    AuditLog: { columns: ['seq', 'at', 'actor', 'action', 'target', 'outcome', 'code'], key: ['seq'], human: [] },
  };

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  /** Signed (Apps Script) or unsigned bytes → lowercase hex. */
  function bytesToHex(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) { var b = bytes[i] & 0xff; out += (b < 16 ? '0' : '') + b.toString(16); }
    return out;
  }
  /** UUID v7: 48-bit ms timestamp + version 7 + variant; `rand` = 10 random bytes. */
  function uuidv7(nowMs, rand) {
    var b = [];
    var t = Math.floor(nowMs);
    for (var i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
    for (var j = 0; j < 10; j++) b[6 + j] = rand[j] & 0xff;
    b[6] = 0x70 | (b[6] & 0x0f);
    b[8] = 0x80 | (b[8] & 0x3f);
    var h = bytesToHex(b);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function canonicalJson(v) {
    if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
    if (v !== null && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canonicalJson(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v);
  }
  /** Prevent formula/CSV injection: text starting with = + - @ (or control chars) is stored as literal text. */
  function sanitizeCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
    return s;
  }
  /** Inverse of sanitizeCell for values read back from the sheet (Sheets drops the leading '). */
  function cellText(v) { return v === null || v === undefined ? '' : String(v); }

  function rowsToObjects(header, rows) {
    return rows.map(function (r) { var o = {}; header.forEach(function (h, i) { o[h] = r[i] === undefined ? '' : r[i]; }); return o; });
  }
  function keyOf(obj, keyCols) { return keyCols.map(function (k) { return cellText(obj[k]); }).join('\u0001'); }

  /**
   * Plan an idempotent upsert. existing: data rows (no header) in sheet order starting at sheet row 2.
   * desired: objects keyed by column name. Never deletes. Unchanged rows produce no write.
   * Human-editable columns keep their existing non-empty value. syncedAt changes only when content changes.
   */
  function planUpsert(tab, header, existing, desired, nowIso) {
    var spec = TABS[tab];
    if (!spec) throw new Error('Unknown tab');
    if (header.join('|') !== spec.columns.join('|')) throw new Error('SHEET_SCHEMA_MISMATCH');
    var existingObjs = rowsToObjects(header, existing);
    var index = {};
    existingObjs.forEach(function (o, i) { index[keyOf(o, spec.key)] = i; });
    var updates = []; var appends = []; var seen = {};
    desired.forEach(function (d) {
      var k = keyOf(d, spec.key);
      if (seen[k]) return; seen[k] = true;
      var i = index[k];
      var merged = {};
      spec.columns.forEach(function (c) {
        var cur = i === undefined ? '' : existingObjs[i][c];
        var keepHuman = spec.human.indexOf(c) >= 0 && cellText(cur) !== '';
        merged[c] = keepHuman ? cur : (d[c] === undefined ? cur : d[c]);
      });
      if (i === undefined) {
        if (spec.columns.indexOf('syncedAt') >= 0) merged.syncedAt = nowIso;
        appends.push(spec.columns.map(function (c) { return sanitizeCell(merged[c]); }));
        return;
      }
      var changed = spec.columns.some(function (c) { return c !== 'syncedAt' && cellText(sanitizeCell(merged[c])).replace(/^'/, '') !== cellText(existingObjs[i][c]); });
      if (!changed) return;
      if (spec.columns.indexOf('syncedAt') >= 0) merged.syncedAt = nowIso;
      updates.push({ row: i + 2, values: spec.columns.map(function (c) { return sanitizeCell(merged[c]); }) });
    });
    return { updates: updates, appends: appends };
  }

  /**
   * Drive intake → IntakeQueue desired rows. files: [{id, mimeType, size, modifiedAt, sha256, error}]
   * A changed file (new sha256) is a new intake row; the old row stays (history is kept).
   * New files default to RESTRICTED until a human classifies them; state RECEIVED (REGISTERED needs a SourceAsset).
   */
  function intakeDesired(files, existingObjs, nowIso, newId) {
    var byKey = {};
    existingObjs.forEach(function (o) { byKey[keyOf(o, TABS.IntakeQueue.key)] = o; });
    return files.map(function (f) {
      var key = keyOf({ driveFileId: f.id, sha256: f.sha256 || '' }, TABS.IntakeQueue.key);
      var prev = byKey[key];
      return {
        intakeId: prev ? prev.intakeId : newId(),
        sourceKind: f.mimeType,
        sourceVersion: f.modifiedAt,
        sha256: f.sha256 || '',
        accessClassification: 'RESTRICTED',
        driveFileId: f.id,
        workflowState: f.error ? 'ERROR' : 'RECEIVED',
        receivedAt: prev ? prev.receivedAt : nowIso,
        updatedAt: prev ? prev.updatedAt : nowIso,
        note: f.error ? f.error : '',
      };
    });
  }

  /**
   * GitHub canonical → RecordStatus desired rows.
   * manifest: canonical/manifest.json; records: {key: record}; active: read-models/ACTIVE.json or null;
   * stale: read model stale.json items or []. hashFn(text) → sha256 hex.
   */
  function statusDesired(manifest, records, active, stale, hashFn) {
    var committedAt = {}; // key -> canonicalRevision that committed it
    (manifest.history || []).forEach(function (h) { (h.keys || []).forEach(function (k) { committedAt[k] = h.canonicalRevision; }); });
    var latest = {};
    Object.keys(records).forEach(function (k) {
      var r = records[k]; if (!latest[r.id] || latest[r.id] < r.revision) latest[r.id] = r.revision;
    });
    var staleSet = {};
    (stale || []).forEach(function (s) { staleSet[s.id + '@' + s.revision] = true; });
    var publishedUpTo = active ? active.canonicalRevision : 0;
    return Object.keys(records).sort().map(function (k) {
      var r = records[k];
      var content = {}; Object.keys(r).forEach(function (f) { if (f !== 'workflowState' && f !== 'updatedAt') content[f] = r[f]; });
      var state = latest[r.id] > r.revision ? 'SUPERSEDED' : (committedAt[k] && committedAt[k] <= publishedUpTo ? 'PUBLISHED' : 'COMMITTED');
      return {
        recordId: r.id, recordType: r.type, revision: r.revision, workflowState: state,
        canonicalRevision: committedAt[k] || '', dependencyStale: staleSet[k] === true ? 'TRUE' : 'FALSE', // text, matches Vocab dropdown
        contentHash: hashFn(canonicalJson(content)), updatedAt: r.updatedAt, updatedBy: r.updatedBy,
      };
    });
  }

  function auditRows(lastSeq, entries, nowIso) {
    return entries.map(function (e, i) {
      return [lastSeq + i + 1, nowIso, e.actor || SYNC_ACTOR, e.action, e.target, e.outcome, e.code || ''].map(sanitizeCell);
    });
  }

  return {
    SHEET_SCHEMA_VERSION: SHEET_SCHEMA_VERSION, SYNC_ACTOR: SYNC_ACTOR, TABS: TABS,
    bytesToHex: bytesToHex, uuidv7: uuidv7, canonicalJson: canonicalJson, sanitizeCell: sanitizeCell,
    rowsToObjects: rowsToObjects, planUpsert: planUpsert, intakeDesired: intakeDesired,
    statusDesired: statusDesired, auditRows: auditRows, pad: pad,
  };
})();

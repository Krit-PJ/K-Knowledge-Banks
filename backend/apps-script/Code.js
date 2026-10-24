/**
 * KEKB Apps Script backend — adapters (bound to the "KEKB Workflow" spreadsheet).
 * Runs as the owner via a time-driven trigger. No web endpoint in this packet (P2-WP4):
 * write endpoints wait for the identity decision.
 *
 * Script Properties (Project Settings → Script properties), no secrets:
 *   SOURCE_FOLDER_ID  Drive folder holding raw SourceAssets (files are hashed, never executed)
 *   GITHUB_REPO       e.g. Krit-PJ/K-Knowledge-Banks (public; read-only raw fetch, no token)
 *   GITHUB_BRANCH     e.g. main
 *   CANONICAL_ROOT    e.g. knowledge   (canonical/ and read-models/ live under it)
 *   MAX_FILE_BYTES    optional, default 50000000
 */

function setup() {
  var cfg = config_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['IntakeQueue', 'RecordStatus', 'AuditLog'].forEach(function (tab) {
    var sh = ss.getSheetByName(tab);
    if (!sh) throw new Error('Missing tab ' + tab);
    var header = sh.getRange(1, 1, 1, KEKB.TABS[tab].columns.length).getValues()[0].map(String);
    if (header.join('|') !== KEKB.TABS[tab].columns.join('|')) throw new Error('SHEET_SCHEMA_MISMATCH in ' + tab);
    // plain text so timestamps/IDs are never auto-converted to dates or numbers
    sh.getRange(2, 1, sh.getMaxRows() - 1, header.length).setNumberFormat('@');
  });
  DriveApp.getFolderById(cfg.sourceFolderId); // fails fast if the folder is not accessible
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runSync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runSync').timeBased().everyMinutes(15).create();
  return 'OK: trigger runSync every 15 minutes';
}

function runSync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'SKIPPED_LOCKED';
  try {
    var now = new Date().toISOString();
    var entries = [];
    entries = entries.concat(syncIntake_(now));
    entries = entries.concat(syncCanonical_(now));
    appendAudit_(entries, now);
    return entries.map(function (e) { return e.action + ':' + e.outcome; }).join(', ');
  } finally {
    lock.releaseLock();
  }
}

function config_() {
  var p = PropertiesService.getScriptProperties();
  var cfg = {
    sourceFolderId: p.getProperty('SOURCE_FOLDER_ID'),
    repo: p.getProperty('GITHUB_REPO'),
    branch: p.getProperty('GITHUB_BRANCH') || 'main',
    root: p.getProperty('CANONICAL_ROOT') || 'knowledge',
    maxBytes: Number(p.getProperty('MAX_FILE_BYTES') || 50000000),
  };
  if (!cfg.sourceFolderId || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(cfg.repo || '')) throw new Error('CONFIG_MISSING');
  return cfg;
}

function table_(tab) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  var width = KEKB.TABS[tab].columns.length;
  var header = sh.getRange(1, 1, 1, width).getValues()[0].map(String);
  var n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, width).getDisplayValues() : [];
  return { sheet: sh, header: header, rows: rows };
}

function applyPlan_(t, plan) {
  plan.updates.forEach(function (u) { t.sheet.getRange(u.row, 1, 1, u.values.length).setValues([u.values]); });
  if (plan.appends.length) t.sheet.getRange(t.sheet.getLastRow() + 1, 1, plan.appends.length, plan.appends[0].length).setValues(plan.appends);
  return plan.updates.length + plan.appends.length;
}

function newId_() {
  var rand = [];
  for (var i = 0; i < 10; i++) rand.push(Math.floor(Math.random() * 256));
  // Math.random is acceptable for opaque queue IDs (not security tokens)
  return KEKB.uuidv7(Date.now(), rand);
}

function sha256Hex_(bytes) { return KEKB.bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)); }

function syncIntake_(now) {
  var cfg = config_();
  var files = [];
  var it = DriveApp.getFolderById(cfg.sourceFolderId).getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var mime = f.getMimeType();
    var entry = { id: f.getId(), mimeType: mime, size: f.getSize(), modifiedAt: f.getLastUpdated().toISOString(), sha256: '', error: '' };
    if (mime.indexOf('application/vnd.google-apps.') === 0) entry.error = 'UNSUPPORTED_GOOGLE_NATIVE_TYPE';
    else if (entry.size > cfg.maxBytes) entry.error = 'FILE_TOO_LARGE';
    else entry.sha256 = sha256Hex_(f.getBlob().getBytes());
    files.push(entry);
  }
  var t = table_('IntakeQueue');
  var desired = KEKB.intakeDesired(files, KEKB.rowsToObjects(t.header, t.rows), now, newId_);
  var n = applyPlan_(t, KEKB.planUpsert('IntakeQueue', t.header, t.rows, desired, now));
  return [{ action: 'sync:intake', target: files.length + ' files', outcome: 'OK', code: n ? '' : 'NO_CHANGE' }];
}

function fetchJson_(cfg, path) {
  var url = 'https://raw.githubusercontent.com/' + cfg.repo + '/' + encodeURIComponent(cfg.branch) + '/' + path.split('/').map(encodeURIComponent).join('/');
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('GITHUB_FETCH_' + res.getResponseCode());
  return JSON.parse(res.getContentText('UTF-8'));
}

function syncCanonical_(now) {
  var cfg = config_();
  var manifest = fetchJson_(cfg, cfg.root + '/canonical/manifest.json');
  if (!manifest) return [{ action: 'sync:canonical', target: cfg.repo, outcome: 'OK', code: 'NO_CANONICAL' }];
  var t = table_('RecordStatus');
  var known = {};
  KEKB.rowsToObjects(t.header, t.rows).forEach(function (o) { known[o.recordId + '@' + o.revision] = true; });
  var records = {};
  manifest.records.forEach(function (k) {
    // incremental: fetch record bodies only for keys not mirrored yet; mirrored rows keep their hash
    if (!known[k]) records[k] = fetchJson_(cfg, cfg.root + '/canonical/records/' + k + '.json');
  });
  // states of already-mirrored keys can still change (SUPERSEDED/PUBLISHED/stale), so re-derive them from minimal stubs
  KEKB.rowsToObjects(t.header, t.rows).forEach(function (o) {
    var k = o.recordId + '@' + o.revision;
    if (!records[k] && manifest.records.indexOf(k) >= 0) records[k] = { id: o.recordId, type: o.recordType, revision: Number(o.revision), updatedAt: o.updatedAt, updatedBy: o.updatedBy, __hash: o.contentHash };
  });
  var active = fetchJson_(cfg, cfg.root + '/read-models/ACTIVE.json');
  var stale = active ? (fetchJson_(cfg, cfg.root + '/read-models/' + active.readModelId + '/stale.json') || { items: [] }).items : [];
  var desired = KEKB.statusDesired(manifest, records, active, stale, function (text) {
    return sha256Hex_(Utilities.newBlob(text, 'application/json').getBytes());
  });
  desired.forEach(function (d) { var r = records[d.recordId + '@' + d.revision]; if (r && r.__hash) d.contentHash = r.__hash; });
  var n = applyPlan_(t, KEKB.planUpsert('RecordStatus', t.header, t.rows, desired, now));
  return [{ action: 'sync:canonical', target: 'canonical@' + manifest.canonicalRevision, outcome: 'OK', code: n ? '' : 'NO_CHANGE' }];
}

function appendAudit_(entries, now) {
  var t = table_('AuditLog');
  var last = t.rows.length ? Number(t.rows[t.rows.length - 1][0]) || 0 : 0;
  var rows = KEKB.auditRows(last, entries, now);
  if (rows.length) t.sheet.getRange(t.sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

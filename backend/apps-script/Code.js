/**
 * KEKB Apps Script backend — adapters (bound to the "KEKB Workflow" spreadsheet).
 * Time-driven sync (P2-WP4) + web API (P2-WP5/WP6, see the end of this file). Rules live in Lib.js (pure),
 * Api.js (pure request pipeline) and Engine.js (generated workflow engine + validator); this file only touches
 * Google services.
 *
 * Script Properties (Project Settings → Script properties), no secrets:
 *   SOURCE_FOLDER_ID  Drive folder holding raw SourceAssets (files are hashed, never executed)
 *   GITHUB_REPO       e.g. Krit-PJ/K-Knowledge-Banks (public; read-only raw fetch, no token)
 *   GITHUB_BRANCH     e.g. main
 *   CANONICAL_ROOT    e.g. knowledge   (canonical/ and read-models/ live under it)
 *   MAX_FILE_BYTES    optional, default 50000000
 *   DRAFTS_FOLDER_ID  set by setupDrafts(): private folder created by this script (drive.file scope)
 *   OAUTH_CLIENT_ID, ACTORS_JSON  web API identity (see below)
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

// ---------------------------------------------------------------------------------------------
// P2-WP5 web API (secure write boundary). Deployed as a Web App: execute as owner, access anyone.
// Access "anyone" is safe only because EVERY request is authenticated by a Google ID token
// (verified by Google's tokeninfo) and authorized against ACTORS_JSON (Script Properties).
// Script Properties: OAUTH_CLIENT_ID, ACTORS_JSON = {"email": {"actorId": "human:x", "roles": [...]}}
// ---------------------------------------------------------------------------------------------

function doGet() {
  return json_({ ok: true, service: 'kekb-api', contractVersion: KEKB_API.CONTRACT_VERSION });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: { code: 'RATE_LIMITED' }, contractVersion: KEKB_API.CONTRACT_VERSION });
  var deps = null;
  try {
    deps = apiDeps_();
    return json_(KEKB_API.handle(e && e.postData ? e.postData.contents : '', deps));
  } catch (err) {
    return json_({ ok: false, error: { code: 'DEPENDENCY_UNAVAILABLE' }, contractVersion: KEKB_API.CONTRACT_VERSION });
  } finally {
    // mirror + audit are flushed even when the action failed: Drive writes that happened must be visible
    try { if (deps) deps.flush(); } finally { lock.releaseLock(); }
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function apiDeps_() {
  var p = PropertiesService.getScriptProperties();
  var raw = {};
  try { raw = JSON.parse(p.getProperty('ACTORS_JSON') || '{}'); } catch (err) { raw = {}; }
  var actors = {};
  Object.keys(raw).forEach(function (k) { actors[String(k).toLowerCase()] = raw[k]; });
  var cache = CacheService.getScriptCache();
  var idemKey = function (k) { return 'idem:' + sha256Hex_(Utilities.newBlob(k).getBytes()); };
  var pending = { status: {}, reviews: {}, sources: {}, audit: [] };
  var store = driveStore_(p.getProperty('DRAFTS_FOLDER_ID'), pending);
  var hashText = function (text) { return sha256Hex_(Utilities.newBlob(text, 'application/json').getBytes()); };
  var engine = KEKB_ENGINE.createEngine({
    store: store, now: function () { return new Date().toISOString(); }, newId: newId_, sha256: hashText,
  });
  return {
    nowMs: function () { return Date.now(); },
    clientId: p.getProperty('OAUTH_CLIENT_ID'),
    actors: actors,
    newRequestId: newId_,
    fetchClaims: function (token) {
      // POST keeps the token out of URLs/logs; Google verifies the signature and returns the claims
      var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', { method: 'post', payload: { id_token: token }, muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) return null;
      return JSON.parse(r.getContentText('UTF-8'));
    },
    hash: function (text) { return sha256Hex_(Utilities.newBlob(text, 'application/json').getBytes()); },
    intake: {
      list: function () { var t = table_('IntakeQueue'); return KEKB.rowsToObjects(t.header, t.rows); },
      find: function (intakeId) {
        var t = table_('IntakeQueue'); var objs = KEKB.rowsToObjects(t.header, t.rows);
        for (var i = 0; i < objs.length; i++) if (objs[i].intakeId === intakeId) return { row: i + 2, obj: objs[i] };
        return null;
      },
      update: function (row, changes) {
        var t = table_('IntakeQueue');
        Object.keys(changes).forEach(function (c) {
          var col = t.header.indexOf(c);
          if (col < 0) throw new Error('SHEET_SCHEMA_MISMATCH');
          t.sheet.getRange(row, col + 1).setValue(KEKB.sanitizeCell(changes[c]));
        });
      },
    },
    // retention 6 h (CacheService max); policy for longer retention is still open
    idem: { get: function (k) { return cache.get(idemKey(k)); }, put: function (k, v) { cache.put(idemKey(k), v, 21600); } },
    audit: function (entry) { pending.audit.push(entry); },
    engine: engine,
    store: store,
    source: { verify: verifySource_ },
    flush: function () { flushMirror_(pending, engine); },
  };
}

// ---------------------------------------------------------------------------------------------
// P2-WP6 drafts / validation / review. Drafts are JSON files (one per id@revision) in a private Drive
// folder created by this script. Scope drive.file = the script can only see/write files it created.
// DriveApp needs the full `drive` scope to create folders, so drafts use the Drive REST API (v3) through
// UrlFetchApp with the script's own OAuth token (server-side only; never returned or logged).
// Sheets get status copies only (RecordStatus, ReviewQueue, IntakeQueue.workflowState) + AuditLog.
// ---------------------------------------------------------------------------------------------

var DRIVE_FILES_ = 'https://www.googleapis.com/drive/v3/files';
var DRIVE_UPLOAD_ = 'https://www.googleapis.com/upload/drive/v3/files';
var FOLDER_MIME_ = 'application/vnd.google-apps.folder';
var DRIVE_ID_ = /^[A-Za-z0-9_-]{10,200}$/;

/** Minimal Drive v3 REST client (drive.file). Returns null on 404; throws DRIVE_HTTP_<code> otherwise. */
function driveCall_(method, url, body, contentType) {
  var o = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (body !== undefined) { o.contentType = contentType; o.payload = Utilities.newBlob(body).getBytes(); }
  var r = UrlFetchApp.fetch(url, o);
  var code = r.getResponseCode();
  if (code === 404) return null;
  if (code < 200 || code >= 300) throw new Error('DRIVE_HTTP_' + code);
  return r.getContentText('UTF-8');
}
function query_(params) {
  return Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
}
var DriveRest_ = {
  exists: function (id) {
    if (!DRIVE_ID_.test(id || '')) return false;
    var t = driveCall_('get', DRIVE_FILES_ + '/' + id + '?fields=id,trashed');
    return !!t && JSON.parse(t).trashed !== true;
  },
  list: function (parentId, extraQ) {
    if (!DRIVE_ID_.test(parentId)) throw new Error('BAD_DRIVE_ID');
    var q = "'" + parentId + "' in parents and trashed = false" + (extraQ || '');
    var out = []; var next = '';
    do {
      var params = { q: q, fields: 'nextPageToken,files(id,name)', pageSize: 1000, spaces: 'drive' };
      if (next) params.pageToken = next;
      var page = JSON.parse(driveCall_('get', DRIVE_FILES_ + '?' + query_(params)));
      out = out.concat(page.files || []); next = page.nextPageToken || '';
    } while (next);
    return out;
  },
  createFolder: function (name, parentId, description) {
    var meta = { name: name, mimeType: FOLDER_MIME_ };
    if (parentId) meta.parents = [parentId];
    if (description) meta.description = description;
    return JSON.parse(driveCall_('post', DRIVE_FILES_ + '?fields=id', JSON.stringify(meta), 'application/json')).id;
  },
  childFolder: function (parentId, name) {
    var found = DriveRest_.list(parentId, " and mimeType = '" + FOLDER_MIME_ + "' and name = '" + name + "'");
    return found.length ? found[0].id : DriveRest_.createFolder(name, parentId);
  },
  read: function (id) { return driveCall_('get', DRIVE_FILES_ + '/' + id + '?alt=media'); },
  createJson: function (parentId, name, text) {
    var b = 'kekb' + Utilities.getUuid().replace(/-/g, '');
    var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: name, parents: [parentId], mimeType: 'application/json' }) +
      '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--';
    return JSON.parse(driveCall_('post', DRIVE_UPLOAD_ + '?uploadType=multipart&fields=id', body, 'multipart/related; boundary=' + b)).id;
  },
  updateJson: function (id, text) { driveCall_('patch', DRIVE_UPLOAD_ + '/' + id + '?uploadType=media&fields=id', text, 'application/json; charset=UTF-8'); },
};

/** Run once from the editor after authorizing the drive.file scope. Idempotent. */
function setupDrafts() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('DRAFTS_FOLDER_ID');
  if (!id || !DriveRest_.exists(id)) {
    id = DriveRest_.createFolder('KEKB Drafts (private)', null, 'KEKB draft records and review requests. Written only by the KEKB Apps Script. Not canonical.');
    p.setProperty('DRAFTS_FOLDER_ID', id);
  }
  DriveRest_.childFolder(id, 'records'); DriveRest_.childFolder(id, 'reviews');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ReviewQueue');
  var header = sh.getRange(1, 1, 1, KEKB.TABS.ReviewQueue.columns.length).getValues()[0].map(String);
  if (header.join('|') !== KEKB.TABS.ReviewQueue.columns.join('|')) throw new Error('SHEET_SCHEMA_MISMATCH in ReviewQueue');
  sh.getRange(2, 1, sh.getMaxRows() - 1, header.length).setNumberFormat('@');
  return 'OK: drafts folder ready';
}

var DRAFT_NAME_ = /^([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@([1-9][0-9]{0,5})\.json$/;
var REVIEW_NAME_ = /^([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/;

/** Engine store over Drive JSON files; request-scoped cache; queues Sheet mirror rows in `pending`. */
function driveStore_(folderId, pending) {
  // resolved lazily so whoami/intake actions keep working before setupDrafts() has run
  var dirs = null;
  function D() {
    if (!dirs) {
      if (!folderId) throw new Error('CONFIG_MISSING');
      dirs = { rec: DriveRest_.childFolder(folderId, 'records'), rev: DriveRest_.childFolder(folderId, 'reviews') };
    }
    return dirs;
  }
  var recIndex = null; var revIndex = null; var texts = {}; var canonical = null;
  function index(dirId, re) {
    var out = {};
    DriveRest_.list(dirId).forEach(function (f) { if (re.test(f.name)) out[f.name] = f.id; });
    return out;
  }
  function recs() { if (!recIndex) recIndex = index(D().rec, DRAFT_NAME_); return recIndex; }
  function revs() { if (!revIndex) revIndex = index(D().rev, REVIEW_NAME_); return revIndex; }
  function read(idx, name) {
    if (!idx[name]) return undefined;
    if (texts[name] === undefined) {
      var t = DriveRest_.read(idx[name]);
      if (t === null) throw new Error('DRIVE_FILE_MISSING');
      texts[name] = t;
    }
    return JSON.parse(texts[name]);
  }
  function write(dirId, idx, name, obj) {
    var text = JSON.stringify(obj, null, 2) + '\n';
    if (idx[name]) DriveRest_.updateJson(idx[name], text); else idx[name] = DriveRest_.createJson(dirId, name, text);
    texts[name] = text;
  }
  function revisionsOf(id) {
    return Object.keys(recs()).filter(function (n) { return n.indexOf(id + '@') === 0; })
      .map(function (n) { return Number(DRAFT_NAME_.exec(n)[2]); }).sort(function (a, b) { return a - b; });
  }
  return {
    putDraft: function (r) {
      write(D().rec, recs(), r.id + '@' + r.revision + '.json', r);
      pending.status[r.id + '@' + r.revision] = r;
      if (r.type === 'SourceAsset') pending.sources[r.id] = r.workflowState;
    },
    getDraft: function (id, rev) {
      var all = revisionsOf(id); var n = rev === undefined ? all[all.length - 1] : rev;
      return n === undefined ? undefined : read(recs(), id + '@' + n + '.json');
    },
    draftRevisions: revisionsOf,
    latestDrafts: function () {
      var latest = {};
      Object.keys(recs()).forEach(function (n) { var m = DRAFT_NAME_.exec(n); var r = Number(m[2]); if (!latest[m[1]] || latest[m[1]] < r) latest[m[1]] = r; });
      return Object.keys(latest).sort().map(function (id) { return read(recs(), id + '@' + latest[id] + '.json'); });
    },
    canonicalRecords: function () {
      if (canonical) return canonical;
      var cfg = config_();
      var manifest = fetchJson_(cfg, cfg.root + '/canonical/manifest.json');
      canonical = manifest ? manifest.records.map(function (k) { return fetchJson_(cfg, cfg.root + '/canonical/records/' + k + '.json'); }) : [];
      return canonical;
    },
    getReview: function (requestId) { return read(revs(), requestId + '.json'); },
    putReview: function (req) { write(D().rev, revs(), req.requestId + '.json', req); pending.reviews[req.requestId] = req; },
    listReviews: function () {
      return Object.keys(revs()).sort().map(function (n) { return read(revs(), n); });
    },
    audit: function (entry) { pending.audit.push(entry); },
  };
}

/** Re-hash the raw Drive bytes (Sheet cells are untrusted). */
function verifySource_(driveFileId) {
  var cfg = config_();
  var f = DriveApp.getFileById(driveFileId);
  // the file must still sit in the SourceAssets folder
  var parents = f.getParents(); var inFolder = false;
  while (parents.hasNext()) if (parents.next().getId() === cfg.sourceFolderId) inFolder = true;
  if (!inFolder || f.getSize() > cfg.maxBytes) return null;
  return { sha256: sha256Hex_(f.getBlob().getBytes()), mimeType: f.getMimeType(), modifiedAt: f.getLastUpdated().toISOString() };
}

function flushMirror_(pending, engine) {
  var now = new Date().toISOString();
  var statusRows = Object.keys(pending.status).sort().map(function (k) { var r = pending.status[k]; return KEKB.draftStatusRow(r, engine.contentHash(r)); });
  if (statusRows.length) { var t = table_('RecordStatus'); applyPlan_(t, KEKB.planUpsert('RecordStatus', t.header, t.rows, statusRows, now)); }
  var reviewRows = Object.keys(pending.reviews).sort().map(function (k) { return KEKB.reviewRow(pending.reviews[k]); });
  if (reviewRows.length) { var q = table_('ReviewQueue'); applyPlan_(q, KEKB.planUpsert('ReviewQueue', q.header, q.rows, reviewRows, now)); }
  var ids = Object.keys(pending.sources);
  if (ids.length) {
    var iq = table_('IntakeQueue'); var col = iq.header.indexOf('workflowState');
    KEKB.rowsToObjects(iq.header, iq.rows).forEach(function (o, i) {
      if (o.sourceAssetId && pending.sources[o.sourceAssetId] && o.workflowState !== pending.sources[o.sourceAssetId]) {
        iq.sheet.getRange(i + 2, col + 1).setValue(KEKB.sanitizeCell(pending.sources[o.sourceAssetId]));
      }
    });
  }
  if (pending.audit.length) appendAudit_(pending.audit, now);
  pending.status = {}; pending.reviews = {}; pending.sources = {}; pending.audit = [];
}

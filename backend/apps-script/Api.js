/**
 * KEKB web API — pure logic (no Google services). P2-WP5 secure write boundary + P2-WP6 draft/validation/review.
 * Every request: size → shape → allowed action → Google ID token claims → allowlist → role
 * → idempotency → expected revision → execute → audit. Errors are stable safe codes only.
 * Browser input (identity, roles, approval flags) is never trusted; identity comes from the
 * verified ID token and roles from the server-side allowlist (Script Properties).
 * Workflow rules (drafts, validation, review) run in the shared engine (Engine.js, generated from core/src/engine.js).
 */
var KEKB_API = (function () {
  var CONTRACT_VERSION = 'v1.0-RC1';
  var MAX_BODY = 131072;
  var UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
  var ACTOR_ID = /^human:[a-z0-9._-]{1,64}$/;
  var IDEM_KEY = /^[A-Za-z0-9_-]{8,128}$/;
  var RECORD_TYPE = /^[A-Z][A-Za-z]{1,40}$/;
  var ACCESS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];
  var LOCATORS = ['page', 'section', 'table', 'figure', 'paragraph', 'row', 'timeRange', 'dataRange'];
  var ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
  var READ = ['CONTRIBUTOR', 'REVIEWER'];

  // roles [] = any allowlisted actor; mutation = needs idempotencyKey and is audited as a write
  var ACTIONS = {
    whoami: { roles: [], mutation: false },
    'intake.list': { roles: READ, mutation: false },
    'intake.update': { roles: ['CONTRIBUTOR'], mutation: true },
    'source.register': { roles: ['CONTRIBUTOR'], mutation: true },
    'source.extracted': { roles: ['CONTRIBUTOR'], mutation: true },
    'draft.list': { roles: READ, mutation: false },
    'draft.get': { roles: READ, mutation: false },
    'draft.save': { roles: ['CONTRIBUTOR'], mutation: true },
    'draft.validate': { roles: ['CONTRIBUTOR'], mutation: true },
    'review.list': { roles: READ, mutation: false },
    'review.request': { roles: ['CONTRIBUTOR'], mutation: true },
    'review.decide': { roles: ['REVIEWER'], mutation: true },
  };
  // safe detail keys copied from engine errors (ids, field names, codes, revisions — never values)
  var DETAIL_KEYS = ['field', 'recordId', 'requestId', 'from', 'to', 'codes', 'expectedRevision', 'currentRevision', 'pinnedRevision', 'refs', 'required'];

  function KekbError(code, field) { this.code = code; this.field = field; }
  function fail(code, field) { throw new KekbError(code, field); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function onlyKeys(o, allowed, field) {
    Object.keys(o).forEach(function (k) { if (allowed.indexOf(k) < 0) fail('INVALID_INPUT', field ? field + '.' + k : k); });
  }
  function isRef(v) {
    return isObj(v) && Object.keys(v).length === 3 && UUID_V7.test(v.id || '') && RECORD_TYPE.test(v.type || '') && v.revision === Math.floor(v.revision) && v.revision >= 1;
  }

  /** Claims returned by Google's tokeninfo endpoint (signature already verified by Google). */
  function verifyClaims(claims, clientId, nowSec) {
    if (!isObj(claims) || !clientId) fail('UNAUTHENTICATED');
    if (claims.aud !== clientId) fail('UNAUTHENTICATED');
    if (ISSUERS.indexOf(claims.iss) < 0) fail('UNAUTHENTICATED');
    if (!(Number(claims.exp) > nowSec)) fail('UNAUTHENTICATED');
    if (!(claims.email_verified === true || claims.email_verified === 'true')) fail('UNAUTHENTICATED');
    if (typeof claims.email !== 'string' || claims.email.indexOf('@') < 1) fail('UNAUTHENTICATED');
    return claims.email.toLowerCase();
  }

  /** actors: {"email": {"actorId": "human:x", "roles": [...]}} from Script Properties (never from the browser). */
  function resolveActor(email, actors) {
    var a = isObj(actors) ? actors[email] : null;
    if (!isObj(a) || !ACTOR_ID.test(a.actorId || '') || !Array.isArray(a.roles)) fail('FORBIDDEN');
    var roles = a.roles.filter(function (r) { return ['VIEWER', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN'].indexOf(r) >= 0; });
    return { actorId: a.actorId, roles: roles };
  }
  function knownActorIds(actors) {
    return Object.keys(actors || {}).map(function (k) { return actors[k] && actors[k].actorId; }).filter(function (x) { return ACTOR_ID.test(x || ''); }).sort();
  }
  /** Engine actor: allowlisted entries are humans only (ACTOR_ID requires the human: prefix). */
  function engineActor(actor) { return { id: actor.actorId, kind: 'human', roles: actor.roles.slice() }; }

  function cleanText(s, max, field) {
    if (typeof s !== 'string' || s.length > max) fail('INVALID_INPUT', field);
    return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }
  function cleanNote(s) { return cleanText(s, 500, 'payload.note'); }

  function validateIntakeUpdate(p, actors) {
    if (!isObj(p)) fail('INVALID_INPUT', 'payload');
    onlyKeys(p, ['intakeId', 'expectedUpdatedAt', 'accessClassification', 'originalLanguage', 'assignedTo', 'note'], 'payload');
    if (!UUID_V7.test(p.intakeId || '')) fail('INVALID_INPUT', 'payload.intakeId');
    if (typeof p.expectedUpdatedAt !== 'string' || !p.expectedUpdatedAt) fail('INVALID_INPUT', 'payload.expectedUpdatedAt');
    var changes = {};
    if (p.accessClassification !== undefined) {
      if (ACCESS.indexOf(p.accessClassification) < 0) fail('INVALID_INPUT', 'payload.accessClassification');
      changes.accessClassification = p.accessClassification;
    }
    if (p.originalLanguage !== undefined) {
      if (!BCP47.test(p.originalLanguage || '')) fail('INVALID_INPUT', 'payload.originalLanguage');
      changes.originalLanguage = p.originalLanguage;
    }
    if (p.assignedTo !== undefined) {
      if (p.assignedTo !== '' && knownActorIds(actors).indexOf(p.assignedTo) < 0) fail('INVALID_INPUT', 'payload.assignedTo');
      changes.assignedTo = p.assignedTo;
    }
    if (p.note !== undefined) changes.note = cleanNote(p.note);
    if (Object.keys(changes).length === 0) fail('INVALID_INPUT', 'payload');
    return changes;
  }

  function findIntake(deps, intakeId, expectedUpdatedAt) {
    var found = deps.intake.find(intakeId);
    if (!found) fail('NOT_FOUND');
    if (String(found.obj.updatedAt) !== expectedUpdatedAt) fail('REVISION_CONFLICT');
    return found;
  }

  /** Map a thrown engine error (KekbError from Engine.js) to a safe API error; anything else is INTERNAL. */
  function fromEngine(e) {
    if (!e || e.name !== 'KekbError' || typeof e.code !== 'string') return new KekbError('INTERNAL');
    var out = new KekbError(e.code, e.details && e.details.field);
    var d = {};
    DETAIL_KEYS.forEach(function (k) { if (e.details && e.details[k] !== undefined) d[k] = e.details[k]; });
    out.details = d;
    return out;
  }

  /**
   * deps: { nowMs(), clientId, actors, fetchClaims(idToken) → claims|null, newRequestId(),
   *         intake: { list() → [obj], find(intakeId) → {row, obj}|null, update(row, changes) },
   *         engine: KEKB_ENGINE.createEngine(...) instance, store: the engine's store (+ listReviews()),
   *         source: { verify(driveFileId) → {sha256, mimeType, modifiedAt} } (re-hashes the Drive bytes),
   *         idem: { get(key) → string|null, put(key, string) }, audit(entry), hash(text) }
   */
  function handle(rawBody, deps) {
    var requestId = deps.newRequestId();
    var actor = null; var action = null;
    function out(o) { o.requestId = requestId; o.contractVersion = CONTRACT_VERSION; return o; }
    try {
      if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > MAX_BODY) fail('INVALID_INPUT', 'body');
      var req;
      try { req = JSON.parse(rawBody); } catch (e) { fail('INVALID_INPUT', 'body'); }
      if (!isObj(req)) fail('INVALID_INPUT', 'body');
      onlyKeys(req, ['action', 'idToken', 'payload', 'idempotencyKey']);
      if (!Object.prototype.hasOwnProperty.call(ACTIONS, req.action)) fail('INVALID_INPUT', 'action');
      action = req.action;
      if (typeof req.idToken !== 'string' || req.idToken.length < 20 || req.idToken.length > 4096) fail('UNAUTHENTICATED');
      var claims;
      try { claims = deps.fetchClaims(req.idToken); } catch (e) { fail('DEPENDENCY_UNAVAILABLE'); }
      var email = verifyClaims(claims, deps.clientId, Math.floor(deps.nowMs() / 1000));
      actor = resolveActor(email, deps.actors);
      var spec = ACTIONS[action];
      if (spec.roles.length && !spec.roles.some(function (r) { return actor.roles.indexOf(r) >= 0; })) fail('FORBIDDEN');

      var idemKey = null; var payloadHash = null;
      if (spec.mutation) {
        if (!IDEM_KEY.test(req.idempotencyKey || '')) fail('INVALID_INPUT', 'idempotencyKey');
        idemKey = actor.actorId + '|' + req.idempotencyKey;
        payloadHash = deps.hash(KEKB.canonicalJson({ action: action, payload: req.payload === undefined ? null : req.payload }));
        var prior = deps.idem.get(idemKey);
        if (prior) {
          var p = JSON.parse(prior);
          if (p.payloadHash !== payloadHash) fail('IDEMPOTENCY_CONFLICT');
          return out({ ok: true, data: p.data, replayed: true });
        }
      }

      var data;
      try { data = run(action, req.payload, actor, deps); } catch (e) { throw e instanceof KekbError ? e : fromEngine(e); }
      if (spec.mutation) {
        deps.idem.put(idemKey, JSON.stringify({ payloadHash: payloadHash, data: data }));
        deps.audit({ actor: actor.actorId, action: 'api:' + action, target: data.target || '', outcome: 'OK', code: data.selfReview ? 'SELF_REVIEW' : '' });
      }
      return out({ ok: true, data: data });
    } catch (e) {
      if (!(e instanceof KekbError)) e = new KekbError('INTERNAL');
      if (actor && action && ACTIONS[action] && ACTIONS[action].mutation) {
        deps.audit({ actor: actor.actorId, action: 'api:' + action, target: '', outcome: 'FAILED', code: e.code });
      }
      var err = { code: e.code };
      if (e.code === 'INVALID_INPUT' && e.field) err.field = e.field; // field name only, never the value
      if (e.details && Object.keys(e.details).length) err.details = e.details;
      return out({ ok: false, error: err });
    }
  }

  function payloadObj(payload, keys) {
    if (payload === undefined) payload = {};
    if (!isObj(payload)) fail('INVALID_INPUT', 'payload');
    onlyKeys(payload, keys, 'payload');
    return payload;
  }
  function idList(v, field, max) {
    if (!Array.isArray(v) || v.length === 0 || v.length > max || v.some(function (x) { return !UUID_V7.test(x || ''); })) fail('INVALID_INPUT', field);
    return v.slice();
  }
  function head(r) {
    return { id: r.id, type: r.type, revision: r.revision, workflowState: r.workflowState, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
  }

  function run(action, payload, actor, deps) {
    var p;
    if (action === 'whoami') {
      if (payload !== undefined && !isObj(payload)) fail('INVALID_INPUT', 'payload');
      return { actorId: actor.actorId, roles: actor.roles, assignableActors: knownActorIds(deps.actors) };
    }
    if (action === 'intake.list') {
      return {
        items: deps.intake.list().map(function (o) {
          return { intakeId: o.intakeId, sourceAssetId: o.sourceAssetId, sourceRevision: o.sourceRevision, sourceKind: o.sourceKind, sha256: o.sha256,
            accessClassification: o.accessClassification, originalLanguage: o.originalLanguage, driveFileId: o.driveFileId, workflowState: o.workflowState,
            assignedTo: o.assignedTo, receivedAt: o.receivedAt, updatedAt: o.updatedAt, note: o.note };
        }),
      };
    }
    if (action === 'intake.update') {
      var changes = validateIntakeUpdate(payload, deps.actors);
      var found = findIntake(deps, payload.intakeId, payload.expectedUpdatedAt);
      // classification and language are frozen into the SourceAsset record once registered
      if (found.obj.sourceAssetId && (changes.accessClassification !== undefined || changes.originalLanguage !== undefined)) fail('INVALID_TRANSITION');
      changes.updatedAt = new Date(deps.nowMs()).toISOString();
      deps.intake.update(found.row, changes);
      return { target: payload.intakeId, updatedAt: changes.updatedAt, changed: Object.keys(changes).sort() };
    }
    if (action === 'source.register') {
      p = payloadObj(payload, ['intakeId', 'expectedUpdatedAt', 'locatorCapabilities']);
      if (!UUID_V7.test(p.intakeId || '')) fail('INVALID_INPUT', 'payload.intakeId');
      if (typeof p.expectedUpdatedAt !== 'string' || !p.expectedUpdatedAt) fail('INVALID_INPUT', 'payload.expectedUpdatedAt');
      var caps = p.locatorCapabilities;
      if (!Array.isArray(caps) || !caps.length || caps.some(function (c) { return LOCATORS.indexOf(c) < 0; })) fail('INVALID_INPUT', 'payload.locatorCapabilities');
      var row = findIntake(deps, p.intakeId, p.expectedUpdatedAt);
      var o = row.obj;
      if (o.workflowState !== 'RECEIVED' || o.sourceAssetId) fail('INVALID_TRANSITION');
      if (ACCESS.indexOf(o.accessClassification) < 0) fail('INVALID_INPUT', 'accessClassification');
      if (!BCP47.test(o.originalLanguage || '')) fail('INVALID_INPUT', 'originalLanguage');
      // sheet cells are untrusted: re-hash the Drive bytes and require the queued digest to match
      var v;
      try { v = deps.source.verify(String(o.driveFileId)); } catch (e) { fail('DEPENDENCY_UNAVAILABLE'); }
      if (!v || v.sha256 !== o.sha256) fail('REVISION_CONFLICT');
      var sa = deps.engine.registerSource(engineActor(actor), {
        digest: v.sha256, storageRef: 'kekb-intake:' + o.intakeId, sourceKind: v.mimeType, sourceVersion: v.modifiedAt,
        originalLanguage: o.originalLanguage, accessClassification: o.accessClassification, locatorCapabilities: caps,
      });
      var at = new Date(deps.nowMs()).toISOString();
      deps.intake.update(row.row, { sourceAssetId: sa.id, sourceRevision: sa.revision, workflowState: 'REGISTERED', updatedAt: at });
      return { target: sa.id, sourceAssetId: sa.id, revision: sa.revision, reused: sa.reused, updatedAt: at };
    }
    if (action === 'source.extracted') {
      p = payloadObj(payload, ['sourceId']);
      if (!UUID_V7.test(p.sourceId || '')) fail('INVALID_INPUT', 'payload.sourceId');
      var x = deps.engine.completeExtraction(engineActor(actor), { sourceId: p.sourceId });
      return { target: p.sourceId, workflowState: x.workflowState };
    }
    if (action === 'draft.list') {
      payloadObj(payload, []);
      return { items: deps.store.latestDrafts().map(head) };
    }
    if (action === 'draft.get') {
      p = payloadObj(payload, ['id', 'revision']);
      if (!UUID_V7.test(p.id || '')) fail('INVALID_INPUT', 'payload.id');
      if (p.revision !== undefined && !(p.revision === Math.floor(p.revision) && p.revision >= 1)) fail('INVALID_INPUT', 'payload.revision');
      var rec = deps.store.getDraft(p.id, p.revision);
      if (!rec) fail('NOT_FOUND');
      return { record: rec, revisions: deps.store.draftRevisions(p.id) };
    }
    if (action === 'draft.save') {
      p = payloadObj(payload, ['record', 'id', 'expectedRevision', 'sourceRefs']);
      if (!isObj(p.record)) fail('INVALID_INPUT', 'payload.record');
      if (p.id !== undefined && !UUID_V7.test(p.id || '')) fail('INVALID_INPUT', 'payload.id');
      if (p.expectedRevision !== undefined && (p.id === undefined || !(p.expectedRevision === Math.floor(p.expectedRevision) && p.expectedRevision >= 1))) fail('INVALID_INPUT', 'payload.expectedRevision');
      var refs = p.sourceRefs === undefined ? [] : p.sourceRefs;
      if (!Array.isArray(refs) || refs.length > 50 || refs.some(function (r) { return !isRef(r); })) fail('INVALID_INPUT', 'payload.sourceRefs');
      var saved = deps.engine.saveDraft(engineActor(actor), { record: p.record, id: p.id, expectedRevision: p.expectedRevision, sourceRefs: refs });
      return { target: saved.id + '@' + saved.revision, id: saved.id, revision: saved.revision };
    }
    if (action === 'draft.validate') {
      p = payloadObj(payload, ['ids']);
      var ids = p.ids === undefined ? undefined : idList(p.ids, 'payload.ids', 200);
      var res = deps.engine.validateDrafts(engineActor(actor), { ids: ids });
      return { target: (ids ? ids.length : res.validated.length + res.failed.length) + ' records', valid: res.valid, validated: res.validated, failed: res.failed, issues: res.issues.slice(0, 500) };
    }
    if (action === 'review.list') {
      payloadObj(payload, []);
      return {
        items: deps.store.listReviews().map(function (r) {
          return { requestId: r.requestId, status: r.status, targets: r.targets, protocolRef: r.protocolRef, createdBy: r.createdBy, createdAt: r.createdAt,
            decision: r.decision || '', snapshotId: r.snapshotId || '', reviewerId: r.reviewerId || '', closedAt: r.closedAt || '', selfReview: r.selfReview === true };
        }),
      };
    }
    if (action === 'review.request') {
      p = payloadObj(payload, ['targetIds', 'protocolId']);
      var targetIds = idList(p.targetIds, 'payload.targetIds', 200);
      if (!UUID_V7.test(p.protocolId || '')) fail('INVALID_INPUT', 'payload.protocolId');
      var rq = deps.engine.markReviewReady(engineActor(actor), { targetIds: targetIds, protocolId: p.protocolId });
      return { target: rq.requestId, requestId: rq.requestId };
    }
    if (action === 'review.decide') {
      p = payloadObj(payload, ['requestId', 'decision', 'reason']);
      if (!UUID_V7.test(p.requestId || '')) fail('INVALID_INPUT', 'payload.requestId');
      if (['APPROVE', 'NEEDS_REVISION', 'REJECT'].indexOf(p.decision) < 0) fail('INVALID_INPUT', 'payload.decision');
      if (!isObj(p.reason)) fail('INVALID_INPUT', 'payload.reason');
      onlyKeys(p.reason, ['th', 'en'], 'payload.reason');
      var reason = {};
      Object.keys(p.reason).forEach(function (k) { var t = cleanText(p.reason[k], 2000, 'payload.reason.' + k); if (t) reason[k] = t; });
      if (!Object.keys(reason).length) fail('INVALID_INPUT', 'payload.reason');
      var d = deps.engine.review(engineActor(actor), { requestId: p.requestId, decision: p.decision, reason: reason });
      return { target: d.snapshotId, snapshotId: d.snapshotId, decision: d.decision, validationResult: d.validationResult, selfReview: d.selfReview === true };
    }
    fail('INVALID_INPUT', 'action');
  }

  return { CONTRACT_VERSION: CONTRACT_VERSION, ACTIONS: ACTIONS, verifyClaims: verifyClaims, resolveActor: resolveActor, handle: handle };
})();

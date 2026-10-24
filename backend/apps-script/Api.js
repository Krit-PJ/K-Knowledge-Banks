/**
 * KEKB web API — pure logic (no Google services), P2-WP5 secure write boundary.
 * Every request: size → shape → allowed action → Google ID token claims → allowlist → role
 * → idempotency → expected revision → execute → audit. Errors are stable safe codes only.
 * Browser input (identity, roles, approval flags) is never trusted; identity comes from the
 * verified ID token and roles from the server-side allowlist (Script Properties).
 */
var KEKB_API = (function () {
  var CONTRACT_VERSION = 'v1.0-RC1';
  var MAX_BODY = 32768;
  var UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
  var ACTOR_ID = /^human:[a-z0-9._-]{1,64}$/;
  var IDEM_KEY = /^[A-Za-z0-9_-]{8,128}$/;
  var ACCESS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];
  var ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

  // role [] = any allowlisted actor; mutation = needs idempotencyKey and is audited as a write
  var ACTIONS = {
    whoami: { roles: [], mutation: false },
    'intake.list': { roles: ['CONTRIBUTOR', 'REVIEWER'], mutation: false },
    'intake.update': { roles: ['CONTRIBUTOR'], mutation: true },
  };

  function KekbError(code, field) { this.code = code; this.field = field; }
  function fail(code, field) { throw new KekbError(code, field); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function onlyKeys(o, allowed, field) {
    Object.keys(o).forEach(function (k) { if (allowed.indexOf(k) < 0) fail('INVALID_INPUT', field ? field + '.' + k : k); });
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

  function cleanNote(s) {
    if (typeof s !== 'string' || s.length > 500) fail('INVALID_INPUT', 'payload.note');
    return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }

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

  /**
   * deps: { nowMs(), clientId, actors, fetchClaims(idToken) → claims|null, newRequestId(),
   *         intake: { list() → [obj], find(intakeId) → {row, obj}|null, update(row, changes) },
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

      var data = run(action, req.payload, actor, deps);
      if (spec.mutation) {
        deps.idem.put(idemKey, JSON.stringify({ payloadHash: payloadHash, data: data }));
        deps.audit({ actor: actor.actorId, action: 'api:' + action, target: data.target || '', outcome: 'OK', code: '' });
      }
      return out({ ok: true, data: data });
    } catch (e) {
      if (!(e instanceof KekbError)) e = new KekbError('INTERNAL');
      if (actor && action && ACTIONS[action] && ACTIONS[action].mutation) {
        deps.audit({ actor: actor.actorId, action: 'api:' + action, target: '', outcome: 'FAILED', code: e.code });
      }
      var err = { code: e.code };
      if (e.code === 'INVALID_INPUT' && e.field) err.field = e.field; // field name only, never the value
      return out({ ok: false, error: err });
    }
  }

  function run(action, payload, actor, deps) {
    if (action === 'whoami') {
      if (payload !== undefined && !isObj(payload)) fail('INVALID_INPUT', 'payload');
      return { actorId: actor.actorId, roles: actor.roles, assignableActors: knownActorIds(deps.actors) };
    }
    if (action === 'intake.list') {
      return {
        items: deps.intake.list().map(function (o) {
          return { intakeId: o.intakeId, sourceKind: o.sourceKind, sha256: o.sha256, accessClassification: o.accessClassification,
            originalLanguage: o.originalLanguage, driveFileId: o.driveFileId, workflowState: o.workflowState, assignedTo: o.assignedTo,
            receivedAt: o.receivedAt, updatedAt: o.updatedAt, note: o.note };
        }),
      };
    }
    if (action === 'intake.update') {
      var changes = validateIntakeUpdate(payload, deps.actors);
      var found = deps.intake.find(payload.intakeId);
      if (!found) fail('NOT_FOUND');
      if (String(found.obj.updatedAt) !== payload.expectedUpdatedAt) fail('REVISION_CONFLICT');
      changes.updatedAt = new Date(deps.nowMs()).toISOString();
      deps.intake.update(found.row, changes);
      return { target: payload.intakeId, updatedAt: changes.updatedAt, changed: Object.keys(changes).sort() };
    }
    fail('INVALID_INPUT', 'action');
  }

  return { CONTRACT_VERSION: CONTRACT_VERSION, ACTIONS: ACTIONS, verifyClaims: verifyClaims, resolveActor: resolveActor, handle: handle };
})();

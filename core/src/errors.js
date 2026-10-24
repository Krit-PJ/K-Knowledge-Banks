// Stable safe error codes for the P1-WP3 slice (aligned with API-CONTRACT semantic categories).
export const ERR = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',       // actor unknown to the local registry
  FORBIDDEN: 'FORBIDDEN',                   // role / actor kind not permitted
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  REVISION_CONFLICT: 'REVISION_CONFLICT',   // expectedRevision or pinned review revision mismatch
  INVALID_TRANSITION: 'INVALID_TRANSITION', // workflow state skip / illegal move
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  READ_MODEL_INCOMPLETE: 'READ_MODEL_INCOMPLETE',
});
export class KekbError extends Error {
  constructor(code, details = {}) {
    super(code); this.name = 'KekbError'; this.code = code; this.details = details; // details: ids/paths/codes only
  }
  toJSON() { return { code: this.code, ...this.details }; }
}
export const fail = (code, details) => { throw new KekbError(code, details); };

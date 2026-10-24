# ADR-0002 — Draft storage on Drive and one workflow engine bundled for Apps Script

Documentation pack: **v1.0-RC2**
วันที่จัดทำ: 2026-10-25 (Asia/Bangkok)

Status: **Accepted** (2026-10-25)

## Metadata
- Author / date: Claude (agent) for the project owner, 2026-10-25
- Proposed baseline version: v1.0-RC2 → v1.0-RC2 (no schema, vocabulary or workflow-state change)
- Related: P2-WP6, OD-04 (Apps Script backend), OD-08 (self-review lenient + flag), ADR-0001

## Context and problem
P2-WP6 moves drafts, validation and human review from the local file store (P1-WP3) to the web (GitHub Pages console → Apps Script).
The baseline says Drive = raw sources, Sheets = operational workflow state, GitHub = canonical; it does not say where non-canonical drafts live.
Apps Script cannot run the Node validator (Ajv compiles code at runtime; no `fs`), and writing the rules twice risks two diverging rule sets.

## Options
1. Draft storage: (a) JSON files in a private Drive folder · (b) JSON inside Sheet cells (~50k chars/cell limit; mixes workflow state with content).
2. Server validation: (a) pre-compile the JSON Schemas with Ajv standalone at build time and bundle validator + engine into one `.gs` file · (b) re-implement rules in Apps Script.
3. Editor UI: (a) JSON editor + templates · (b) per-type forms.

## Decision
- **1a** Drafts and review requests are JSON files (one per `id@revision`, one per `requestId`) in a Drive folder created by the script (`KEKB Drafts (private)`), using scope `drive.file` (the script can write only files it created). Because `DriveApp.createFolder` demands the full `drive` scope (observed on the live project 2026-10-25), the draft store calls the Drive v3 REST API through `UrlFetchApp` with `ScriptApp.getOAuthToken()` — the token stays server-side, never in URLs, responses or logs. Sheets receive status copies only: `RecordStatus` (draft rows), `ReviewQueue`, `IntakeQueue.workflowState`, `AuditLog`. Review reasons and record content are not copied to Sheets.
- **2a** `core/src/engine.js` is the single storage-agnostic workflow engine (register → draft → validate → review-ready → review). Local core (`core/src/workflow.js`) and Apps Script both run it. `scripts/build-apps-script.mjs` generates `backend/apps-script/Engine.js` (Ajv standalone + esbuild 0.28.2, exact-pinned dev dependency); tests require byte-identical rebuilds and result parity with the Node validator on every golden case.
- **3a** Console uses a JSON editor with generated templates (`frontend/templates.json`).
- SourceAsset `storageRef` is `kekb-intake:<intakeId>` (no Drive IDs inside records); registration re-hashes the Drive bytes and refuses on mismatch (Sheet cells are untrusted).
- OD-08: a reviewer may decide on their own records; `selfReview` is recorded on the closed request and as `SELF_REVIEW` in AuditLog.

Invariants kept: Evidence → Model → Rules → Human Authority; AI has no path; human REVIEWER role required to decide; pinned revision + content hash; Sheets/Drive are not canonical; no secrets in frontend/repo/Sheets.

## Consequences and affected contracts
- Schema / vocabulary / workflow states: unchanged. API surface: new actions `source.register`, `source.extracted`, `draft.list|get|save|validate`, `review.list|request|decide` (semantic surface of API-CONTRACT; transport = Apps Script Web App, `contractVersion` v1.0-RC1).
- OAuth scopes: + `drive.file` (owner must re-authorize once and run `setupDrafts`).
- New dev dependency: `esbuild@0.28.2`. Generated files `backend/apps-script/Engine.js`, `frontend/templates.json` are committed and checked in CI.
- Limits: Drive listing per request (fine for hundreds of drafts; an index is a later optimization); idempotency retention 6 h (CacheService).

## Migration plan (required)
- Existing records and revisions: none on the web side (P1-WP3 local store is test-only); nothing to migrate.
- Mapping and compatibility: local core API unchanged (same exports; 90 → 113 tests green).
- Backup and execution: Drive version history covers draft files; rows are never deleted.
- Evidence/review invalidation: unchanged rules (content edit = new revision; pinned hash).
- Read-model rebuild: not affected (publication is a later packet).
- Rollback: redeploy Web App version 1 (P2-WP5) and remove the `drive.file` scope; the Drafts folder can stay (not canonical).
- Validation: `npm test` (engine parity on 35+ golden cases, API, Code.js adapter on fakes, UI smoke), mutation 10/10.

## User approval (required)
- Decision: APPROVED
- Approver / timestamp / explicit scope: project owner, 2026-10-25 00:51+07:00 — chose “2” (start P2-WP6) and then selected the recommended option for all three questions: Drive JSON drafts, pre-compile + bundle validator, JSON editor + template.
- Evidence reference: chat session https://claude.ai/code/session_01R9ydo4H7VyncZXxdXyj34z

## Implementation and follow-up
Affected files: `core/src/engine.js`, `core/src/workflow.js`, `core/src/canonical-json.js`, `validator/src/contracts.js`, `scripts/*.mjs`, `backend/apps-script/{Engine,Api,Code,Lib}.js`, `appsscript.json`, `frontend/console.*`, `frontend/templates.json`, tests. Follow-up: publication (commit to GitHub canonical) with a server-side write credential, Gap/Conflict candidates.

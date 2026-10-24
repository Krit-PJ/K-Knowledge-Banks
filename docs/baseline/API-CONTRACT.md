# API Contract

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

สัญญาระดับ semantic v1.0-RC1; ตาราง endpoint ด้านล่างเป็น proposed surface เพื่อทบทวน ยังไม่ล็อก transport/runtime/provider หรือ OpenAPI implementation

| Operation / proposed endpoint | Input | Output / rule |
|---|---|---|
| Search: GET /v1/search | query, language, filters, cursor, limit | items, nextCursor, canonicalRevision, readModelRevision, stale flag; ตรวจ visibility |
| Read: GET /v1/records/{id} | ID, optional revision | typed record และ provenance ที่เปิดเผยได้; ไม่พบ/ไม่มีสิทธิ์ไม่รั่วข้อมูล |
| Draft: POST /v1/drafts | typed payload, source references, idempotency key | draft ID/revision; ไม่ publish |
| Update: PATCH /v1/drafts/{id} | expectedRevision, permitted changes | revision ใหม่; conflict ถ้า revision เก่า |
| Validate: POST /v1/validations | target ID+revision | validation ID, errors/warnings, rule versions; ไม่อนุมัติ |
| Review: POST /v1/reviews | target/evidence revisions, protocol version, human decision/reason | immutable ReviewSnapshot; ตรวจ reviewer authority |
| Publish: POST /v1/publications | approved snapshot ref, expectedRevision, idempotency key | canonical revision/publication status; ห้าม bypass human approval |
| Candidate: POST /v1/candidates | GapCandidate หรือ ConflictCandidate พร้อม provenance | candidate ID/state; ไม่ใช่ canonical decision |

## Common contract
- Response ต้องระบุ contractVersion = v1.0-RC1 และ correlation/request ID; list มี bounded pagination; timestamps ใช้รูปแบบที่ Phase 1 ยืนยันให้เป็นหนึ่งเดียว
- Error มี stable code, safe message, field issues และ request ID ไม่คืน stack/secrets; semantic categories: INVALID_INPUT, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, REVISION_CONFLICT, RATE_LIMITED, DEPENDENCY_UNAVAILABLE
- HTTP mapping ที่เสนอ: 400/422 validation, 401 authentication, 403 authorization, 404 not found, 409 revision conflict, 429 limit, 503 dependency unavailable; ต้องยืนยันก่อน implementation
- Mutation ตรวจ schema/version, refs, evidence, permissions และ expectedRevision ฝั่ง server; reject client-supplied reviewer identity/approved flag ที่ใช้หลอก authority
- idempotency key เดิม+payload เดิมให้ผลเดิม; key เดิม+payload ต่างต้อง conflict; retention และ retry policy รอยืนยัน
- Public frontend ไม่ถือ service credential; browser auth/CSRF/CORS policy ต้องสรุปก่อน Phase 2; CORS ไม่ใช่ authorization
- Read model lag ต้องรายงาน revision/stale; backend failure ต้องไม่สร้าง success ปลอม

## Approval dependencies
ต้องยืนยัน auth mechanism, endpoint naming, exact payload schema, ID/cursor representation, limits และ compatibility policy ใน Phase 1 การเปลี่ยน contract ที่ล็อกแล้วใช้ ADR + migration plan + User approval

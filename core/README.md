# KEKB Core — No-AI Vertical Slice (P1-WP3)

Manual flow บน local file store: `intake → draft → validate → review-ready → human review → commit → read model → search / evidence trace`

ไม่มีโค้ด AI, ไม่มี network และไม่มี dependency เพิ่มจาก validator (Node.js ≥ 22)

## Store layout (local files ตามที่ผู้ใช้อนุมัติ 2026-10-24)

| โฟลเดอร์ | แทนบทบาท |
|---|---|
| `sources/` | Drive raw SourceAsset (content-addressed, ไม่ถูกรัน) |
| `workspace/records/` | draft records |
| `workflow/` | Sheets operational state: actors, review requests, idempotency, `audit.jsonl` |
| `canonical/` | GitHub canonical; `manifest.json` คือ commit point |
| `read-models/` | read models ต่อ canonical revision + `ACTIVE.json` (สลับหลัง completeness check เท่านั้น) |

## Authority

- **CONTRIBUTOR (human):** intake, draft, validate และ review-ready
- **REVIEWER (human):** ตัดสินใจ review ได้เท่านั้น ส่วน actor ชนิด `ai` ไม่มีสิทธิ์ใดเลยแม้จะมี role
- **Service principal:** สิทธิ์ `commit` และ `publish`
- **ข้อจำกัด:** actor registry เป็น local file และ**ยังไม่ใช่ authentication** จนกว่าจะตัดสิน OD-04

## CLI

```bash
node core/bin/kekb.js init   --store ./kb-local --args actors.json
node core/bin/kekb.js search --store ./kb-local --args query.json   # {"query":"ผลผลิตข้าว"}
node core/bin/kekb.js trace  --store ./kb-local --args trace.json   # {"id":"<claim id>"}
```

## Confirmed bindings B6–B8 (OD-06 ปิดแล้ว: ผู้ใช้ยืนยัน 2026-10-24; การเปลี่ยนต้องผ่าน ADR)

- **B6:** การเปลี่ยน workflow state ไม่เพิ่ม revision แต่การแก้เนื้อหาต้องเพิ่ม revision และกลับไปเป็น `EXTRACTED`
  - review ตรึง `contentHash` ที่ไม่รวม `workflowState` และ `updatedAt`
  - commit ตรวจ hash ซ้ำอีกครั้งก่อนเขียน
- **B7:** สถานะ `PUBLISHED` บันทึกที่ read-model `ACTIVE` และ audit log ส่วน canonical record คงเป็น `COMMITTED`
- **B8:** ReviewProtocol ชุดแรกถูกอนุมัติใน batch เดียวกับ record ที่ใช้ protocol นั้น เรื่อง protocol governance ยังต้องตัดสิน
  - ReviewSnapshot เปลี่ยนจาก `VALIDATED` เป็น `COMMITTED` ตอน commit ตามแนว B2

## ไม่อยู่ใน scope

Drive, Sheets, GitHub remote, backend/API, authentication, UI, concurrency หลาย process, DerivationRun dependency invalidation (GT-07) และ Gap/Conflict queue (Phase 2)

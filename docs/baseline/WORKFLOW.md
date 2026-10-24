# Workflow

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Lifecycle
`RECEIVED → REGISTERED → EXTRACTED → VALIDATED → REVIEW_READY → APPROVED → COMMITTED → PUBLISHED`

Side states: `NEEDS_REVISION`, `REJECTED`, `ERROR`, `SUPERSEDED`

State identifiers เป็น Technical English ตาม Master Development Prompt v1.1 ส่วนข้อความแสดงผลภาษาไทยอยู่ใน localization layer ห้ามข้าม state เช่น `EXTRACTED → PUBLISHED` และ AI ห้ามทำ transition `REVIEW_READY → APPROVED`

| Step | ผู้รับผิดชอบ / เงื่อนไขออกจากขั้น |
|---|---|
| RECEIVED | CONTRIBUTOR รับ source เข้าคิวโดยยังไม่ถือว่า register สำเร็จ |
| REGISTERED | ลงทะเบียน SourceAsset/version ใน Drive และ operational queue ใน Sheets พร้อม stable ID/hash |
| EXTRACTED | สร้าง draft model แยก Study/Report/AnalysisRun/Result/Finding/Claim และ Evidence/ClaimFrame; AI ช่วยเสนอได้แต่ไม่มี authority |
| VALIDATED | deterministic rules ผ่าน schema, refs, evidence, vocabulary, lineage และ security classification |
| REVIEW_READY | ตรึง target/evidence revisions และ ReviewProtocol เพื่อรอ REVIEWER |
| APPROVED | REVIEWER มนุษย์อนุมัติ revision ที่ระบุพร้อมเหตุผล; candidate และ AI ห้ามอนุมัติตัวเอง |
| COMMITTED | secure backend ตรวจ approval/revision/permission แล้วเขียน canonical revision สำเร็จ |
| PUBLISHED | read models ของ canonical revision ผ่าน completeness check และถูกสลับเป็น active output |
| Revisit | source/context/rules เปลี่ยน → revision/dependency stale → กลับเข้าสู่ validation/review ก่อน publish revision ใหม่ |

GapCandidate/ConflictCandidate เข้าคิวตรวจ ไม่แก้ canonical claim โดยอัตโนมัติ ผู้ตรวจเปรียบเทียบ context และ coverage ก่อนยืนยัน/ปฏิเสธ พร้อม reason/provenance

## Failure and concurrency
mutation ต้องตรวจ expected revision; stale write ให้ conflict และโหลดข้อมูลใหม่ retry ไม่สร้าง publication ซ้ำ เก็บ audit actor/action/target/revision/outcome โดยไม่ใส่ secret

หาก Drive/Sheets ไม่พร้อม ให้เก็บ draft และแจ้งสถานะ ห้ามสรุป review ผ่านจากการขาดข้อมูล published revision เก่ายังคงเข้าถึงได้ตามสิทธิ์และ policy โดยแสดงความล้าสมัยชัดเจน

## Development gates
Workflow ของความรู้แยกจาก development phases ทั้งสี่ แต่ละ phase ต้องรายงานและรอ User approval ก่อน phase ถัดไป รวมถึง gate ก่อนเริ่ม Phase 1

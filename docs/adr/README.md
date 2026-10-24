# Architecture Decision Records

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

ใช้ ADR บันทึกการเปลี่ยน baseline semantics, architecture, schema, vocabulary, workflow, API, security, golden/acceptance outcomes และ scope ที่ล็อกไว้ ทุกการเปลี่ยนต้องมี **ADR + migration plan + User approval** ก่อนใช้

เริ่มจาก [ADR-0000-template](ADR-0000-template.md) แล้วสร้างหมายเลขจริงถัดไป 0001, 0002 … template ไม่ใช่ accepted decision

Lifecycle: Proposed → Accepted / Rejected → Superseded ไม่ลบประวัติ decision อ้าง baseline ก่อน/หลัง ผลกระทบเอกสาร/ข้อมูล/API/fixtures และ approval evidence อัปเดต BASELINE version lock กับ PROJECT-STATE เมื่ออนุมัติ

Migration plan ต้องครอบคลุม mapping, validation, compatibility, backup, rollback, read-model rebuild และ stale review/dependency แม้ไม่มีข้อมูลต้องระบุว่าไม่มีข้อมูลให้ย้ายพร้อมเหตุผล การแก้ถ้อยคำที่ไม่เปลี่ยนความหมายให้บันทึกเหตุผลในรายงานงาน; หากไม่แน่ใจว่ากระทบ semantic ให้เสนอ ADR ก่อน

Accepted ADRs:

- [ADR-0001 — First-class topic taxonomy for news and technology trends](ADR-0001-topic-taxonomy.md)
- [ADR-0002 — Draft storage on Drive and one workflow engine bundled for Apps Script](ADR-0002-draft-storage-and-apps-script-engine.md)

Runtime ที่อนุมัติแล้ว: validator = Node.js + Ajv (P1-WP2), backend = Google Apps Script (OD-04), auth = Google Sign-In + allowlist (P2-WP5), bundler = esbuild (ADR-0002)

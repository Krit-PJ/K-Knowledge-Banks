# Phase 2 — Secure Workflow & Canonical Publication

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Ready-to-use phase prompt
ดำเนิน Phase 2 ของ K-Knowledge Bank เป้าหมาย: เชื่อม source/workflow/review/publication เป็น manual vertical slice

เริ่มได้เฉพาะเมื่อมี User approval ระบุ Phase 2 ใน [PROJECT-STATE](PROJECT-STATE.md) และ Phase ก่อนหน้าผ่าน gate หากยังไม่มีให้เตรียม review packet โดยไม่เขียน Application Code

ปฏิบัติตาม [AGENTS](../../AGENTS.md) และ [version lock](../baseline/BASELINE.md) อ่านเฉพาะ [ARCHITECTURE](../baseline/ARCHITECTURE.md), [WORKFLOW](../baseline/WORKFLOW.md), [API-CONTRACT](../baseline/API-CONTRACT.md), [SECURITY](../baseline/SECURITY.md) และส่วนอื่นที่งานอ้างถึง

ใช้ Phase 1 contracts เชื่อม Drive raw source และ Sheets workflow ผ่าน backend ที่ตรวจสิทธิ์ สร้าง draft/validation/review snapshot/publication flow และ DerivationRun/dependency invalidation รองรับ GapCandidate/ConflictCandidate ที่รอมนุษย์ตัดสิน

Deliverables: secure write boundary, audit trail, revision conflict/idempotency handling, canonical structured knowledge v1 publication และ AI-off end-to-end demonstration ด้วยข้อมูลสมมติ

Exit evidence: AC-02..05,08..10 ในส่วน backend; GT-07..10,12; ไม่มี private source/secret ใน public payload; ไม่ใช้ AI เป็น dependency

## Mandatory stop gate
อัปเดต PROJECT-STATE ด้วย packet ที่เสร็จ ไฟล์ที่กระทบ ผลทดสอบจริง/NOT RUN ความเสี่ยง และแผนงานถัดไป แล้วหยุดรอ User approval เริ่ม Phase 3 ห้ามเริ่ม phase ถัดไปจาก prompt นี้โดยอัตโนมัติ การเปลี่ยน baseline ใช้ ADR + migration plan + User approval

หมายเหตุ: phase allocation นี้ consolidate เพื่อเสนอ review ไม่ใช่ต้นฉบับ phase prompt ที่ยืนยันแล้ว

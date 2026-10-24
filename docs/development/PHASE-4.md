# Phase 4 — Hardening, Recovery & Handover

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Ready-to-use phase prompt
ดำเนิน Phase 4 ของ K-Knowledge Bank เป้าหมาย: ตรวจครบ end-to-end และส่งมอบพร้อมข้อจำกัดจริง

เริ่มได้เฉพาะเมื่อมี User approval ระบุ Phase 4 ใน [PROJECT-STATE](PROJECT-STATE.md) และ Phase ก่อนหน้าผ่าน gate หากยังไม่มีให้เตรียม review packet โดยไม่เขียน Application Code

ปฏิบัติตาม [AGENTS](../../AGENTS.md) และ [version lock](../baseline/BASELINE.md) อ่านเฉพาะ [SECURITY](../baseline/SECURITY.md), [GOLDEN-TESTS](../baseline/GOLDEN-TESTS.md), [ACCEPTANCE-TESTS](../baseline/ACCEPTANCE-TESTS.md), [MVP-SCOPE](../baseline/MVP-SCOPE.md) และส่วนอื่นที่งานอ้างถึง

ตรวจ regression, authorization, injection, secret exposure, dependency failure และ restore drill ตรวจ full AI-off slice รวม frontend/backend/source/review/canonical/read models จัด operator guide และ known limitations

Deliverables: acceptance matrix พร้อมผลจริง, recovery/runbook, security review และ readiness report อัปเดต PROJECT-STATE ให้ติดตาม release decision ได้ ไม่มีสิทธิ์ deploy/commit/tag อัตโนมัติ

Exit evidence: AC-01..14 ทุกข้อที่อยู่ใน MVP และ GT-01..15; blocker เป็นศูนย์หรือมีการแก้ baseline ผ่าน change control ที่อนุมัติแล้ว; ขอ User approval ปิด Phase 4 และรับมอบ

## Mandatory stop gate
อัปเดต PROJECT-STATE ด้วย packet ที่เสร็จ ไฟล์ที่กระทบ ผลทดสอบจริง/NOT RUN ความเสี่ยง และแผนงานถัดไป แล้วหยุดรอ User approval รับมอบ/ดำเนินการ release แยกตามคำสั่ง ห้ามเริ่ม phase ถัดไปจาก prompt นี้โดยอัตโนมัติ การเปลี่ยน baseline ใช้ ADR + migration plan + User approval

หมายเหตุ: phase allocation นี้ consolidate เพื่อเสนอ review ไม่ใช่ต้นฉบับ phase prompt ที่ยืนยันแล้ว

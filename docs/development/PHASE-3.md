# Phase 3 — Thai-first Frontend & Generated Read Models

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Ready-to-use phase prompt
ดำเนิน Phase 3 ของ K-Knowledge Bank เป้าหมาย: ให้ค้นหา ตรวจหลักฐาน และ review ผ่าน frontend ได้

เริ่มได้เฉพาะเมื่อมี User approval ระบุ Phase 3 ใน [PROJECT-STATE](PROJECT-STATE.md) และ Phase ก่อนหน้าผ่าน gate หากยังไม่มีให้เตรียม review packet โดยไม่เขียน Application Code

ปฏิบัติตาม [AGENTS](../../AGENTS.md) และ [version lock](../baseline/BASELINE.md) อ่านเฉพาะ [ARCHITECTURE](../baseline/ARCHITECTURE.md), [VOCABULARY](../baseline/VOCABULARY.md), [API-CONTRACT](../baseline/API-CONTRACT.md), [MVP-SCOPE](../baseline/MVP-SCOPE.md) และส่วนอื่นที่งานอ้างถึง

สร้าง generated read models ที่มี revision manifest และ rebuild ได้ พัฒนา GitHub Pages frontend สำหรับ search/detail/provenance/review เป็นภาษาไทยหลัก รองรับ labels หลายภาษาและแสดง original text/context ชัดเจน mutation ผ่าน secure API

Deliverables: usable frontend, bounded search/filter, provenance navigation, stale/error states และ read-model generation ที่คง last-known-good output 2D เป็น optional เฉพาะเมื่อไม่ขยาย scope; 3D เลื่อนหลัง MVP

Exit evidence: AC-06,07,10,11 และ frontend portion AC-08; GT-05,06,11,13; ทดสอบ private data visibility และตรวจว่า graph ไม่ทำ ClaimFrame สูญบริบท

## Mandatory stop gate
อัปเดต PROJECT-STATE ด้วย packet ที่เสร็จ ไฟล์ที่กระทบ ผลทดสอบจริง/NOT RUN ความเสี่ยง และแผนงานถัดไป แล้วหยุดรอ User approval เริ่ม Phase 4 ห้ามเริ่ม phase ถัดไปจาก prompt นี้โดยอัตโนมัติ การเปลี่ยน baseline ใช้ ADR + migration plan + User approval

หมายเหตุ: phase allocation นี้ consolidate เพื่อเสนอ review ไม่ใช่ต้นฉบับ phase prompt ที่ยืนยันแล้ว

# Phase 1 — Foundation & No-AI Vertical Slice

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Ready-to-use phase prompt
ดำเนิน Phase 1 ของ K-Knowledge Bank เป้าหมาย: วาง foundation, Formal schema, vocabulary registry และพิสูจน์ vertical slice แบบไม่พึ่ง AI ตั้งแต่ manual intake ถึง search/evidence trace

เริ่มได้เฉพาะเมื่อมี User approval ระบุ Phase 1 ใน [PROJECT-STATE](PROJECT-STATE.md) หลัง baseline consistency review หากยังไม่มีให้เตรียม review packet โดยไม่เขียน Application Code

ปฏิบัติตาม [AGENTS](../../AGENTS.md) และ [version lock](../baseline/BASELINE.md) อ่านเฉพาะ [DATA-MODEL](../baseline/DATA-MODEL.md), [VOCABULARY](../baseline/VOCABULARY.md), [GOLDEN-TESTS](../baseline/GOLDEN-TESTS.md), [ACCEPTANCE-TESTS](../baseline/ACCEPTANCE-TESTS.md) และส่วนอื่นที่งานอ้างถึง

ยืนยัน pending decisions ใน PROJECT-STATE ที่กระทบ phase นี้ก่อน เลือก serialization/ID/enums/null semantics และ API/security bindings ด้วยหลักฐานและการอนุมัติที่เหมาะสม จากนั้นจึงสร้าง executable contracts/validators, synthetic golden fixtures และ No-AI vertical slice เมื่อ User อนุมัติการเขียนโค้ดแล้ว

Deliverables: versioned schema/vocabulary, deterministic validation, golden fixtures และ vertical slice ที่ทำ manual intake → validation → human review → approval → canonical commit → generated read model → search/evidence trace ได้เมื่อปิด AI ทั้งหมด โดยแยก Study/Report/AnalysisRun/Result/Finding/Claim พร้อม contextual/n-ary ClaimFrame และ dependency rules

Exit evidence: AC-01, AC-02 และ No-AI core portion ของ AC-03; GT-01..06,10,12,14,15; แสดง invalid cases ถูก reject, human authority ไม่ถูก bypass และระบุ external Drive/Sheets/deployment cases ที่ยัง NOT RUN

## Mandatory stop gate
อัปเดต PROJECT-STATE ด้วย packet ที่เสร็จ ไฟล์ที่กระทบ ผลทดสอบจริง/NOT RUN ความเสี่ยง และแผนงานถัดไป แล้วหยุดรอ User approval เริ่ม Phase 2 ห้ามเริ่ม phase ถัดไปจาก prompt นี้โดยอัตโนมัติ การเปลี่ยน baseline ใช้ ADR + migration plan + User approval

หมายเหตุ: ชื่อและเป้าหมาย Phase 1 ปรับตรง Master Development Prompt v1.1 ตามคำอนุมัติผู้ใช้วันที่ 2026-10-23; รายละเอียด executable binding ยังรออนุมัติ proposal

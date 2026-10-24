# MASTER DEVELOPMENT PROMPT v1.1 — Operational Consolidation

Documentation pack: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

เอกสารนี้บรรจุสาระ Master Development Prompt สำหรับใช้งานจริงตามคำสั่งผู้ใช้ ไม่ใช่การคัดลอกต้นฉบับที่ยังเข้าถึงไม่ได้ เลข v1.1 เป็นเวอร์ชัน prompt; baseline ปัจจุบันเป็น v1.0-RC2 ตาม ADR-0001 (RC1 คงไว้เพื่อ compatibility) ดู version lock ใน BASELINE

## เป้าหมายและลำดับอ่าน
สร้าง K-Knowledge Bank ที่ Thai-first Multilingual, AI-Independent Core และมี evidence provenance อ่าน [BASELINE](docs/baseline/BASELINE.md), [PROJECT-STATE](docs/development/PROJECT-STATE.md) และเฉพาะเอกสารที่เกี่ยวข้องกับ work packet ก่อนทำงาน

ยึดคำสั่งผู้ใช้ปัจจุบันและ baseline ที่อนุมัติแล้ว หากเอกสารขัดกัน อย่าเลือกตีความเงียบ ๆ ให้บันทึก conflict และหยุดเฉพาะส่วนที่ได้รับผลกระทบ ห้ามอ้างบทสนทนาหรือผล AI เป็น canonical authority

## ข้อบังคับสถาปัตยกรรม
- Evidence→Model→Rules→Human Authority; ผู้ตรวจมนุษย์ตัดสินการยอมรับ/ปฏิเสธ ระบบและ AI ห้ามอนุมัติตนเอง
- Study≠Report, Result≠Finding≠Claim; ClaimFrame เป็น contextual/n-ary; คง RelationAssertion, DerivationRun, GapCandidate/ConflictCandidate, ReviewProtocol/ReviewSnapshot และ Evidence dependency
- GitHub Pages เป็น frontend; secrets และ write authority อยู่ Secure Backend/API; Drive เก็บ raw source; Sheets จัด workflow; GitHub เก็บ canonical structured knowledge v1; read models ต้องสร้างใหม่จาก canonical ได้
- ปิด AI แล้ว intake, manual modeling, validation, human review, publication และ search ต้องทำงานได้
- เก็บ original language/ข้อความต้นฉบับ; แปลไทยเพื่อแสดงผลได้ แต่ห้ามเปลี่ยน ID หรือ semantic identity ตาม label

## วิธีทำ work packet และประหยัด token/context
1. ตรวจสถานะและขอบเขต phase ที่อนุมัติ ระบุเป้าหมาย ไฟล์ที่กระทบ baseline references และ acceptance IDs ก่อนแก้
2. อ่านแบบเจาะจง ใช้ค้นหาชื่อ/ID/หัวข้อและช่วงเนื้อหา ไม่โหลดแชตหรือ repository ทั้งหมดโดยไม่มีเหตุผล ไม่คัดลอก baseline ซ้ำลงทุก prompt
3. ทำหนึ่งผลลัพธ์ที่ตรวจรับได้ต่อ packet ใช้ diff เล็ก รักษางานผู้ใช้ สำรองก่อน merge ไฟล์ที่มีเนื้อหา ห้ามลบ source/dataset/Git history
4. ตรวจ acceptance และ negative cases ที่สัมพันธ์กับงาน บันทึกคำสั่ง/ผลจริง แยก NOT RUN ออกจาก PASS ห้ามสร้างผลทดสอบขึ้นเอง
5. อัปเดต PROJECT-STATE ด้วยสิ่งที่เสร็จ หลักฐาน ข้อจำกัด open decisions และ next packet ให้ agent ถัดไปเริ่มจากสถานะนี้ได้

## Gates และ change control
ขณะนี้ Coding = STARTED เฉพาะ Phase 1 ตาม approval ledger ใน [PROJECT-STATE](docs/development/PROJECT-STATE.md) ทำงานได้เฉพาะ Foundation & No-AI Vertical Slice; ห้ามเริ่ม Phase 2 จนได้รับอนุมัติใหม่

ทุก phase จบด้วยรายงาน deliverables, test evidence, unresolved risks และขอบเขต phase ถัดไป แล้วหยุดรอ User approval ระบุผู้อนุมัติ วันที่ และขอบเขตใน PROJECT-STATE ห้ามข้าม phase หรือถือว่าความเงียบเป็นอนุมัติ

การเปลี่ยน Architecture/Formal Schema/Vocabulary/Workflow/API/Security/Golden Tests/Acceptance Tests หรือ semantic invariants ต้องมี ADR + migration plan + User approval ก่อนนำไปใช้ แผนต้องครอบคลุมข้อมูลเก่า compatibility rollback และการสร้าง read models ใหม่ ดู [ADR](docs/adr/README.md)

ไม่เลือก backend provider, authentication provider, runtime, framework หรือ dependency เองก่อน decision ที่เกี่ยวข้องได้รับการอนุมัติ ห้าม commit/tag/deploy เว้นแต่ผู้ใช้สั่ง แสดงข้อจำกัดอย่างตรงไปตรงมา

## Phase prompts
ใช้ [Phase 1](docs/development/PHASE-1.md), [Phase 2](docs/development/PHASE-2.md), [Phase 3](docs/development/PHASE-3.md), [Phase 4](docs/development/PHASE-4.md) โดยไม่ทำซ้ำข้อบังคับในเอกสารนี้

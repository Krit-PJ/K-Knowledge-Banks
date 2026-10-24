# Golden Tests

Baseline version: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

สร้าง synthetic Phase 1 fixture manifest แล้วที่ [`fixtures/golden/phase1-manifest.json`](../../fixtures/golden/phase1-manifest.json) แต่ยังไม่ได้สร้าง validator runner หรือรัน expected outcomes ผล GT ทั้งหมดยังคง = NOT RUN

ใช้ข้อมูลสมมติ ไม่มี PII/source จริง แต่ละ fixture ต้องตรึง input revisions, schema/vocabulary/rule/protocol versions, expected result และเหตุผล เปรียบเทียบ semantic output หลัง normalize ลำดับ; ไม่ผูก timestamp/run ID ที่เปลี่ยนทุกครั้ง

| ID | Fixture / expected outcome |
|---|---|
| GT-01 | Study S1 มี Report R1/R2 → เป็น Study เดียว มีสอง Report ไม่เพิ่ม evidence independence จาก citation ซ้ำ |
| GT-02 | Report R3 กล่าวถึง S1/S2 → คง Study สองตัว; ไม่บังคับ one-to-one |
| GT-03 | Result X1, Finding F1, Claim C1 อ้างต่อกัน → คงสาม type และ evidenceRefs; ไม่ merge เป็นข้อความชนิดเดียว |
| GT-04 | Claim ไม่มี Evidence หรือ locator/source version ขาด → validation fail และ publish blocked |
| GT-05 | ClaimFrame มี intervention/comparator/population/outcome/time → ทุก role/context คงอยู่ใน canonical และ view; ไม่ย่อจนบริบทหาย |
| GT-06 | RelationAssertion มีหลาย participant และ evidence → เก็บ role bindings; ความสัมพันธ์ไม่มี review ไม่แสดงเป็น approved fact |
| GT-07 | DerivationRun input revision เก่า → output traceable; เปลี่ยน input แล้ว output/review dependent เป็น stale; self-cycle lineage ถูก reject |
| GT-08 | claims ข้อความดูตรงข้ามแต่ population/time ต่าง → เป็น ConflictCandidate ให้ตรวจ context; ไม่ตัดสิน contradiction อัตโนมัติ |
| GT-09 | ไม่พบข้อมูลในชุดค้นจำกัด → GapCandidate ระบุ scope/coverage; ไม่อ้างว่าไม่มี evidence ทั้งหมด |
| GT-10 | ReviewSnapshot อนุมัติ C1 rev1 แล้วแก้ rev2 → rev2 publish ไม่ได้ด้วย snapshot เดิม |
| GT-11 | label ไทย/อังกฤษของ concept เดียว → ID เดิม; original excerpt คงภาษาเดิม; translation ไม่สร้าง independent evidence |
| GT-12 | ปิด AI → manual intake→model→validate→review→publish→search สำเร็จโดยไม่เรียก AI |
| GT-13 | canonical revision เดียวสร้าง read models สองครั้ง → semantic output ตรงกันและ revision manifest ตรง; ล้มเหลวไม่สลับ active output |
| GT-14 | dangling ref, duplicate ID, unsupported schemaVersion → validation reject พร้อม safe field issues |
| GT-15 | same measure ต่าง unit/context และ unknown vs not applicable → ไม่ merge/เติมค่าเงียบ ๆ |
| GT-16 | known topic IDs หลายค่า → validation ผ่านและ resolve parent navigation ได้; unknown/duplicate topic ID → reject |
| GT-17 | GitHub popularity/trend มี metric+time window+source snapshot+parameters+DerivationRun → reproducible; ขาดองค์ประกอบใด → publish blocked |

แต่ละกรณีต้องมี negative fixture ที่แก้เพียง invariant เดียวเมื่อเหมาะสม และต้องให้มนุษย์ยืนยัน golden expected outputs ก่อนใช้เป็น regression authority การเปลี่ยน expected semantics ใช้ ADR + migration plan + User approval

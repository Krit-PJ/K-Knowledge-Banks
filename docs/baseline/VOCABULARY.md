# Vocabulary

Baseline version: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

ใช้ identifier ภาษาอังกฤษที่ stable และ label ภาษาไทยเป็นหลัก พร้อม labels/aliases แยกตาม language tag ไม่แปลชื่อ entity/type ใน canonical identity ข้อความต้นฉบับยังคง original language

| Canonical term | คำอธิบายไทย / ห้ามสับสน |
|---|---|
| Study | หน่วยการศึกษา ไม่ใช่ไฟล์รายงาน |
| Report | เอกสารรายงาน ไม่ใช่หน่วยการศึกษา |
| Evidence | หลักฐานที่ชี้ถึง source version และ locator |
| Result | ผลที่รายงาน ไม่ใช่การตีความ |
| Finding | ข้อค้นพบจากการตีความผล ไม่ใช่ Claim โดยอัตโนมัติ |
| Claim | ข้อเสนอเชิงความรู้ในบริบทที่กำหนด |
| ClaimFrame | กรอบหลายบทบาทและบริบทของ Claim (contextual/n-ary) |
| RelationAssertion | ข้อกล่าวอ้างความสัมพันธ์ที่ต้องมีหลักฐานและ review |
| DerivationRun | บันทึกการแปลง/อนุมานพร้อม input/output revisions |
| GapCandidate | ข้อเสนอช่องว่างที่ยังรอตรวจ |
| ConflictCandidate | ข้อเสนอความขัดแย้งที่ยังรอตรวจ |
| ReviewProtocol | เกณฑ์และวิธีตรวจรับที่มี version |
| ReviewSnapshot | ภาพตรึง revision หลักฐานและผลตัดสินมนุษย์ |
| canonical | ข้อมูล authoritative ใน GitHub ที่ผ่าน workflow |
| generated read models | สำเนาที่สร้างจาก canonical เพื่ออ่าน/ค้นหา ไม่ใช่ authority |

การเพิ่ม predicate/role/alias ต้องมี definition, domain/range หรือ allowed participant types, language labels และตัวอย่างแยกความหมาย คำพ้องไม่ใช่เหตุผลเพียงพอในการ merge concepts

Predicate, participant role และ controlled enum สำหรับ Phase 1 ให้ยึด [Vocabulary Registry](../proposals/VOCABULARY-v1.0-RC1-PROPOSAL.md) ที่ผู้ใช้อนุมัติวันที่ 2026-10-23 การเปลี่ยน definition/domain/range/cardinality หลังจากนี้ผ่าน ADR + migration plan + User approval

Topic taxonomy สำหรับข่าวและเทรนด์ให้ยึด [Topic Taxonomy](../proposals/TOPIC-TAXONOMY-v1.0-RC2-PROPOSAL.md) และ machine-readable registry `contracts/vocabulary/v1.0-RC2.json` ตาม [ADR-0001](../adr/ADR-0001-topic-taxonomy.md)

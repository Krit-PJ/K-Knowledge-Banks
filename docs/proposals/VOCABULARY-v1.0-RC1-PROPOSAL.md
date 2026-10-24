# Vocabulary Registry Proposal

Target baseline: **v1.0-RC1**  
Proposal date: 2026-10-23 (Asia/Bangkok)  
Status: **APPROVED AS PHASE 1 BINDING AUTHORITY**  
Approval: ผู้ใช้ตอบ “อนุมัติ Proposal และเริ่ม Phase 1” วันที่ 2026-10-23

## Registry rules

- Canonical identifiers ใช้ stable Technical English; labels/aliases แยกตาม BCP 47 language tag
- ทุก entry ต้องมี `id`, `kind`, definition, Thai/English labels, allowed domain/range หรือ participant types, cardinality และอย่างน้อยหนึ่ง example
- เปลี่ยน definition/domain/range/cardinality ถือเป็น semantic change; เพิ่ม label/alias ที่ไม่เปลี่ยน meaning เป็น non-semantic revision
- Alias ไม่สร้าง concept ใหม่และไม่ใช้เป็น canonical identity

## Controlled enums

### WorkflowState

`RECEIVED`, `REGISTERED`, `EXTRACTED`, `VALIDATED`, `REVIEW_READY`, `APPROVED`, `COMMITTED`, `PUBLISHED`, `NEEDS_REVISION`, `REJECTED`, `ERROR`, `SUPERSEDED`

### HumanRole

`VIEWER`, `CONTRIBUTOR`, `REVIEWER`, `ADMIN`

### ValueState

`KNOWN`, `UNKNOWN`, `NOT_REPORTED`, `NOT_APPLICABLE`

### ReviewDecision

`APPROVE`, `NEEDS_REVISION`, `REJECT`

### EvidenceRelationType

`SUPPORTS`, `CHALLENGES`

### AccessClassification

`PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`

## ClaimFrame participant roles

| Role ID | Thai label | Allowed value/type | Cardinality per frame |
|---|---|---|---:|
| `subject` | ประธานของข้อเสนอ | record or typed literal | 1 |
| `object` | กรรม/เป้าหมาย | record or typed literal | 0..1 |
| `population` | ประชากร | record or typed literal | 0..* |
| `condition` | เงื่อนไข | record or typed literal | 0..* |
| `comparator` | ตัวเปรียบเทียบ | record or typed literal | 0..* |
| `outcome` | ผลลัพธ์ | record or typed literal | 0..* |
| `location` | สถานที่ | record or typed literal | 0..* |
| `time` | เวลา/ช่วงเวลา | typed temporal value | 0..* |
| `method` | วิธีการ | method record or literal | 0..* |
| `measurement` | การวัด | typed measure | 0..* |
| `intervention` | การแทรกแซง | record or typed literal | 0..* |
| `exposure` | ปัจจัยสัมผัส | record or typed literal | 0..* |
| `direction` | ทิศทางความสัมพันธ์ | controlled literal | 0..1 |
| `magnitude` | ขนาดผล | typed measure | 0..1 |
| `qualifier` | ตัวขยายความ | typed literal | 0..* |

## Initial predicates

| Predicate ID | Definition | Domain → range |
|---|---|---|
| `reports` | Report รายงาน Study/AnalysisRun/Result ที่ระบุ | Report → Study, AnalysisRun or Result |
| `derivedFrom` | output เกิดจาก input ผ่าน DerivationRun ที่ตรวจย้อนกลับได้ | derived record → source record |
| `addresses` | รายการวิจัยตอบหรือมุ่งตอบ parent research item | Goal/Objective/Question/Synthesis → Problem/Goal/Objective/Question |
| `alignedWith` | EvidenceAlignment เชื่อม evidence กับ requirement/question พร้อมเหตุผล | EvidenceAlignment → EvidenceRequirement or ResearchQuestion |
| `supports` | Evidence relation สนับสนุน Claim/Hypothesis ในบริบทที่ระบุ | RelationAssertion → Claim or Hypothesis |
| `challenges` | Evidence relation มีหลักฐานโต้แย้ง Claim/Hypothesis ในบริบทที่ระบุ | RelationAssertion → Claim or Hypothesis |
| `usesDataset` | Study/AnalysisRun ใช้ dataset/sample/cohort ที่ระบุเพื่อ dependency analysis | Study or AnalysisRun → SourceAsset or controlled dataset record |
| `synthesizes` | Synthesis รวม EvidenceAlignment ตาม protocol/method ที่ระบุ | Synthesis → EvidenceAlignment |

`supports`/`challenges` ไม่ใช่ truth value และห้ามใช้ majority vote จำนวน relation เป็นตัวตัดสิน Claim

## Thai-first display labels

| Canonical ID | Thai label |
|---|---|
| `Finding` | ข้อค้นพบ |
| `Evidence` | หลักฐาน |
| `Result` | ผลการศึกษา |
| `Estimate` | ค่าผลการวิเคราะห์ |
| `SUPPORTS` | สนับสนุน |
| `CHALLENGES` | มีหลักฐานโต้แย้ง |
| `GapCandidate` | ประเด็นที่อาจเป็นช่องว่างความรู้ |
| `ConflictCandidate` | ผลการศึกษาที่อาจไม่สอดคล้องกัน |
| `ReviewSnapshot` | ภาพรวมการทบทวน ณ เวลานั้น |

## Decisions requested

- อนุมัติ controlled enums และแยก human role ออกจาก publisher service principal
- อนุมัติ ClaimFrame roles/cardinalities และ initial predicates
- อนุมัติ Thai labels เป็น default UI labels โดย canonical IDs/semantic identity ไม่เปลี่ยนตามภาษา

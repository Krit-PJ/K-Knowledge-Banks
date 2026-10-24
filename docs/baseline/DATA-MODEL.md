# Formal Schema / Conceptual Contract

Baseline version: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

ข้อกำหนด semantic ด้านล่างเป็น baseline และ [Formal Schema Binding](../proposals/FORMAL-SCHEMA-v1.0-RC1-PROPOSAL.md) เป็น binding authority ที่ผู้ใช้อนุมัติสำหรับสร้าง executable contracts ใน Phase 1

## Common record envelope
ทุก record มี id แบบ stable opaque identifier, type, schemaVersion = v1.0-RC1, revision, createdAt, updatedAt, createdBy และ provenance ที่ตรวจย้อนกลับได้ การแก้ไขต้องคง ID และเก็บประวัติ revision ห้ามใช้ข้อความแปลเป็น ID

## Entities and relationships
| Entity | ความหมาย / ข้อมูลขั้นต่ำที่ต้องรักษา |
|---|---|
| Study | หน่วยการศึกษา/การวิจัย; study ID, design/context; หนึ่ง Study มีหลาย Report ได้ |
| Report | เอกสารรายงาน; report ID, source reference/version/hash, language; อาจครอบคลุมหลาย Study จึงห้ามบังคับ Study=Report |
| Evidence | หลักฐานอ้างกลับ Report/source version + locator (หน้า/ตาราง/ย่อหน้า/ช่วงข้อมูล), original excerpt หรือ controlled reference, access classification |
| Result | ผลที่รายงาน/สังเกต; study/report references, measure/value/unit/context และ evidenceRefs ที่ไม่ว่าง |
| Finding | การตีความผล; resultRefs, explanation/context และ evidenceRefs ที่ไม่ว่าง; ไม่กลายเป็น Claim อัตโนมัติ |
| Claim | ข้อเสนอเชิงความรู้; claimFrameRef, evidenceRefs ที่ไม่ว่าง, provenance และ review state |
| ClaimFrame | กรอบ contextual/n-ary: typed participants ตาม role, predicate, qualifiers/context, time/population/conditions ตามที่เกี่ยวข้อง; ห้าม flatten เหลือ subject-predicate-object จนสูญบริบท |
| RelationAssertion | ข้อกล่าวอ้างความสัมพันธ์: predicate, typed role bindings ของหลาย participants, context/frame reference, evidenceRefs และ review state; edge ไม่ใช่ความจริงอัตโนมัติ |
| DerivationRun | run ID, input IDs+revisions, rule/method version, parameters, output IDs, actor, timestamp และผลสำเร็จ/ล้มเหลว; ระบุ AI model/prompt reference เมื่อใช้ |
| GapCandidate | ข้อเสนอว่ามีช่องว่าง; scope, reason, evidence/search coverage และ run reference ถ้ามี; ไม่ยืนยันว่าไม่มีหลักฐานทั่วโลก |
| ConflictCandidate | ข้อเสนอความขัดแย้ง; claim references+revisions, context comparison, reason และ evidence; ไม่ตัดสินว่า claim ใดผิดเอง |
| ReviewProtocol | versioned criteria, required checks, reviewer role และ decision policy |
| ReviewSnapshot | immutable target IDs+revisions, evidence revisions, protocol version, validation result, human reviewer, decision/reason/time |

## Mandatory invariants
1. References ต้อง resolve และ type ถูกต้อง; ห้าม dangling reference หรือ duplicate ID; version ต้องตรง lock
2. Result/Finding/Claim/RelationAssertion ต้องมี Evidence dependency ที่ตามถึง source version และ locator ได้; model confidence ใช้แทนหลักฐานไม่ได้
3. Evidence เดียวใช้ได้หลาย record แต่ citation ซ้ำจาก Report ของ Study เดียวกันไม่ถือเป็นหลาย independent studies
4. DerivationRun เก็บ lineage โดยไม่มีวงจรอ้างตัวเองหรือ input ที่เป็น descendant ของ output; relation graph มีวงจรเชิงความหมายได้
5. Unknown/null ต้องแยกจาก not applicable และ absent evidence; enum/serialization ที่แน่นอนรออนุมัติ ห้ามตีความ missing เป็น false
6. Evidence/record/context เปลี่ยน revision ต้อง invalidate หรือ mark stale review ของ dependents และส่งทบทวนก่อนเผยแพร่ revision ใหม่
7. ReviewSnapshot อนุมัติเฉพาะ revision ที่ตรึงไว้ approval เก่าใช้กับ revision ใหม่ไม่ได้; rejected/superseded เก็บ provenance
8. Source text กับ normalized value และ translation ต้องแยกกัน; หน่วย/เวลา/ประชากรต่างกันต้องไม่ merge โดยอาศัย label เดียว

## Executable binding authority
ID format, cardinalities, enums, null semantics, timestamps, vocabulary role registry และ canonical serialization ให้ยึด [Formal Schema Binding](../proposals/FORMAL-SCHEMA-v1.0-RC1-PROPOSAL.md) กับ [Vocabulary Registry](../proposals/VOCABULARY-v1.0-RC1-PROPOSAL.md) ที่อนุมัติวันที่ 2026-10-23 การเปลี่ยน semantic binding หลังจากนี้ต้องผ่าน ADR + migration plan + User approval

## Topic classification extension

ตาม [ADR-0001](../adr/ADR-0001-topic-taxonomy.md), schema `v1.0-RC2` เพิ่ม optional `topicIds` เป็น unique array ที่ทุกค่าต้อง resolve ใน topic registry `v1.0-RC2` Topic assignment เป็น classification metadata ไม่ใช่ Claim/Evidence และไม่เปลี่ยน epistemic status ของ record

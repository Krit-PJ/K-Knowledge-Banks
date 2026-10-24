# Formal Schema Binding Proposal

Target baseline: **v1.0-RC1**  
Proposal date: 2026-10-23 (Asia/Bangkok)  
Status: **APPROVED AS PHASE 1 BINDING AUTHORITY**  
Approval: ผู้ใช้ตอบ “อนุมัติ Proposal และเริ่ม Phase 1” วันที่ 2026-10-23

## Purpose

กำหนด binding ขั้นต่ำเพื่อเปลี่ยน conceptual contract เป็น executable schema โดยไม่เปลี่ยน semantic invariants เอกสารนี้ได้รับอนุมัติเป็น binding authority สำหรับ Phase 1; การเปลี่ยน semantic meaning หลังจากนี้ใช้ ADR + migration plan + User approval

## Canonical serialization

- UTF-8 JSON หนึ่ง record ต่อหนึ่งไฟล์; newline = LF; ห้าม BOM
- ทุก object ปฏิเสธ duplicate keys; schema ปฏิเสธ unknown fields ยกเว้น namespace `extensions`
- การ hash/sign ใช้ deterministic canonical JSON ที่เรียง object keys; array ที่มีความหมายเชิงลำดับต้องคงลำดับ ส่วน set-like arrays normalize ด้วย stable ID ก่อนเปรียบเทียบ
- `schemaVersion` ใช้ค่าตรงตัว `v1.0-RC1`; canonical record ที่ version ไม่รองรับต้อง reject
- Record filename/path เป็น storage concern; canonical identity มาจาก `id` เท่านั้น ห้ามสร้าง ID จาก label, path หรือข้อความแปล

## Common record envelope

| Field | Cardinality | Proposed binding |
|---|---:|---|
| `id` | 1 | UUID v7 lowercase canonical string; immutable, opaque และไม่ reuse |
| `type` | 1 | controlled `RecordType` enum |
| `schemaVersion` | 1 | literal `v1.0-RC1` |
| `revision` | 1 | integer ≥ 1; เพิ่มทีละ 1 ต่อ accepted mutation |
| `workflowState` | 1 | enum จาก Master Prompt |
| `createdAt`, `updatedAt` | 1 each | RFC 3339 UTC มี millisecond และลงท้าย `Z` |
| `createdBy`, `updatedBy` | 1 each | immutable actor ID reference; ห้ามรับ reviewer identity จาก browser โดยไม่ verify |
| `language` | 0..1 | BCP 47 tag ของ primary text; multilingual fields ใช้ `LocalizedText` |
| `provenance` | 1 | source/actor/action/input revision references ที่ตรวจย้อนกลับได้ |
| `extensions` | 0..1 | object namespaced; ห้าม override field มาตรฐาน |

## Absence and value semantics

- Canonical records ห้ามใช้ JSON `null`
- Semantic optional value ใช้ `ValueState<T>`: `KNOWN` พร้อม `value`, `UNKNOWN`, `NOT_REPORTED`, หรือ `NOT_APPLICABLE`
- Field ที่ type นั้นไม่รองรับให้ omit; field ที่รองรับแต่ไม่ทราบต้องบันทึก state ชัดเจน
- Boolean ใช้เฉพาะ true/false ที่ทราบแล้ว; missing/unknown ห้ามตีความเป็น false
- Evidence requirement ที่ไม่ครบทำให้ record อยู่ draft/validation error และห้ามไป `APPROVED`, `COMMITTED` หรือ `PUBLISHED`

## Shared value objects

| Object | Required content |
|---|---|
| `RecordRef` | `id`, `type`, `revision` |
| `LocalizedText` | map ของ BCP 47 tag → text; เก็บ original language แยกจาก translation |
| `SourceLocator` | locator type และค่าที่ตรวจได้ เช่น page/section/table/figure/row/time range |
| `TypedParticipant` | `roleId`, participant `RecordRef` หรือ controlled literal พร้อม datatype/unit |
| `Provenance` | source refs, actor ref, action, timestamp และ optional derivation run ref |
| `HashDigest` | algorithm = `sha256`, lowercase hex digest |

## Record types and minimum cardinalities

| Record type | Required relationships / fields |
|---|---|
| `SourceAsset` | source kind, version, hash, access classification, original language, storage reference และอย่างน้อยหนึ่ง locator capability |
| `Study` | design/context; `reportRefs` 1..*; dependency keys 0..* สำหรับ shared dataset/sample/cohort |
| `Report` | `sourceAssetRef` 1; `studyRefs` 1..*; report language/version |
| `Evidence` | `sourceAssetRef` 1; `locator` 1; `studyRefs` 1..*; `reportRef` 0..1; original excerpt/reference 1; access classification 1 |
| `AnalysisRun` | `studyRef` 1; method/version 1; input dataset/sample refs 0..*; `resultRefs` 1..* |
| `Result` | `analysisRunRef` 1; measure/value-state/unit/context 1; `evidenceRefs` 1..* |
| `Finding` | `resultRefs` 1..*; explanation/context 1; `evidenceRefs` 1..* |
| `ClaimFrame` | `predicateId` 1; `participants` 2..*; context qualifiers 0..*; participant role IDs ไม่ซ้ำเมื่อ role กำหนด max=1 |
| `Claim` | `claimFrameRef` 1; `evidenceRefs` 1..*; epistemic status 1; ห้าม auto-promote จาก Finding |
| `RelationAssertion` | relation type/predicate 1; target Claim/Hypothesis ref 1; `participants` 1..*; `evidenceRefs` 1..*; review state 1 |
| `DerivationRun` | engine, engine version, rule set/version, software commit/version, input snapshot, parameters, output refs, timestamp และ outcome; `inputRefs`/`outputRefs` 1..* |
| `ResearchProblem` | description 1; `goalRefs` 1..* |
| `ResearchGoal` | `problemRef` 1; description 1; `objectiveRefs` 1..* |
| `ResearchObjective` | `goalRef` 1; description 1; `questionRefs` 1..* |
| `ResearchQuestion` | `objectiveRef` 1; question text 1; `hypothesisRefs` 0..*; `evidenceRequirementRefs` 1..* |
| `Hypothesis` | `questionRef` 1; `claimFrameRef` 1; state 1; evidence relation refs 0..* |
| `ReviewProtocol` | version, criteria, required checks, reviewer role และ decision policy |
| `EvidenceRequirement` | target question/objective ref 1; inclusion/exclusion/context/dependency rules 1 |
| `EvidenceAlignment` | evidence/study ref 1; requirement/question ref 1; alignment status/reason 1; reviewer or deterministic rule provenance 1 |
| `Synthesis` | question/objective ref 1; included alignment refs 1..*; method/version 1; derived claim refs 0..*; `derivationRunRef` 1 |
| `ReviewSnapshot` | immutable target/evidence refs with revisions, protocol ref/version, validation result, human reviewer, decision/reason/time |
| `GapCandidate` | scope, reason, search/evidence coverage และ provenance; ห้ามมี confirmed-gap status โดยอัตโนมัติ |
| `ConflictCandidate` | claim refs+revisions 2..*; population/method/context/geography/time/outcome/dependency comparison และ reason |

## Cross-record validation

1. ทุก `RecordRef` ต้อง resolve ไปยัง type/revision ที่ระบุ; dangling, duplicate ID และ unsupported version = error
2. Study เป็น primary evidence unit; independence count deduplicate ด้วย Study และ dependency keys ไม่ใช่จำนวน Report/Evidence rows
3. Result/Finding/Claim/RelationAssertion ต้องตาม `evidenceRefs` ถึง SourceAsset version และ locator ได้
4. ReviewSnapshot ใช้ได้เฉพาะ target/evidence revisions ที่ตรึงไว้; revision ใหม่ต้อง review ใหม่
5. Derivation lineage ห้าม self-cycle หรือ input ที่เป็น descendant ของ output; semantic relation graph มี cycle ได้
6. Source/evidence/context/rule revision เปลี่ยนต้อง mark dependents stale และ block publication จน validate/review ใหม่
7. `COMMITTED` ต้องมี validation success และ approved ReviewSnapshot ตรง revision; `PUBLISHED` ต้องมี complete read-model manifest ของ canonical revision

## Decisions requested

- อนุมัติ UUID v7, JSON serialization และ timestamp/null conventions ตาม proposal หรือระบุค่าทดแทน
- อนุมัติ minimum cardinalities และ entity coverage
- อนุมัติให้สร้าง JSON Schema/executable validators จากเอกสารนี้ใน Phase 1 หลัง phase gate ผ่าน

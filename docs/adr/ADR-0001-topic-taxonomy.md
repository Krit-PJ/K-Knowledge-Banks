# ADR-0001 — First-class topic taxonomy for news and technology trends

Documentation pack: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

Status: **ACCEPTED**

## Metadata

- Author / date: Codex / 2026-10-23
- Proposed baseline version: v1.0-RC1 → v1.0-RC2
- Related requirement: คำขอเพิ่ม Knowledge Bank topics ก่อน P1-WP2

## Context and problem

ผู้ใช้ต้องการเพิ่มหมวดเนื้อหาสองกลุ่ม:

1. สรุปข่าว: เทคโนโลยีปัจจุบัน, ปรากฏการณ์สิ่งแวดล้อมและภัยพิบัติ, ความเคลื่อนไหวของประเทศมหาอำนาจ และพลังงาน
2. เทรนด์เทคโนโลยี, AI และ Skill ที่ได้รับความนิยมบน GitHub

Schema ปัจจุบันไม่มี field มาตรฐานสำหรับ topic classification และ vocabulary registry ยังไม่มี topic hierarchy การใช้ข้อความ label โดยตรงจะทำให้ ID เปลี่ยนตามภาษาและไม่สามารถตรวจ unknown topic ได้

Topic เป็น navigation/classification metadata ไม่ใช่หลักฐานหรือข้อสรุป การสรุปข่าวและการจัดอันดับความนิยมยังต้องรักษา SourceAsset/Evidence, time window, metric, source snapshot และ DerivationRun ตามกฎ Derived Knowledge

## Options

### A. Controlled topic IDs + optional `topicIds` on canonical records — recommended

- เก็บ hierarchy/labels/definitions ใน versioned vocabulary registry
- Record อ้าง stable topic ID ได้หลายค่า
- ตรวจ unknown/deprecated topic และสร้าง topic read model ได้
- เป็น backward-compatible extension แต่เป็น semantic change จึงเพิ่ม baseline version

### B. เพิ่ม `Topic` เป็น RecordType ใหม่

- รองรับ revision/review ต่อ topic เต็มรูปแบบ
- เพิ่ม entity, references และ workflow มากเกินความจำเป็นสำหรับ taxonomy ชุดเล็ก

### C. เก็บ topic ใน `extensions` หรือ free-text tags

- ไม่ต้องเปลี่ยน schema
- ตรวจ spelling/hierarchy/semantic identity ไม่ได้ และเสี่ยงให้ label ภาษาไทยกลายเป็น ID

## Decision

เสนอ Option A:

- เพิ่ม optional `topicIds` เป็น unique array ของ canonical topic IDs ใน BaseRecord
- เพิ่ม versioned topic registry พร้อม hierarchy และ multilingual labels
- Topic assignment ไม่เพิ่ม epistemic status และไม่ทดแทน Evidence/Claim/Review
- Summary/ranking ที่สร้างอัตโนมัติเป็น Derived Knowledge ต้องมี DerivationRun
- GitHub popularity ต้องบันทึก metric, time window, repository/source snapshot และ parameters
- Version ใหม่เป็น `v1.0-RC2`; record `v1.0-RC1` ที่ไม่มี `topicIds` ยังอ่านได้

Decision ได้รับอนุมัติจากผู้ใช้วันที่ 2026-10-23 และนำไปใช้ผ่าน schema/vocabulary `v1.0-RC2`

## Consequences and affected contracts

- Schema: เพิ่ม optional `topicIds`; validator ตรวจ ID กับ topic registry
- Vocabulary: เพิ่ม topic taxonomy v1.0-RC2
- Golden tests: เพิ่ม GT-16 topic identity/hierarchy และ GT-17 trend provenance
- Read models: เพิ่ม topic index/hierarchy เมื่อมี canonical records
- UI: ใช้ label ภาษาไทยเป็นค่าเริ่มต้นและ localization layer สำหรับภาษาอื่น
- Architecture/security/workflow: ไม่เปลี่ยน authority boundary

## Migration plan (required)

- Existing records and revisions: ยังไม่มี canonical data หรือ committed application records จึงไม่มีข้อมูลจริงต้องย้าย
- Mapping and compatibility: v1.0-RC1 maps เป็น v1.0-RC2 โดย omit `topicIds`; new records ใช้ known IDs เท่านั้น
- Backup and execution: เก็บ RC1 files เดิมและสร้าง RC2 เป็นไฟล์ใหม่ ไม่ overwrite RC1
- Evidence/review invalidation: ยังไม่มี ReviewSnapshot/canonical record จริงให้ invalidate
- Read-model rebuild: ยังไม่มี active read model; เมื่อ implement ให้ rebuild topic index จาก canonical RC2 แล้ว activate หลัง completeness check
- Rollback: ก่อนมี canonical RC2 data ให้ลบ RC2 files และกลับ version lock; หลังมีข้อมูลต้องใช้ ADR ใหม่หาก rollback ทำให้ taxonomy สูญหาย
- Validation: parse registry, unique IDs, parent existence/acyclic hierarchy, localized labels, unknown topic rejection และ GT-16/17; ผลปัจจุบัน = NOT RUN

## User approval (required)

- Decision: ACCEPTED
- Approver / timestamp / explicit scope: User / 2026-10-23 (Asia/Bangkok) / ADR-0001, canonical topic IDs, optional `topicIds`, v1.0-RC2 migration plan และ GT-16/17
- Evidence reference: ผู้ใช้ตอบ “อนุมัติ ADR-0001” ในแชต

## Implementation and follow-up

Implemented contract assets:

1. `contracts/schema/kekb-record-v1.0-RC2.schema.json`
2. `contracts/vocabulary/v1.0-RC2.json`
3. `fixtures/golden/topics-v1.0-RC2.json`

RC1 files remain intact. News ingestion, scheduler และ GitHub ranking collector ไม่อยู่ใน ADR นี้

# Baseline Index & Version Lock

Baseline version: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Version lock
| Document | Locked version |
|---|---|
| [Architecture](ARCHITECTURE.md) | v1.0-RC1 |
| [Formal Schema](DATA-MODEL.md) | v1.0-RC2 |
| [Vocabulary](VOCABULARY.md) | v1.0-RC2 |
| [Workflow](WORKFLOW.md) | v1.0-RC1 |
| [API Contract](API-CONTRACT.md) | v1.0-RC1 |
| [Security Model](SECURITY.md) | v1.0-RC1 |
| [Golden Tests](GOLDEN-TESTS.md) | v1.0-RC2 |
| [Acceptance Tests](ACCEPTANCE-TESTS.md) | v1.0-RC1 |
| [MVP Scope](MVP-SCOPE.md) | v1.0-RC1 |
| [Formal Schema Binding](../proposals/FORMAL-SCHEMA-v1.0-RC1-PROPOSAL.md) | v1.0-RC1 — approved for Phase 1 |
| [Vocabulary Registry](../proposals/VOCABULARY-v1.0-RC1-PROPOSAL.md) | v1.0-RC1 — approved for Phase 1 |
| [Topic Taxonomy / ADR-0001](../proposals/TOPIC-TAXONOMY-v1.0-RC2-PROPOSAL.md) | v1.0-RC2 — approved |

Package baseline = **v1.0-RC2** ตาม ADR-0001; Architecture/Workflow/API/Security/Acceptance Tests/MVP Scope ที่ไม่เปลี่ยน semantic ยังคง document version v1.0-RC1 ตามตาราง

สถานะ: Baseline consistency review ผ่านและผู้ใช้อนุมัติ Formal Schema/Vocabulary bindings พร้อมเริ่ม Phase 1 วันที่ 2026-10-23 รายละเอียด API/provider/runtime ที่ยังเปิดอยู่ไม่ถือว่าอนุมัติจาก gate นี้

ADR-0001 ได้รับอนุมัติวันที่ 2026-10-23: เพิ่ม topic taxonomy และ optional `topicIds` ใน schema/vocabulary v1.0-RC2 โดยรักษา RC1 files เพื่อ compatibility

## Invariants
Thai-first Multilingual; AI-Independent Core; Evidence→Model→Rules→Human Authority; Study≠Report; Result≠Finding≠Claim; Evidence dependency; contextual/n-ary ClaimFrame; RelationAssertion; DerivationRun; GapCandidate/ConflictCandidate; ReviewProtocol/ReviewSnapshot; Human authority

GitHub Pages frontend; Secure Backend/API; Drive raw source; Sheets workflow; GitHub canonical structured knowledge v1; generated read models ที่ตรวจ revision และสร้างใหม่ได้

## Navigation
- [README](../../README.md), [AGENTS / Master Development Prompt v1.1](../../AGENTS.md)
- [Phase 1](../development/PHASE-1.md), [Phase 2](../development/PHASE-2.md), [Phase 3](../development/PHASE-3.md), [Phase 4](../development/PHASE-4.md)
- [PROJECT-STATE](../development/PROJECT-STATE.md)
- [Baseline Consistency Review](../development/BASELINE-REVIEW.md)
- Approved Phase 1 bindings: [Formal Schema](../proposals/FORMAL-SCHEMA-v1.0-RC1-PROPOSAL.md), [Vocabulary Registry](../proposals/VOCABULARY-v1.0-RC1-PROPOSAL.md)
- [ADR policy](../adr/README.md), [ADR template](../adr/ADR-0000-template.md)
- [ADR-0001 — Topic taxonomy](../adr/ADR-0001-topic-taxonomy.md)

## Change control
เปลี่ยน baseline ผ่าน ADR + migration plan + User approval พร้อมอัปเดต version lock และเอกสารที่กระทบในชุดเดียวกัน แม้ยังไม่มีข้อมูลจริงต้องระบุ migration ว่าไม่มีข้อมูลใดต้องย้ายและเหตุผล ห้ามเปลี่ยน meaning โดยคง version เดิมเงียบ ๆ

## Provenance
Source: คำสั่งผู้ใช้วันที่ 2026-10-23 และ cached preview ของ conversation `6ad9afe6-1ed4-83ec-bf0b-f2c3ec33c71e` ชื่อ “เปรียบเทียบแพ็กเกจ GPT” เครื่องมือ read_thread ไม่พร้อมใช้ใน session นี้ จึงไม่อ้างว่าได้ตรวจต้นฉบับเต็ม ประเด็นรอตรวจอยู่ใน PROJECT-STATE

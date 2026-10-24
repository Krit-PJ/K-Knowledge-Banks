# KEKB Validator (P1-WP2)

Deterministic, AI-independent validator สำหรับ canonical records `v1.0-RC1` / `v1.0-RC2`

- Runtime: Node.js ≥ 22 + Ajv 8 (JSON Schema 2020-12) — อนุมัติโดยผู้ใช้ 2026-10-24 ("A, อนุมัติ 1-2-3-4")
- ไม่มี network, clock หรือ AI call; input เดิม → issues เดิมในลำดับเดิม
- Issues ใช้ stable safe codes ใน [`src/codes.js`](src/codes.js) และไม่ echo ค่าจาก input (มีเฉพาะ code, record identity, JSON path, schema keyword)

## ใช้งาน

```bash
npm install                       # ติดตั้ง ajv 8.20.0 + ajv-formats 3.0.1 (exact, lockfile)
npm test                          # contracts + strict JSON + golden runner
node validator/bin/kekb-validate.js <dir-or-file>...   # exit 0 = valid, 1 = issues, 2 = usage/IO
```

## ชั้นการตรวจ

1. Strict loader — UTF-8, ไม่มี BOM, LF, ไม่มี duplicate JSON keys
2. Envelope — `schemaVersion` ต้องอยู่ใน version lock; dispatch ไปยัง `$defs/<type>` ของ schema version นั้น
3. JSON Schema (Ajv strict; lint `strictTypes`/`strictRequired` ถูก log ไม่ throw เพราะ contract ผ่าน 2020-12 metaschema และห้ามแก้ใน packet นี้)
4. Cross-record rules — duplicate ID, dangling/type-mismatched refs, ref field types, null ban, Evidence locator ↔ SourceAsset capabilities, ClaimFrame role cardinality, topic identity/applicability, trend provenance (ADR-0001) และ human authority (APPROVED/COMMITTED/PUBLISHED ต้องมี approved ReviewSnapshot ตรง revision)

Helpers: `checkPublication` (rule-level pre-check เท่านั้น ไม่เขียนข้อมูล), `countIndependentStudies`, `isApprovedFact`, `resolveTopicNavigation`, `areMeasuresComparable`

## Confirmed bindings B1–B5 (OD-06 ปิดแล้ว: ผู้ใช้ยืนยัน 2026-10-24; การเปลี่ยนต้องผ่าน ADR)

- B1 Trend `metric` และ `timeWindow {from,to}` อยู่ใน `DerivationRun.parameters`; `sourceSnapshot` = `inputSnapshot`; record ที่ไม่ใช่ DerivationRun อ้าง run ผ่าน `derivationRunRef` (Synthesis) หรือ `provenance.derivationRunRef`
- B2 `ReviewSnapshot` ยกเว้นจาก authority rule (เป็น decision record เอง); `ReviewProtocol` ไม่ยกเว้น
- B3 บังคับ `applicableTypes` ของ topic → `TOPIC_NOT_APPLICABLE`
- B4 min/max ของ participant role นับเฉพาะ `ClaimFrame.participants` (ไม่รวม `qualifiers`)
- B5 Ref field → allowed target types ตามตาราง Formal Schema Binding (`REF_FIELD_TYPES` ใน `src/validate.js`)

## ไม่อยู่ใน scope

Vertical slice (GT-12), read-model manifest, publication write, Drive/Sheets/API/auth, GT-07/08/09/11/13 (Phase 2–3)

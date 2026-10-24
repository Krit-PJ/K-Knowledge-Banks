# Project State

Documentation pack: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok) · ปรับปรุงล่าสุด: 2026-10-24 (เริ่ม Phase 2)

## Current status
- Current Phase = **Phase 2 — Knowledge Intake, Evidence & Human Review** (STARTED 2026-10-24)
- Coding = STARTED (Phase 2 scope only; OD-03/OD-04 ตัดสินแล้ว 2026-10-24; OD-08 ยังเปิด)
- Next = push repo ขึ้น GitHub `Krit-PJ/K-Knowledge-Banks` (Public) + เปิด GitHub Pages frontend shell (P2-WP3) — รอผู้ใช้เชื่อม GitHub connector; จากนั้น P2-WP4 backend (Cloud Run + Google Sign-In) หลังตัดสิน OD-08
- Baseline = v1.0-RC2 (ADR-0001; RC1 retained for compatibility)
- Master Development Prompt = v1.1 (operational consolidation)
- Validator (P1-WP2) = DONE; GT-01..06,10,14..17 + RC1 compat = PASS (expected outputs PENDING_HUMAN_CONFIRMATION); AC-01 = PASS ระดับ validator; AC-02 = rule-level PASS / pipeline NOT RUN; GT-07,08,09,11,12,13 = NOT RUN
- No-AI vertical slice (P1-WP3) = DONE บน local file store; GT-12 = PASS (synthetic); AC-03 No-AI core portion = PASS; `npm test` 60/60
- Phase 1 = CLOSED (User approved 2026-10-24); Phase 2 = STARTED; Phase 3–4 = NOT STARTED

## Inventory before changes
ตรวจโฟลเดอร์ D:\OneDrive\1.14 K-Knowledge Bank วันที่ 2026-10-23: พบเฉพาะ .git ไม่มี working files หรือเอกสารเดิมที่ต้อง merge/backup Git branch = main; git status = No commits yet on main; tracked files = none ไม่มี commit/tag ถูกสร้าง

## Source and confidence
ใช้คำสั่งผู้ใช้ในแชตนี้เป็น authority ของข้อกำหนดหลัก และ bounded cached preview ของ conversation 6ad9afe6-1ed4-83ec-bf0b-f2c3ec33c71e เป็นข้อมูลประกอบ ไม่สามารถเรียก read_thread ได้เพราะไม่มีเครื่องมือนี้ใน session จึงยังตรวจต้นฉบับ Formal Schema, Vocabulary และ Master Development Prompt v1.1 ไม่ได้

## Open decisions / consistency review checklist
| ID | ประเด็น | เงื่อนไขปิด |
|---|---|---|
| OD-01 | ตรวจ pack กับต้นฉบับ approved baseline/MASTER DEVELOPMENT PROMPT v1.1 ถ้ามี | ผู้ใช้ยืนยัน consolidated pack หรือระบุ corrections; ห้ามอ้างว่าได้อ่านต้นฉบับแล้ว |
| OD-02 | field bindings, cardinalities, ID/enums/null/timestamps, serialization และ predicate/role registry | ยืนยันข้อเสนอ DATA-MODEL/VOCABULARY ก่อนสร้าง executable contracts |
| OD-03 | API endpoints/payloads/pagination/idempotency limits | **CLOSED 2026-10-24**: ใช้ endpoint ตาม API-CONTRACT ที่เสนอ + cursor pagination, limit ≤ 100, idempotency key ใน mutation |
| OD-04 | backend/auth provider, roles, public/private canonical, source permissions, backup/retention | **ส่วนหนึ่ง CLOSED 2026-10-24**: backend = Cloud Run (Node) + Google Sign-In (ID token) — GCP project/billing/service account ยังต้องตั้งโดยผู้ใช้; role assignment, source permissions, backup/retention ยังเปิด |
| OD-05 | phase allocation และ MVP 2D optional/3D deferred | ผู้ใช้ยืนยัน scope และ phase prompts |
| OD-06 | Binding assumptions B1–B5 ([validator/README](../../validator/README.md)), B6–B8 ([core/README](../../core/README.md)) และ golden expected outputs ใน `fixtures/golden/records/cases.json` | **CLOSED 2026-10-24**: ผู้ใช้ยืนยันทั้งหมด; เป็น binding authority และ regression authority; การเปลี่ยนใช้ ADR + migration plan + User approval |
| OD-08 | Separation of duties: ผู้สร้าง revision อนุมัติ revision เดียวกันเองได้หรือไม่ | ยังเปิด: ข้อเสนอขึ้นกับจำนวนผู้ตรวจ — ผู้ใช้ต้องเลือก policy ก่อนบังคับใช้ใน review |
| OD-09 | Canonical repository visibility (public/private) และ GitHub remote สำหรับ push | **CLOSED 2026-10-24**: ผู้ใช้เลือก repo `Krit-PJ/K-Knowledge-Banks` **Public**, push ทั้ง repo ปัจจุบัน, ใช้เป็น GitHub Pages frontend, commit email = GitHub noreply, push ผ่าน GitHub connector ของ Claude. ผลที่ตามมา: canonical/fixtures/docs เป็นสาธารณะ → ห้ามนำข้อมูลจริงที่ไม่ใช่ PUBLIC เข้า canonical ใน repo นี้ |
| OD-07 | Metadata ไม่สอดคล้อง RC1/RC2 | **CLOSED 2026-10-24**: แก้ `AGENTS.md:6`, `PHASE-1..4.md:3` เป็น RC2 และนำ `contracts/vocabulary/topics-v1.0-RC2.proposed.json` ออก (ซ้ำกับ topics ใน `vocabulary/v1.0-RC2.json` และไม่มีไฟล์ใดอ้างถึง; กู้คืนได้ด้วย `git show 400d492:contracts/vocabulary/topics-v1.0-RC2.proposed.json`) |

ไม่มีความขัดแย้งกับไฟล์เดิม เพราะไม่มีไฟล์งานเดิม แต่ยังไม่สามารถยืนยันความตรงกับต้นฉบับแชตเต็มได้ ประเด็น OD เป็นข้อจำกัดของการ consolidate ไม่ใช่ข้ออนุมัติที่ได้รับแล้ว

ผลการตรวจล่าสุด: [Baseline Consistency Review](BASELINE-REVIEW.md) ผ่าน; BR-01..05 ปิดและ Formal Schema/Vocabulary bindings ได้รับอนุมัติวันที่ 2026-10-23; BR-06 เป็น deferred gate สำหรับ API/integration/deployment

## Approval ledger
| Gate | Status | Approval evidence |
|---|---|---|
| สร้าง documentation pack เท่านั้น | AUTHORIZED | คำสั่งผู้ใช้ 2026-10-23; ห้าม Application Code |
| Align workflow/roles/Phase 1 และจัดทำ schema/vocabulary proposal | AUTHORIZED | ผู้ใช้ตอบ “จัดการต่อได้” วันที่ 2026-10-23; ไม่ใช่อนุมัติ proposal หรือ Application Code |
| เริ่ม Phase 1 | AUTHORIZED | ผู้ใช้ตอบ “อนุมัติ Proposal และเริ่ม Phase 1” วันที่ 2026-10-23; scope = Foundation & No-AI Vertical Slice |
| ADR-0001 topic taxonomy | ACCEPTED | ผู้ใช้ตอบ “อนุมัติ ADR-0001” วันที่ 2026-10-23; scope = topic IDs, optional `topicIds`, RC2 migration และ GT-16/17 |
| P1-WP2 validator runtime/tooling | AUTHORIZED | ผู้ใช้ตอบ “A, อนุมัติ 1-2-3-4” วันที่ 2026-10-24; scope = Node.js + Ajv 8, ติดตั้ง dev dependency (exact + lockfile), สร้าง concrete fixtures (expected outputs รอยืนยัน), baseline Git commit local (ไม่ push) |
| Commit P1-WP2, แก้ OD-07, P1-WP3 storage = local files | AUTHORIZED | ผู้ใช้ตอบ “อนุมัติ commit, แก้ OD-07, P1-WP3 ใช้ไฟล์ local” วันที่ 2026-10-24; commit local เท่านั้น ไม่ push; OD-06 ยังไม่ได้รับการยืนยัน |
| OD-06 B1–B8 + golden expected outputs; commit P1-WP3; ปิด Phase 1 | APPROVED | ผู้ใช้ตอบ “ยืนยัน ข้อ 1 และ 2, อนุม้ติ Phase 1 แต่ยังไม่เริ่ม Phase 2” วันที่ 2026-10-24 |
| GT-07 confirm; commit P2-WP1/P2-WP2; OD-03 อนุมัติ API surface ตามที่เสนอ; OD-04 = B (Cloud Run + Google Sign-In ID token) | APPROVED | ผู้ใช้ตอบ “ยืนยันและอนุมัติข้อ 1 - 4” วันที่ 2026-10-24 (ข้อ 4 ตีความเป็นข้อแนะนำใน decision packet; OD-08 ไม่มีข้อแนะนำเดียวจึงยังเปิด) |
| GitHub repo + Pages frontend | AUTHORIZED | ผู้ใช้ตอบ “ใช้ https://github.com/ เป็น Frontend ให้ชื่อว่า K-Knowledge-Banks เข้า GitHub และไปจัดการให้ด้วย” + เลือก Public / ทั้ง repo / noreply / push ผ่าน connector วันที่ 2026-10-24 |
| Phase 1 → Phase 2 | AUTHORIZED | ผู้ใช้ตอบ “เริ่ม Phase 2” วันที่ 2026-10-24; scope = PHASE-2.md; backend/auth/API/provider ยังต้องตัดสินแยก (OD-03/OD-04) ห้ามเลือกเอง |
| Phase 2 → Phase 3 | PENDING | ยังไม่มี |
| Phase 3 → Phase 4 | PENDING | ยังไม่มี |
| ปิด Phase 4 / รับมอบ | PENDING | ยังไม่มี |

## Work packet handoff
Done: สร้าง baseline documentation pack, ผ่าน [Baseline Consistency Review](BASELINE-REVIEW.md), align workflow/roles/Phase 1, promote Formal Schema/Vocabulary เป็น approved bindings และสร้าง portable JSON Schema, machine-readable vocabulary กับ synthetic fixture manifest; รักษา .git และยังไม่มี dependency install, commit/tag หรือ deploy

Verification: ดูรายงานตรวจ links/version/terminology/inventory ที่แนบตอนส่งมอบ การตรวจเอกสารไม่ใช่การผ่าน golden/application acceptance

Phase 1 packet P1-WP1 verification: JSON ทั้งสามไฟล์ parse ผ่าน, internal schema refs 36 รายการ resolve, workflow enum และ participant roles ตรง vocabulary, fixture IDs ครบ GT-01..06,10,14,15 และ Markdown links resolve; JSON Schema execution/GT/AC = NOT RUN

ADR-0001 implementation: สร้าง RC2 schema/vocabulary และ GT-16/17 fixture แล้ว; RC1 files คงอยู่, ไม่มี canonical records ให้ migrate/invalidate และยังไม่มี active read model ให้ rebuild

Prompt engineering: เพิ่ม `docs/prompts/KEKB-MASTER-ENGINEERING-PROMPT.md` และ `WORK-PACKET-PROMPT-TEMPLATE.md` เป็น operational entry point ที่อ่าน live state/baseline ทุกครั้ง; ไม่เปลี่ยน Architecture หรือ approval gates

P1-WP2 (2026-10-24): baseline commit `400d492` (local); ติดตั้ง ajv 8.20.0 + ajv-formats 3.0.1 (devDependencies, exact, `package-lock.json`); สร้าง `validator/` (strict loader, schema dispatch ต่อ version, cross-record rules, CLI, stable safe codes) และ concrete fixtures 35 variants ใน `fixtures/golden/records/` (scenario manifests เดิมไม่ถูกแก้)

Verification P1-WP2: `npm test` → contracts 7/7, strict-json 6/6, golden 36/36 PASS; mutation check 6/6 rule mutants ถูกจับโดย case ที่ถูกต้อง; CLI exit 0/1 ตรง; issue output ไม่ echo marker ค่า input. Ajv strict lint `strictTypes`/`strictRequired` ถูก log (contract ผ่าน 2020-12 metaschema; ไม่แก้ contract) ข้อจำกัด: การ import Ajv ใน VM ผ่าน OneDrive mount ใช้ ~9 วินาที (I/O ไม่ใช่ CPU)

P1-WP3 (2026-10-24): `core/` local-file vertical slice (store, workflow transitions, human review → ReviewSnapshot, service-principal commit แบบ idempotent + pin revision/content hash, deterministic read model + completeness check + last-known-good, Thai substring search, evidence trace, public field allowlist, audit log) และ CLI `core/bin/kekb.js`; ไม่มี dependency ใหม่, ไม่มี network/AI; store สร้างตาม path ที่ระบุ (test ใช้ temp dir จึงไม่มีข้อมูลสมมติใน repo)

Verification P1-WP3: `npm test` 60/60 (validator 49 + slice 11); GT-12 run log: intake → drafts → validate(11 PASS) → review-ready → review APPROVE/PASS → commit canonical@1 → publish rm-1 (12 current, 7 searchable, 5 excluded, 4 traced); mutation 4/4 (review role, revision pin, allowlist, idempotency) ถูกจับ; static scan ไม่มี network/AI imports; CLI smoke: search ไทย/trace/safe error exit 1 ผ่าน. ข้อจำกัด: identity เป็น local registry ไม่ใช่ authentication (OD-04); separation-of-duties ยังไม่บังคับ; single-process เท่านั้น; Drive/Sheets/GitHub remote/backend/UI = NOT RUN (Phase 2+)

Phase 1 exit evidence: AC-01 PASS (validator), AC-02 PASS (rule + local commit pipeline), AC-03 No-AI core PASS (local), GT-01..06,10,12,14,15 PASS + GT-16/17 PASS — ทั้งหมดใช้ข้อมูลสมมติ และ golden expected outputs ยังรอยืนยัน (OD-06); external Drive/Sheets/deployment cases = NOT RUN

Phase 1 closure (2026-10-24): ผู้ใช้ยืนยัน OD-06 และอนุมัติปิด Phase 1; golden fixtures เป็น regression authority

P2-WP1 (2026-10-24, ยังไม่ commit): validator rule `DERIVATION_LINEAGE_CYCLE` (self-cycle + descendant cycle; semantic graph cycle ยังอนุญาต); `core/src/dependency.js` คำนวณ stale (REF_SUPERSEDED / DEPENDS_ON_STALE, รวม DerivationRun→output) ลง read model `stale.json` + flag `dependencyStale` ใน search/trace; review APPROVE และ commit ปฏิเสธ `STALE_REFERENCE`; trace แสดง DerivationRun (ไม่รวม parameters) ให้ output ย้อนถึง input revision เดิม; fixtures GT-07 3 variants ใน `phase2-cases.json` = PENDING_HUMAN_CONFIRMATION

Verification P2-WP1: `npm test` ผ่านทั้งหมด (ดูรายงาน); GT-07 validator 3/3 + core 4/4; mutation 5/5 ถูกจับ; ไม่มี dependency ใหม่ ข้อจำกัด: staleness เป็นแบบ conservative (อาจ flag AnalysisRun ที่อ้าง Result ที่ stale) และไม่ invalidate canonical อัตโนมัติ — ต้อง re-review โดยมนุษย์

P2-WP2 (2026-10-24): ผู้ใช้สั่งใช้ Drive folder “4. K-Knowledge Bank” และสร้าง Google Sheet เป็น database ตามที่กำหนด → สร้าง Google Sheet “KEKB Workflow” (7 tabs: README, IntakeQueue, RecordStatus, ReviewQueue, CandidateQueue, AuditLog, Vocab; data validation อ้าง Vocab) ตามบทบาท baseline = operational workflow state เท่านั้น (ไม่ใช่ canonical/KG database); contract ของชีตอยู่ที่ `contracts/workflow-sheet/kekb-workflow-sheet-v1.json`; Drive/Sheet IDs เก็บใน `config/integrations.local.json` (gitignored, ไม่ commit เพราะเปิดถึง resource ส่วนตัว)

Verification P2-WP2: อ่านไฟล์หลัง upload ผ่าน Drive → 7 tabs, headers ครบตาม contract, Vocab ตรง vocabulary RC2; data validation ใน Google Sheets = NOT VERIFIED (Drive read ไม่แสดง); known issue: README บางบรรทัดในพจนานุกรมคอลัมน์ (timestamp columns) อธิบายผิดว่า "ค่าจาก Vocab" — แก้ได้เมื่อเปิด Google Sheets connector; ยังไม่มี sync อัตโนมัติ (รอ OD-04)

Next packet: P2-WP3 GitHub repo + Pages frontend shell; แล้ว P2-WP4 backend (Cloud Run + Google Sign-In) + Sheets/Drive sync

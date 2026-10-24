# Project State

Documentation pack: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok) · ปรับปรุงล่าสุด: 2026-10-25 (P2-WP6 deployed)

## Current status
- Current Phase = **Phase 2 — Knowledge Intake, Evidence & Human Review** (STARTED 2026-10-24)
- Coding = STARTED (Phase 2 scope only; OD-03/OD-04/OD-08 ตัดสินแล้ว 2026-10-24)
- Next = ผู้ใช้ทดสอบ e2e P2-WP6 ด้วยไฟล์จริงผ่าน console.html; ถัดไป P2-WP7 publication ไป GitHub canonical
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
| OD-04 | backend/auth provider, roles, public/private canonical, source permissions, backup/retention | **CHANGED 2026-10-24**: backend = **Google Apps Script** (ผู้ใช้เลือก A แทน B เพื่อไม่ต้องตั้ง GCP billing); identity สำหรับ web write endpoints, role assignment, source permissions, backup/retention ยังเปิด |
| OD-05 | phase allocation และ MVP 2D optional/3D deferred | ผู้ใช้ยืนยัน scope และ phase prompts |
| OD-06 | Binding assumptions B1–B5 ([validator/README](../../validator/README.md)), B6–B8 ([core/README](../../core/README.md)) และ golden expected outputs ใน `fixtures/golden/records/cases.json` | **CLOSED 2026-10-24**: ผู้ใช้ยืนยันทั้งหมด; เป็น binding authority และ regression authority; การเปลี่ยนใช้ ADR + migration plan + User approval |
| OD-08 | Separation of duties: ผู้สร้าง revision อนุมัติ revision เดียวกันเองได้หรือไม่ | **CLOSED 2026-10-24**: อนุญาต (ผ่อนปรน) แต่ต้องบันทึก flag `selfApproval` ใน snapshot/audit เสมอ — ทบทวนใหม่เมื่อมีผู้ตรวจ ≥ 2 คน |
| OD-09 | Canonical repository visibility (public/private) และ GitHub remote สำหรับ push | **CLOSED 2026-10-24**: ผู้ใช้เลือก repo `Krit-PJ/K-Knowledge-Banks` **Public**, push ทั้ง repo ปัจจุบัน, ใช้เป็น GitHub Pages frontend, commit email = GitHub noreply, push ผ่าน GitHub connector ของ Claude. ผลที่ตามมา: canonical/fixtures/docs เป็นสาธารณะ → ห้ามนำข้อมูลจริงที่ไม่ใช่ PUBLIC เข้า canonical ใน repo นี้ |
| OD-07 | Metadata ไม่สอดคล้อง RC1/RC2 | **CLOSED 2026-10-24**: แก้ `AGENTS.md:6`, `PHASE-1..4.md:3` เป็น RC2 และนำ `contracts/vocabulary/topics-v1.0-RC2.proposed.json` ออก (ซ้ำกับ topics ใน `vocabulary/v1.0-RC2.json` และไม่มีไฟล์ใดอ้างถึง; กู้คืนได้ด้วย `git show f2e4ef2:contracts/vocabulary/topics-v1.0-RC2.proposed.json`) |

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
| Identity = Google Sign-In + allowlist อีเมล; OD-08 = ผ่อนปรน + flag; เริ่ม P2-WP5 | APPROVED | ผู้ใช้ตอบ “ตามที่แนะนำ” วันที่ 2026-10-24 ต่อคำถาม (1) ยืนยันตัวตนด้วยบัญชี Google เฉพาะอีเมลที่กำหนด (2) อนุมัติงานตัวเองได้แต่บันทึกไว้ |
| OD-04 เปลี่ยนเป็น Apps Script + เริ่ม P2-WP4 | AUTHORIZED | ผู้ใช้ตอบ “เปลี่ยนเป็น A (Apps Script) และ ดำเนินการต่อที่ Phase 2: P2-WP4 backend และการ sync กับ Sheets/Drive” วันที่ 2026-10-24 |
| GitHub repo + Pages frontend | AUTHORIZED | ผู้ใช้ตอบ “ใช้ https://github.com/ เป็น Frontend ให้ชื่อว่า K-Knowledge-Banks เข้า GitHub และไปจัดการให้ด้วย” + เลือก Public / ทั้ง repo / noreply / push ผ่าน connector วันที่ 2026-10-24 |
| Phase 1 → Phase 2 | AUTHORIZED | ผู้ใช้ตอบ “เริ่ม Phase 2” วันที่ 2026-10-24; scope = PHASE-2.md; backend/auth/API/provider ยังต้องตัดสินแยก (OD-03/OD-04) ห้ามเลือกเอง |
| P2-WP6 scope + ADR-0002 (drafts = Drive JSON, validator = Ajv standalone + esbuild bundle, editor = JSON + template) | APPROVED | ผู้ใช้ตอบ “2” (เริ่ม P2-WP6) แล้วเลือกตัวเลือกที่แนะนำทั้ง 3 ข้อ วันที่ 2026-10-25 00:51 |
| Phase 2 → Phase 3 | PENDING | ยังไม่มี |
| Phase 3 → Phase 4 | PENDING | ยังไม่มี |
| ปิด Phase 4 / รับมอบ | PENDING | ยังไม่มี |

## Work packet handoff
Done: สร้าง baseline documentation pack, ผ่าน [Baseline Consistency Review](BASELINE-REVIEW.md), align workflow/roles/Phase 1, promote Formal Schema/Vocabulary เป็น approved bindings และสร้าง portable JSON Schema, machine-readable vocabulary กับ synthetic fixture manifest; รักษา .git และยังไม่มี dependency install, commit/tag หรือ deploy

Verification: ดูรายงานตรวจ links/version/terminology/inventory ที่แนบตอนส่งมอบ การตรวจเอกสารไม่ใช่การผ่าน golden/application acceptance

Phase 1 packet P1-WP1 verification: JSON ทั้งสามไฟล์ parse ผ่าน, internal schema refs 36 รายการ resolve, workflow enum และ participant roles ตรง vocabulary, fixture IDs ครบ GT-01..06,10,14,15 และ Markdown links resolve; JSON Schema execution/GT/AC = NOT RUN

ADR-0001 implementation: สร้าง RC2 schema/vocabulary และ GT-16/17 fixture แล้ว; RC1 files คงอยู่, ไม่มี canonical records ให้ migrate/invalidate และยังไม่มี active read model ให้ rebuild

Prompt engineering: เพิ่ม `docs/prompts/KEKB-MASTER-ENGINEERING-PROMPT.md` และ `WORK-PACKET-PROMPT-TEMPLATE.md` เป็น operational entry point ที่อ่าน live state/baseline ทุกครั้ง; ไม่เปลี่ยน Architecture หรือ approval gates

P1-WP2 (2026-10-24): baseline commit `f2e4ef2` (local); ติดตั้ง ajv 8.20.0 + ajv-formats 3.0.1 (devDependencies, exact, `package-lock.json`); สร้าง `validator/` (strict loader, schema dispatch ต่อ version, cross-record rules, CLI, stable safe codes) และ concrete fixtures 35 variants ใน `fixtures/golden/records/` (scenario manifests เดิมไม่ถูกแก้)

Verification P1-WP2: `npm test` → contracts 7/7, strict-json 6/6, golden 36/36 PASS; mutation check 6/6 rule mutants ถูกจับโดย case ที่ถูกต้อง; CLI exit 0/1 ตรง; issue output ไม่ echo marker ค่า input. Ajv strict lint `strictTypes`/`strictRequired` ถูก log (contract ผ่าน 2020-12 metaschema; ไม่แก้ contract) ข้อจำกัด: การ import Ajv ใน VM ผ่าน OneDrive mount ใช้ ~9 วินาที (I/O ไม่ใช่ CPU)

P1-WP3 (2026-10-24): `core/` local-file vertical slice (store, workflow transitions, human review → ReviewSnapshot, service-principal commit แบบ idempotent + pin revision/content hash, deterministic read model + completeness check + last-known-good, Thai substring search, evidence trace, public field allowlist, audit log) และ CLI `core/bin/kekb.js`; ไม่มี dependency ใหม่, ไม่มี network/AI; store สร้างตาม path ที่ระบุ (test ใช้ temp dir จึงไม่มีข้อมูลสมมติใน repo)

Verification P1-WP3: `npm test` 60/60 (validator 49 + slice 11); GT-12 run log: intake → drafts → validate(11 PASS) → review-ready → review APPROVE/PASS → commit canonical@1 → publish rm-1 (12 current, 7 searchable, 5 excluded, 4 traced); mutation 4/4 (review role, revision pin, allowlist, idempotency) ถูกจับ; static scan ไม่มี network/AI imports; CLI smoke: search ไทย/trace/safe error exit 1 ผ่าน. ข้อจำกัด: identity เป็น local registry ไม่ใช่ authentication (OD-04); separation-of-duties ยังไม่บังคับ; single-process เท่านั้น; Drive/Sheets/GitHub remote/backend/UI = NOT RUN (Phase 2+)

Phase 1 exit evidence: AC-01 PASS (validator), AC-02 PASS (rule + local commit pipeline), AC-03 No-AI core PASS (local), GT-01..06,10,12,14,15 PASS + GT-16/17 PASS — ทั้งหมดใช้ข้อมูลสมมติ และ golden expected outputs ยังรอยืนยัน (OD-06); external Drive/Sheets/deployment cases = NOT RUN

Phase 1 closure (2026-10-24): ผู้ใช้ยืนยัน OD-06 และอนุมัติปิด Phase 1; golden fixtures เป็น regression authority

P2-WP1 (2026-10-24, ยังไม่ commit): validator rule `DERIVATION_LINEAGE_CYCLE` (self-cycle + descendant cycle; semantic graph cycle ยังอนุญาต); `core/src/dependency.js` คำนวณ stale (REF_SUPERSEDED / DEPENDS_ON_STALE, รวม DerivationRun→output) ลง read model `stale.json` + flag `dependencyStale` ใน search/trace; review APPROVE และ commit ปฏิเสธ `STALE_REFERENCE`; trace แสดง DerivationRun (ไม่รวม parameters) ให้ output ย้อนถึง input revision เดิม; fixtures GT-07 3 variants ใน `phase2-cases.json` = PENDING_HUMAN_CONFIRMATION

Verification P2-WP1: `npm test` ผ่านทั้งหมด (ดูรายงาน); GT-07 validator 3/3 + core 4/4; mutation 5/5 ถูกจับ; ไม่มี dependency ใหม่ ข้อจำกัด: staleness เป็นแบบ conservative (อาจ flag AnalysisRun ที่อ้าง Result ที่ stale) และไม่ invalidate canonical อัตโนมัติ — ต้อง re-review โดยมนุษย์

P2-WP2 (2026-10-24): ผู้ใช้สั่งใช้ Drive folder “4. K-Knowledge Bank” และสร้าง Google Sheet เป็น database ตามที่กำหนด → สร้าง Google Sheet “KEKB Workflow” (7 tabs: README, IntakeQueue, RecordStatus, ReviewQueue, CandidateQueue, AuditLog, Vocab; data validation อ้าง Vocab) ตามบทบาท baseline = operational workflow state เท่านั้น (ไม่ใช่ canonical/KG database); contract ของชีตอยู่ที่ `contracts/workflow-sheet/kekb-workflow-sheet-v1.json`; Drive/Sheet IDs เก็บใน `config/integrations.local.json` (gitignored, ไม่ commit เพราะเปิดถึง resource ส่วนตัว)

Verification P2-WP2: อ่านไฟล์หลัง upload ผ่าน Drive → 7 tabs, headers ครบตาม contract, Vocab ตรง vocabulary RC2. Fix 2026-10-24 (Google Sheets connector): พบว่า data validation หายตอนแปลง .xlsx → ใส่ใหม่ 9 คอลัมน์ (ONE_OF_RANGE อ้าง Vocab, strict) และแก้พจนานุกรมคอลัมน์ README ที่อธิบาย timestamp ผิด — อ่านกลับยืนยันแล้ว

P2-WP3 (2026-10-24): สร้าง GitHub repo `Krit-PJ/K-Knowledge-Banks` (Public) ผ่านเบราว์เซอร์, ตั้ง Pages source = GitHub Actions, push `main` ผ่าน Claude GitHub App (ผู้ใช้ติดตั้งแบบ select repository เดียว); commit author/committer ถูก rewrite เป็น GitHub noreply ก่อน push

Verification P2-WP3: pre-push scan ทั้ง working tree + history ไม่พบ secret/token/Drive ID/อีเมล; clean clone `npm ci && npm test` 68/68; GitHub Actions run `test-and-deploy-pages` → test: success, deploy: success; https://krit-pj.github.io/K-Knowledge-Banks/ โหลดได้และแสดง frontend shell ภาษาไทย (ไม่มีข้อมูลความรู้). ข้อจำกัด: PROJECT-STATE มี local path ของเครื่องผู้ใช้ (ความเสี่ยงต่ำ, ผู้ใช้รับทราบ)

P2-WP4 (2026-10-24): `backend/apps-script/` (Lib.js pure logic + Code.js adapters + appsscript.json scopes แคบ) — Drive `SourceAssets` → IntakeQueue (RECEIVED, RESTRICTED โดยปริยาย, key driveFileId+sha256, ไม่เก็บชื่อไฟล์) และ GitHub canonical (`knowledge/`) → RecordStatus (COMMITTED/PUBLISHED/SUPERSEDED + dependencyStale, canonical wins); ไม่ลบแถว, คงคอลัมน์มนุษย์, กัน formula injection, LockService; ไม่มี web write endpoint. สร้าง Drive folder `SourceAssets` (ID ใน config local). Sheet fix: data validation 9 คอลัมน์ + README dictionary

Verification P2-WP4: `npm test` 79/79 (เพิ่ม Apps Script 11); mutation 5/5 ถูกจับ (หลังเพิ่ม test กรณี same-key rerun ที่พบจาก mutant A1 รอด); การรันจริงใน Apps Script = NOT RUN (ต้องติดตั้งและอนุญาต OAuth โดยผู้ใช้); canonical root `knowledge/` ยังไม่มีใน repo → คาดว่าได้ `NO_CANONICAL`

Deployment P2-WP4 (2026-10-24): สร้าง Apps Script project “KEKB Workflow Sync” ผูกกับ Sheet ผ่าน browser pane, ใส่โค้ดผ่าน editor API แล้วยืนยัน sha256 หลังรีโหลดตรง repo ทั้ง 3 ไฟล์ (Code bf37d8bb…, Lib 513709b6…, manifest 103bffe4…), ตั้ง Script Properties 4 ค่า; ผู้ใช้กดอนุญาต OAuth และรัน `setup` + `runSync` เอง

Verification (จริง): AuditLog seq 1 `sync:intake` OK `NO_CHANGE` (0 files), seq 2 `sync:canonical` OK `NO_CANONICAL`; ทริกเกอร์ `runSync` แบบตามเวลา 1 ตัว; IntakeQueue/RecordStatus ว่างตามคาด. NOT RUN: intake กับไฟล์จริง และ canonical mirror กับ canonical จริง (ยังไม่มี `knowledge/` ใน repo)

Next packet: e2e intake ด้วยไฟล์จริง แล้ว P2-WP5 web write endpoints หลังตัดสิน identity + OD-08

P2-WP5 (2026-10-24/25): secure write boundary — `backend/apps-script/Api.js` (KEKB_API.handle: size → shape → action allowlist → Google ID token claims via tokeninfo (aud/iss/exp/email_verified) → allowlist ACTORS_JSON จาก Script Properties → role → idempotency (actorId|key + payload hash, CacheService 6 ชม.) → expectedUpdatedAt (REVISION_CONFLICT) → execute → AuditLog); `doGet/doPost` ใน Code.js; actions = `whoami`, `intake.list`, `intake.update` (เฉพาะคอลัมน์ accessClassification/originalLanguage/assignedTo/note); `frontend/console.html` + `console.js` (Google Identity Services, token อยู่ในหน่วยความจำเท่านั้น, CSP เข้ม, render ด้วย textContent). OD-08 = ผ่อนปรน + flag (ผู้ใช้อนุมัติ)

Deployment P2-WP5 (2026-10-25): GCP project `kekb-auth` (OAuth consent External/Testing, test user 1 คน), OAuth Web client จำกัด origin `https://krit-pj.github.io` (ไม่เก็บ client secret); อัปเดต Apps Script ผ่าน browser pane และยืนยัน sha256 หลังรีโหลดตรง repo ทั้ง 4 ไฟล์ (Code 4e6a36ae…, Lib 7a0b24fc…, Api 9ec458e8…, manifest 1ff735e3…); Script Properties เพิ่ม `OAUTH_CLIENT_ID`, `ACTORS_JSON` (1 actor `human:krit`); Deploy Web App version 1 (execute as owner, access anyone — ความปลอดภัยอยู่ที่การตรวจ ID token + allowlist ฝั่ง server); `frontend/config.json` ใส่ apiUrl + oauthClientId (ค่าสาธารณะ ไม่ใช่ secret); IDs อื่นอยู่ใน config local

Verification P2-WP5: `npm test` ผ่านทั้งหมด (รวม api.test 8 + frontend static tests); security mutation 5/5 ถูกจับ; live smoke จาก browser → token ปลอม = `UNAUTHENTICATED`, action ไม่รู้จัก = `INVALID_INPUT(action)`, key แปลก (`role`) = `INVALID_INPUT(role)`, ไม่มีค่าใด ๆ ของ input สะท้อนกลับ. Live e2e (2026-10-25, ผู้ใช้ทดสอบเอง): ลงชื่อเข้าใช้ Google ที่ console.html สำเร็จ → `whoami` = `human:krit` และ `intake.list` แสดง IntakeQueue (ว่างตามคาด) = PASS. NOT RUN: `intake.update` จริง (ยังไม่มีแถว) และ e2e intake ด้วยไฟล์จริง

Next packet: ผู้ใช้ทดสอบลงชื่อเข้าใช้ console.html → แล้ว P2-WP6 drafts/validation/review ผ่านเว็บ (bundle validator สำหรับ Apps Script)

P2-WP6 (2026-10-25, code complete — deploy pending): drafts/validation/review ผ่านเว็บตาม [ADR-0002](../adr/ADR-0002-draft-storage-and-apps-script-engine.md) — `core/src/engine.js` = workflow engine เดียว (storage-agnostic) ที่ทั้ง local core และ Apps Script ใช้; `scripts/build-apps-script.mjs` สร้าง `backend/apps-script/Engine.js` (Ajv standalone pre-compiled + esbuild 0.28.2, dev dependency exact pin); API ใหม่ `source.register` (re-hash Drive bytes, storageRef `kekb-intake:<intakeId>` ไม่มี Drive ID ใน record), `source.extracted`, `draft.list/get/save/validate`, `review.list/request/decide`; Code.js: Drive JSON store (`drive.file`), mirror RecordStatus/ReviewQueue/IntakeQueue.workflowState + AuditLog (buffer แล้ว flush ครั้งเดียว), `setupDrafts()`; console: intake → ลงทะเบียน → JSON editor + templates → ตรวจ → ส่งตรวจ → ตัดสิน (แสดงป้าย “ตรวจงานตัวเอง” ตาม OD-08)

Verification P2-WP6: `npm test` 113/113 (เดิม 90) — รวม engine bundle byte-identical rebuild, parity กับ Node validator ทุก golden case, API workflow 8, Code.js adapter e2e บน fake Drive/Sheets/tokeninfo 3, frontend checks; mutation 10/10 ถูกจับ (หลังเพิ่ม test กรณีแก้ไฟล์ draft revision เดิม และตาราง role); UI smoke ด้วย Playwright (API ตอบด้วย Api+Engine จริงบนข้อมูลในหน่วยความจำ) ครบ flow ไม่มี console error — validator จับ LOCATOR_NOT_SUPPORTED ได้จริงเมื่อ SourceAsset ไม่ประกาศ `paragraph`. NOT RUN: deploy จริงบน Apps Script และ e2e ด้วยไฟล์จริง

ความเสี่ยง/ข้อจำกัด P2-WP6: ยืนยันบน Google จริงแล้วว่า `DriveApp.createFolder` ต้องใช้ scope `drive` เต็ม → เปลี่ยน draft store เป็น Drive v3 REST ผ่าน UrlFetchApp + `ScriptApp.getOAuthToken()` (ยังคง `drive.file`; token อยู่ฝั่ง server เท่านั้น); รายการ draft อ่านทั้งโฟลเดอร์ต่อคำขอ (พอสำหรับหลักร้อย); idempotency เก็บ 6 ชม.; Engine.js 450 KB (minified, มี license notice ของ ajv/ajv-formats)

Deployment P2-WP6 (2026-10-25): อัปเดต Apps Script 5 ไฟล์ (ดึงจาก commit ที่ pin แล้วตรวจ sha256 หลังรีโหลด: manifest 58a219de…, Code 50a27646…, Lib 5ec75d87…, Api 4f2ee9b1…, Engine b4391799…); ผู้ใช้อนุญาตสิทธิ์ `drive.file`; `setupDrafts` รอบแรกล้มเหลว (DriveApp.createFolder ต้องใช้ scope `drive`) → แก้เป็น Drive REST (commit 4b9f822) รอบสองสำเร็จ; Deploy Web App version 2 (URL เดิม). Live smoke: `draft.list` ด้วย token ปลอม = `UNAUTHENTICATED`, action ไม่รู้จัก = `INVALID_INPUT(action)`. NOT RUN: e2e ด้วยไฟล์จริงโดยผู้ใช้

Next packet: e2e P2-WP6 ด้วยไฟล์จริง → P2-WP7 publication (canonical commit ไป GitHub) + Gap/Conflict candidates

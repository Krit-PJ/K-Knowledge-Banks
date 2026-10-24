# KEKB Apps Script backend (P2-WP4 → P2-WP6)

Backend ตาม OD-04 = **Google Apps Script** ผูกกับ Google Sheet "KEKB Workflow" ทำงานด้วยสิทธิ์เจ้าของผ่าน time-driven trigger ทุก 15 นาที

| ไฟล์ | หน้าที่ |
|---|---|
| `Lib.js` | logic ล้วน (ไม่มี Google services) ทดสอบใน Node: `npm test` |
| `Api.js` | web API pipeline (ตรวจ token → allowlist → role → idempotency → action → audit) |
| `Engine.js` | **ไฟล์ที่สร้างอัตโนมัติ — ห้ามแก้มือ** workflow engine + validator (`npm run build:apps-script`) ดู ADR-0002 |
| `Code.js` | adapters: SpreadsheetApp, DriveApp, UrlFetchApp, LockService, ScriptApp, CacheService |
| `appsscript.json` | manifest + OAuth scopes แบบแคบที่สุด |

## สิ่งที่ทำ (และไม่ทำ)

- **Drive intake:** ไฟล์ในโฟลเดอร์ `SourceAssets` → แถว `IntakeQueue` พร้อม sha256 และ driveFileId
  - สถานะ `RECEIVED` และ `accessClassification = RESTRICTED` จนกว่ามนุษย์จะกำหนด
  - ไฟล์เดิมเนื้อหาเดิมจะไม่ซ้ำ; เนื้อหาใหม่ = แถวใหม่ (แถวเดิมคงไว้)
  - ไม่เก็บชื่อไฟล์ (อาจมีข้อมูลส่วนบุคคล); ไฟล์ Google-native หรือใหญ่เกินจะเป็น `ERROR` พร้อม code
- **Canonical mirror:** อ่าน `knowledge/canonical/` และ `knowledge/read-models/` จาก GitHub repo (public, ไม่ใช้ token) → `RecordStatus`
  - `COMMITTED` / `PUBLISHED` / `SUPERSEDED` และธง `dependencyStale`; canonical ชนะเสมอ
  - ถ้ายังไม่มี canonical ใน repo จะบันทึก `NO_CANONICAL` ใน AuditLog
- ไม่ลบแถว, คงคอลัมน์ที่มนุษย์แก้, กัน formula injection, LockService กันรันซ้อน
- **Web API (P2-WP5/6):** Google Sign-In ID token + allowlist `ACTORS_JSON`; ลงทะเบียน SourceAsset (คำนวณ sha256 ใหม่จาก Drive), ร่าง/ตรวจ/ส่งตรวจ/ตัดสิน
- **Drafts (P2-WP6):** ไฟล์ JSON ในโฟลเดอร์ Drive `KEKB Drafts (private)` ที่สคริปต์สร้างเอง (`records/<id>@<rev>.json`, `reviews/<requestId>.json`); Sheet เก็บแค่สำเนาสถานะ

## อัปเดตเป็น P2-WP6 (ครั้งเดียว)

1. แทนที่ไฟล์ `appsscript.json`, `Code`, `Lib`, `Api` และเพิ่มไฟล์ใหม่ `Engine` จากโฟลเดอร์นี้ (ตรวจ sha256 ให้ตรง repo)
2. เลือกฟังก์ชัน `setupDrafts` → **Run** → อนุญาตสิทธิ์ใหม่ `drive.file` (เจ้าของบัญชีต้องกดเอง)
3. **Deploy → Manage deployments → แก้ไข → New version** (URL เดิมไม่เปลี่ยน)

## ติดตั้ง (ครั้งเดียว)

1. เปิด Google Sheet "KEKB Workflow" → **Extensions → Apps Script**
2. **Project Settings** (รูปเฟือง) → ติ๊ก **Show "appsscript.json" manifest file in editor**
3. ในหน้า **Editor**:
   - แทนที่เนื้อหา `appsscript.json` ด้วยไฟล์ในโฟลเดอร์นี้
   - แทนที่ `Code.gs` ด้วย `Code.js`
   - เพิ่มไฟล์ใหม่ชื่อ `Lib` แล้ววาง `Lib.js`
4. **Project Settings → Script Properties** เพิ่มค่า (ค่าจริงอยู่ใน `config/integrations.local.json` บนเครื่องผู้ดูแล ไม่อยู่ใน repo):
   - `SOURCE_FOLDER_ID` — ID ของโฟลเดอร์ Drive `SourceAssets`
   - `GITHUB_REPO` = `Krit-PJ/K-Knowledge-Banks`
   - `GITHUB_BRANCH` = `main`
   - `CANONICAL_ROOT` = `knowledge`
5. เลือกฟังก์ชัน `setup` → **Run** → อนุญาตสิทธิ์ตามที่ Google ถาม (เจ้าของบัญชีต้องกดเอง)
6. เลือก `runSync` → **Run** หนึ่งครั้ง แล้วตรวจแท็บ `IntakeQueue` และ `AuditLog`

## สิทธิ์ (OAuth scopes)

- `spreadsheets.currentonly` — เฉพาะ Sheet ที่ผูกสคริปต์
- `drive.readonly` — อ่านไฟล์ต้นฉบับใน Drive อย่างเดียว ไม่แก้หรือลบ
- `drive.file` — เขียนได้เฉพาะไฟล์/โฟลเดอร์ที่สคริปต์นี้สร้างเอง (โฟลเดอร์ Drafts)
- `script.external_request` — อ่าน raw.githubusercontent.com
- `script.scriptapp` — ตั้ง time-driven trigger

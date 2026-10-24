# K-Knowledge Bank

Documentation pack: **v1.0-RC2**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

คลังความรู้ที่ตรวจสอบย้อนกลับถึงหลักฐานได้ ใช้ภาษาไทยเป็นหลัก รองรับหลายภาษา และทำงานแกนหลักได้โดยไม่พึ่ง AI (AI-Independent Core)

เริ่มอ่าน [AGENTS.md](AGENTS.md) → [Baseline index](docs/baseline/BASELINE.md) → [สถานะโครงการ](docs/development/PROJECT-STATE.md)

Repository นี้เป็น Source of Truth สำหรับข้อกำหนด, portable Phase 1 contracts และ canonical structured knowledge v1 ในอนาคต ขณะนี้เริ่ม Phase 1 แล้ว แต่ยังไม่มี backend/frontend integration หรือ deployment

Phase 1 contract assets อยู่ใน [`contracts/`](contracts/README.md) และ synthetic golden fixture manifest อยู่ใน [`fixtures/golden/`](fixtures/golden/phase1-manifest.json) โดย schema execution ยัง `NOT RUN` จนกว่าจะอนุมัติ validator runtime

Topic taxonomy สำหรับข่าวและเทรนด์ได้รับอนุมัติใน [ADR-0001](docs/adr/ADR-0001-topic-taxonomy.md); RC2 schema/vocabulary และ GT-16/17 fixture ถูกสร้างแล้วโดยยังรักษา RC1 เพื่อ compatibility

Prompt สำหรับดำเนินโครงการ: [KEKB Master Engineering Prompt](docs/prompts/KEKB-MASTER-ENGINEERING-PROMPT.md) และ [Work Packet Prompt Template](docs/prompts/WORK-PACKET-PROMPT-TEMPLATE.md)

หลักอำนาจตัดสินใจ: **Evidence→Model→Rules→Human Authority** ระบบช่วยจัดโครงสร้างและตรวจเงื่อนไข แต่มนุษย์เป็นผู้อนุมัติความรู้และการเปลี่ยน phase

องค์ประกอบ: GitHub Pages frontend → Secure Backend/API → Drive raw source / Sheets workflow → Human Review → GitHub canonical structured knowledge v1 → generated read models → Search / Review / 2D / 3D โดยขอบเขต MVP และงานเลื่อนออกระบุใน [MVP-SCOPE](docs/baseline/MVP-SCOPE.md)

เอกสารฉบับนี้ consolidate จากคำสั่งผู้ใช้วันที่ข้างต้นและ preview ของบทสนทนาอ้างอิง ไม่ได้ตรวจต้นฉบับ MASTER DEVELOPMENT PROMPT v1.1 หรือ Formal Schema ฉบับเต็ม รายละเอียดที่เพิ่มเติมเพื่อให้ทำงานได้ต้องผ่าน consistency review ก่อนเริ่ม Phase 1 ดูรายการประเด็นในสถานะโครงการ

ห้าม commit/tag, deploy หรือติดตั้ง dependency โดยไม่มีคำสั่ง/decision ที่เกี่ยวข้อง Phase 1 ได้รับอนุมัติวันที่ 2026-10-23; Phase 2–4 ยังไม่ได้รับอนุมัติ

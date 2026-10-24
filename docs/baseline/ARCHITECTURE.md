# Architecture

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Boundaries
| Component | หน้าที่และ authority |
|---|---|
| GitHub Pages frontend | Thai-first UI; เรียก public read models หรือ API ที่ตรวจสิทธิ์; ไม่มี secrets |
| Secure Backend/API | authentication, authorization, validation, audit และ write boundary; provider ยังไม่เลือก |
| Drive raw source | ไฟล์ต้นฉบับและ version/hash ที่ Evidence อ้างถึง; ไม่ใช่ canonical knowledge |
| Sheets workflow | intake queue, assignment, review tracking; ไม่ใช่ที่แก้ canonical โดยตรง |
| Knowledge processing | manual modeling และ deterministic rules; AI เป็น optional adapter |
| Human Review | ตรวจ evidence, context และ protocol แล้วตัดสิน revision ที่ระบุ |
| GitHub canonical structured knowledge v1 | versioned structured records และ provenance; เป็น publication authority |
| Generated read models | indexes/views/graph derived จาก canonical revision; rebuild ได้ |
| Search / Review / 2D / 3D | consumers; graph view ไม่ได้สร้างข้อเท็จจริงเพิ่ม; 3D เลื่อนหลัง MVP |

## Data flow
Drive source → Sheets intake → draft structured model → rules validation → ReviewSnapshot + human decision → controlled GitHub canonical publication → deterministic read-model generation → frontend

UI ส่ง mutation ผ่าน backend เท่านั้น; backend ตรวจสิทธิ์และ revision ก่อนเขียน canonical Sheets status เป็นสำเนาสถานะ workflow ที่ reconcile ด้วย ID/revision ไม่ให้ Sheets และ GitHub เป็น dual masters

Canonical transaction ต้องผ่าน validation และ human approval ที่ตรง revision ก่อนเผยแพร่ การ publish/read-model ล้มเหลวต้องคง last-known-good revision และรายงาน stale ไม่แสดง partial output เป็นล่าสุด

## AI-Independent Core
ทำ vertical slice ด้วย manual input จนค้นหาได้โดยปิด AI; AI output เข้า draft เท่านั้น ต้องระบุ provenance และ human review เหมือนข้อมูลอื่น ห้ามผูก ID, validators หรือ publication กับ model/vendor

## Deployment decisions pending
ยังไม่ล็อก backend hosting, identity provider, persistence format, deployment pipeline, GitHub repository visibility หรือ source access model ต้องตรวจ security และอนุมัติก่อน implementation ที่ขึ้นกับ decision นั้น

# Security Model

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Trust boundaries
Browser/GitHub Pages, uploaded sources, Drive/Sheets cell content และ AI output เป็น untrusted input backend เป็น enforcement boundary; human authority เป็น decision boundary ห้ามนำคำสั่งใน source หรือ AI output มาเป็นสิทธิ์ทำงาน

| Human role | สิทธิ์ |
|---|---|
| VIEWER | อ่านเฉพาะข้อมูลและ provenance ที่ได้รับอนุญาต |
| CONTRIBUTOR | intake และแก้ draft; อนุมัติหรือ publish เองโดยอาศัย role นี้ไม่ได้ |
| REVIEWER | ตัดสิน revision ตาม ReviewProtocol เมื่อได้รับ resource permission |
| ADMIN | จัด configuration/access; ไม่มีสิทธิ์สร้าง approval ปลอมหรือ bypass validation |

Publisher เป็น service principal ไม่ใช่ human role และ publish ได้เฉพาะ revision ที่มนุษย์อนุมัติ ตรง expected revision ผ่าน validation และอยู่ใน resource permission ของ service

คนเดียวอาจมีหลาย role ได้ตาม policy ที่อนุมัติ แต่ทุก privileged request ต้องตรวจ Identity → Session → Role → Resource Permission และบันทึก actor จริง; separation-of-duties policy ยังต้องยืนยัน

## Required controls
- Secrets อยู่ server-side secret storage/environment ที่ควบคุมสิทธิ์ ไม่อยู่ GitHub Pages, repository, Sheets, logs หรือ generated read models
- ตรวจ object-level authorization ทุก read/write; least privilege ของ Drive/Sheets/GitHub service access; ไม่ถือว่า public frontend แปลว่า raw source ต้อง public
- กำหนด classification/สิทธิ์/ลิขสิทธิ์ของ source ก่อนเผยแพร่ excerpt; public read models ต้อง allowlist fields และไม่รั่ว private URL, PII หรือ raw text ที่จำกัดสิทธิ์
- Validate input, sanitize rendered text/links และป้องกัน script injection; ตรวจชนิด/ขนาดไฟล์ที่รับ; raw source ไม่ถูกรันเป็น executable
- ตรวจ auth และ revision ฝั่ง server; rate limits, request bounds, audit log ที่ลดข้อมูลอ่อนไหว; credential rotation/revocation ต้องมีขั้นตอนก่อน production
- AI เป็น optional processor; ห้ามส่ง private source ออก vendor จนมีสิทธิ์และ policy ที่อนุมัติ; ปิด AI แล้ว core ทำงานครบ
- บันทึก backup/recovery procedure ของ canonical/source references/workflow พร้อม access controls; ทดสอบ restore ก่อน production; ห้ามล้าง Git history หรือ source จริงในงาน baseline

## Pending security decisions
Auth/identity provider, public/private repository split, role assignment, retention/deletion policy, backup location และ incident owner ยังไม่ยืนยัน ห้าม deploy ก่อน decision ที่เกี่ยวข้องปิดและ security acceptance ผ่าน

Public Git history อาจคงข้อมูลแม้ลบไฟล์ภายหลัง จึงต้องตรวจ publication payload ก่อนเขียน canonical ที่เปิดสาธารณะ

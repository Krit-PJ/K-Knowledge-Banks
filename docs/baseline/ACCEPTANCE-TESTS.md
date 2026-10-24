# Acceptance Tests

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

สถานะ 2026-10-24 (P1-WP2): AC-01 = PASS ระดับ validator (รอยืนยัน golden expected outputs); AC-02 = PASS เฉพาะ rule-level pre-check (GT-04,10) ส่วน publication pipeline = NOT RUN; AC อื่น = NOT RUN การตรวจ validator ไม่ใช่ application/vertical-slice acceptance

| ID | Scenario / pass criteria | Evidence ที่ต้องแนบ | Phase |
|---|---|---|---|
| AC-01 | Schema/vocabulary/refs ตรง lock; invalid fixture ถูก reject | validator output + GT-01..06,14,15 | 1 |
| AC-02 | ไม่มี evidence หรือ approval ตรง revision → publish blocked | negative output + GT-04,10 | 1–2 |
| AC-03 | ปิด AI แล้วยังทำ manual vertical slice ได้ครบ | run log + GT-12 | 2 |
| AC-04 | Drive source/version/locator ตามกลับได้; Sheets ไม่ overwrite canonical | trace IDs และ reconciliation evidence | 2 |
| AC-05 | source/context เปลี่ยน → dependency stale และ re-review | GT-07,10 outputs | 2 |
| AC-06 | Thai-first UI แสดง original language/translation และ ID คงเดิม | screenshots + GT-11 | 3 |
| AC-07 | Search/detail/provenance/review ใช้ canonical/read-model revision และรายงาน stale | screenshots + API responses | 3 |
| AC-08 | unauthorized reader/curator publish ไม่ได้; private source ไม่รั่ว public outputs | access matrix results และ publication payload inspection | 2–4 |
| AC-09 | concurrency conflict/idempotent retry ไม่ทำข้อมูลหรือ publish ซ้ำ | conflict/retry traces | 2 |
| AC-10 | GapCandidate/ConflictCandidate ผ่าน human review ไม่ auto-promote | GT-08,09 และ review audit | 2–3 |
| AC-11 | read models rebuild จาก canonical ได้; failure คง last-known-good | GT-13 และ recovery evidence | 3–4 |
| AC-12 | ไม่มี secrets ใน frontend/repo/read models/logs; injection ไม่ถูกรัน | scan + security negative cases | 4 |
| AC-13 | restore/recovery และสิทธิ์หลัง restore ถูกต้อง | recovery drill record | 4 |
| AC-14 | แต่ละ phase มี deliverables/test evidence/open issues และ User approval ก่อนข้าม phase | PROJECT-STATE approval ledger | ทุก phase |

## Exit rules
PASS ต้องมีผลจริงที่ตรวจซ้ำได้และตรง baseline revision; BLOCKED/NOT RUN/FAIL ต้องรายงานตามจริง ห้ามใช้ mock-only evidence อ้าง end-to-end ผ่าน ข้อผิดพลาดที่ทำให้หลักฐานสูญหาย, authority bypass, ข้อมูลรั่ว หรือ canonical ไม่สอดคล้องเป็น blocker

ผู้ใช้อนุมัติจบ phase และเริ่ม phase ถัดไปอย่างชัดเจน การยกเว้น acceptance ที่เปลี่ยน baseline ต้องผ่าน ADR + migration plan + User approval

# MVP Scope

Baseline version: **v1.0-RC1**
วันที่จัดทำ: 2026-10-23 (Asia/Bangkok)

## Included
Thai-first Multilingual; manual intake และ modeling; Study/Report/Evidence/Result/Finding/Claim/ClaimFrame/RelationAssertion; DerivationRun lineage; GapCandidate/ConflictCandidate review queue; versioned ReviewProtocol/ReviewSnapshot; deterministic validation; human-approved canonical publication; generated read models; search/detail/provenance และ review UI

Drive ใช้เก็บ raw source, Sheets จัด workflow, GitHub canonical structured knowledge v1, GitHub Pages frontend และ Secure Backend/API ที่เลือกภายหลังตาม security requirements

## Deferred / optional
AI extraction/translation/synthesis เป็น optional adapter หลัง core พิสูจน์ว่าไม่พึ่ง AI; 2D explorer เป็นงานเสริมเมื่อรักษา context ได้; 3D visualization และ advanced analytics เลื่อนหลัง MVP ห้ามใช้ visualization หรือ AI capability เป็นเหตุขยาย scope อัตโนมัติ

ยังไม่รวมการอัปโหลดข้อมูลจริงจำนวนมาก การย้ายระบบเดิม การเผยแพร่ public หรือการ deploy โดยไม่มีคำสั่งและ readiness review

## MVP complete
AC ที่เกี่ยวข้องผ่านด้วยหลักฐานจริง; AI-off slice ทำงาน; evidence/review/revision security ถูกต้อง; read models rebuild/restore ได้; unresolved blockers เป็นศูนย์ และผู้ใช้อนุมัติ Phase 4 ห้ามถือการมีเอกสารครบเป็น MVP เสร็จ

การแบ่งขอบเขต 2D/3D และ phase นี้เป็น consolidation proposal ที่ต้องตรวจยืนยันก่อนเริ่ม Phase 1 การเพิ่มหรือลด baseline scope ภายหลังใช้ ADR + migration plan + User approval

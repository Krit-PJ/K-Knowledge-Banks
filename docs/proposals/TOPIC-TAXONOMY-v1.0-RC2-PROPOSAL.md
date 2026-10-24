# Topic Taxonomy Proposal

Target baseline: **v1.0-RC2**  
Proposal date: 2026-10-23 (Asia/Bangkok)  
Status: **APPROVED — ADR-0001 ACCEPTED**  
Approval: ผู้ใช้ตอบ “อนุมัติ ADR-0001” วันที่ 2026-10-23

## Design rules

- Canonical ID เป็น stable technical identifier; label ภาษาไทย/อังกฤษเปลี่ยนได้โดยไม่เปลี่ยน identity
- Record อ้างได้หลาย leaf topics ผ่าน `topicIds`; parent topics ใช้ navigation/aggregation
- Topic assignment ไม่ใช่ Claim และไม่เพิ่มระดับความน่าเชื่อถือของเนื้อหา
- ข่าวต้องรักษา source/time coverage; trend/ranking ต้องมี DerivationRun, metric, time window และ source snapshot

## Proposed hierarchy

| Canonical topic ID | Parent | Thai label | English label |
|---|---|---|---|
| `news` | — | สรุปข่าว | News summaries |
| `news.technology-current` | `news` | เทคโนโลยีในปัจจุบัน | Current technology |
| `news.environment-disaster` | `news` | ปรากฏการณ์สิ่งแวดล้อมและภัยพิบัติ | Environmental phenomena and disasters |
| `news.major-power-movements` | `news` | ความเคลื่อนไหวของประเทศมหาอำนาจ | Major-power developments |
| `news.energy` | `news` | พลังงาน | Energy |
| `trends` | — | เทรนด์ | Trends |
| `trends.technology` | `trends` | เทรนด์เทคโนโลยี | Technology trends |
| `trends.ai` | `trends` | เทรนด์ AI | AI trends |
| `trends.github-popular-skills` | `trends` | Skill ที่ได้รับความนิยมบน GitHub | Popular skills on GitHub |

## Publication requirements

### News summaries

- ระบุ coverage window และ source set
- ทุก substantive statement อ้าง Evidence ที่ย้อนถึง SourceAsset/version/locator
- แยก Report, Finding และ Claim; headline frequency ไม่ใช่ independent evidence count
- Generated summary ต้องมี DerivationRun แม้ไม่ใช้ AI

### GitHub popularity

- ระบุคำว่า Skill ให้ชัดว่าเป็น repository/topic/ecosystem ใด
- บันทึก metric เช่น stars, forks, contributors, release/download activity หรือ growth rate พร้อมสูตร
- บันทึก observation window, collectedAt, canonical repository identifier และ source snapshot hash
- ห้ามสรุป “ได้รับความนิยม” จาก snapshot เดียวโดยไม่ระบุ metric/time window
- Ranking/summary เป็น Derived Knowledge และต้อง reproduce ได้

## Schema binding

เพิ่ม optional field ใน BaseRecord ของ `v1.0-RC2`:

```json
{
  "topicIds": ["news.technology-current", "trends.ai"]
}
```

Binding: unique array, `minItems = 1` เมื่อ field ปรากฏ และทุกค่าต้อง resolve ใน topic registry version ที่ record ระบุ

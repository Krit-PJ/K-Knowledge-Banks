# KEKB Work Packet Prompt Template

ใช้ template นี้ต่อท้าย [KEKB Master Engineering Prompt](KEKB-MASTER-ENGINEERING-PROMPT.md) สำหรับงานเฉพาะหนึ่ง packet

```text
USER_OBJECTIVE:
<สิ่งที่ต้องการให้เกิดขึ้น>

OBSERVABLE ACCEPTANCE:
<ผลที่ตรวจรับได้และหลักฐานที่ต้องมี>

SCOPE:
<included files/components/records/topics>

OUT OF SCOPE:
<สิ่งที่ห้ามขยายไปทำ>

RELEVANT BASELINE / ADR:
<document versions and accepted ADR IDs>

RELEVANT TEST IDS:
<AC-xx, GT-xx>

AUTHORIZED ACTIONS:
<read/edit/install/commit/deploy/external writes that are explicitly authorized>

PENDING DECISIONS:
<runtime/provider/API/security decisions that must not be guessed>

SPECIAL CONSTRAINTS:
<privacy, source rights, deadline, compatibility, Thai UX>

Execute one bounded Work Packet. Read live PROJECT-STATE and BASELINE first.
Before editing, report Goal / Files Likely Affected / Constraints / Acceptance Test.
After verification, report Changed / Tests / Remaining / Architecture Impact and stop.
```

## Minimal invocation example

```text
USER_OBJECTIVE: สร้าง deterministic validator สำหรับ RC1/RC2
OBSERVABLE ACCEPTANCE: valid fixtures pass, targeted invalid fixtures fail with stable safe codes
SCOPE: contracts, validator package, GT-01..17 runner
OUT OF SCOPE: backend API, authentication, Drive/Sheets integration, deployment
RELEVANT BASELINE / ADR: v1.0-RC2, ADR-0001
RELEVANT TEST IDS: AC-01, core AC-02, GT-01..17
AUTHORIZED ACTIONS: <fill from actual approval>
PENDING DECISIONS: runtime/framework/dependency selection until explicitly approved
SPECIAL CONSTRAINTS: AI-off, no secrets, RC1 compatibility
```

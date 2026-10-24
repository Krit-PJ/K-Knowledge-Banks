# KEKB Contracts

Current version: **v1.0-RC2** (RC1 retained)

Portable Phase 1 contract assets:

- `schema/kekb-record-v1.0-RC1.schema.json` — JSON Schema Draft 2020-12 for canonical record shapes
- `vocabulary/v1.0-RC1.json` — machine-readable controlled enums, participant roles and predicates
- `schema/kekb-record-v1.0-RC2.schema.json` — RC1-compatible contract extended with ADR-0001 `topicIds`
- `vocabulary/v1.0-RC2.json` — RC1 vocabulary plus approved topic taxonomy

These files implement the approved binding documents. No backend runtime, framework or validator dependency has been selected. JSON syntax and internal references can be checked without making that decision; full schema execution remains `NOT RUN` until the validator runtime is approved.

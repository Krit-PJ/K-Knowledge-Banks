# KEKB Contracts

Current version: **v1.0-RC2** (RC1 retained)

Portable Phase 1 contract assets:

- `schema/kekb-record-v1.0-RC1.schema.json` — JSON Schema Draft 2020-12 for canonical record shapes
- `vocabulary/v1.0-RC1.json` — machine-readable controlled enums, participant roles and predicates
- `schema/kekb-record-v1.0-RC2.schema.json` — RC1-compatible contract extended with ADR-0001 `topicIds`
- `vocabulary/v1.0-RC2.json` — RC1 vocabulary plus approved topic taxonomy

These files implement the approved binding documents. Validator runtime approved 2026-10-24: Node.js + Ajv 8 (see `validator/README.md`). Backend runtime/framework remain unselected. Schema execution and Phase 1 golden cases run via `npm test`.

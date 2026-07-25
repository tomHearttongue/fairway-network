# DU1 Demo Universe Data & Observability Contract

**Slice:** DU1 - Deterministic Demo Universe Foundation  
**Status:** `PENDING HUMAN REVIEW`  
**Transactional scope:** Demo-generated Fairway-owned records only  
**Analytics scope:** No production analytics emission

## Domain Events

DU1 does not introduce new production domain events. It creates deterministic demo-owned transactional records and preserves existing domain/event boundaries.

Demo reset and verification tooling reports:

- universe version
- seed
- canonical clock
- scenario
- population counts
- integrity result
- deterministic fingerprint
- reset execution ID and persisted count reconciliation
- independent conflict counts and visible-metric source facts

## Product Analytics

No product analytics vendor integration is added in DU1.

Synthetic/demo activity must remain filterable by:

- demo email namespace
- `du1:%` idempotency keys
- `FAIRWAY_DEMO_UNIVERSE` provenance in canonical performance facts
- scenario/version metadata in reset/verify reports

Demo/synthetic behavior must not be interpreted as organic member behavior.

## Primary KPI Enabled

Demo Universe Integrity Rate:

> Percentage of scenario generations whose canonical data passes deterministic integrity verification.

## Guardrail Metrics

- duplicate canonical IDs
- fewer than 209 unique display names in the 220-person population
- Demo Tom count not equal to one
- active reservation overlaps
- active-session/suite-state contradiction
- turnover task sourced from an active session
- shot outside its source session or outside the effective bag
- future-dated creation facts relative to the canonical clock
- facilities-only persona receiving golfer membership, credits, or history
- credit ledger mismatch after reset
- scenario not proving its declared constraint
- performance summary not traceable to canonical shot/session facts
- unsupported live vendor capability implied by demo data

## Stable Dimensions

Use stable Fairway/demo IDs:

- `demo_universe_version`
- `demo_seed`
- `demo_scenario`
- `location_id`
- `member_profile_id`
- `reservation_id`
- `session_id`
- `suite_id`
- `task_id`
- `source_provider`

Avoid analytics payloads containing email, guest PII, or recognizable third-party names unless explicitly needed for local review artifacts.

## Logs / Diagnosis

`pnpm demo:verify`, `pnpm demo:audit`, and `pnpm demo:reset` print bounded operational summaries and actionable validation errors. They must not print secrets, service-role keys, Clerk secrets, database passwords, or raw connection strings.

## Privacy

All DU1 people and performance facts are synthetic. The current public/deep-persona population uses original identities; the centrally replaceable recognizable-culture pool is empty in `DU1-v1`.

## Traceability

- PRD: `FR-UX-020`, `FR-UX-021`, `NFR-012`
- Source: `src/demo-universe/universe.ts`
- Reset: `scripts/demo-reset.mjs`
- Verify: `scripts/demo-verify.mjs`
- Independent audit: `scripts/demo-audit.mjs`
- Tests: `tests/domains/demo-universe.test.ts`, `tests/domains/demo-universe-remediation.test.ts`

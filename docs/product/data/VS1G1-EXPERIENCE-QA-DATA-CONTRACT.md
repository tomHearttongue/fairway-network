# VS1G.1 Experience QA Data & Observability Contract

Status: `LOCKED` for VS1G.1 harness behavior.

## Scope

VS1G.1 creates review evidence for Product Acceptance. It does not introduce new transactional product domains or a production analytics platform.

## Domain Events

No new Fairway domain events are introduced by the harness. The Golden Demo continues to exercise existing domain events from reservations, sessions, access grants, guests, and facility tasks.

## Product Analytics / Behavioral Telemetry

No analytics vendor integration is added. The harness records review metadata that can inform future analytics taxonomy, including:

- screen reviewed
- persona
- viewport
- state
- relevant PRD requirements
- relevant DLS/experience principles
- functional capability demonstrated

## Success KPI Enabled

Primary review KPI: `Product Acceptance Evidence Completeness`

A bundle is complete when it contains deterministic screenshots, screenshot manifest metadata, Playwright result summary, accessibility findings, console/network quality evidence, relevant docs, and a secret-safe source snapshot.

## Guardrail Metrics

- Accessibility violation count by severity
- Console error count
- Unexpected failed network request count
- Screenshot count
- Failed Playwright test count
- Secret-scan failures before ZIP creation

## Stable IDs / Dimensions

- `persona_key`
- `viewport`
- `screen`
- `route`
- `state`
- `prd_requirement_ids`
- `principles`
- `commit_sha`
- `branch`
- `slice`

## Logs / Traces / Errors

The harness captures browser console errors and failed network requests in JSON evidence. Playwright failure traces are retained locally when generated, but authenticated trace ZIPs are excluded from the external review bundle because they may contain session cookies or tokens.

## Privacy / Sensitive Data

The bundle must not include `.env*`, Clerk secrets, Supabase service-role keys, cookies, storage state, session tokens, production credentials, dependency caches, or production/member PII. Personae use harness-owned `fairway-ux-*@example.com` identities only.

## Traceability

PRD: `FR-UX-015`, `FR-UX-016`, `FR-UX-017`, `NFR-011`

Commands:

- `pnpm ux:qa`
- `pnpm ux:review:bundle`
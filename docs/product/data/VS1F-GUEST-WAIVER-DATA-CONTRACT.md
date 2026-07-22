# Vertical Slice 1F Data Contract

**Slice:** Guest & Waiver Foundation  
**Status:** Implemented by VS1F

## Domain Events

- `guest.invited`
- `guest.associated`
- `guest.removed`
- `guest.allowance_rejected`
- `guest.waiver_requested`
- `guest.waiver_completed`
- `guest.access_eligible`
- `guest.access_blocked`

Events are written transactionally to `domain_events` with idempotency keys. Idempotent retries must not duplicate events.

## Product KPI

Guest Readiness Rate: percentage of valid added guests who satisfy required prerequisites before the relevant session begins.

Initial funnel:

Guest added -> Waiver initiated -> Waiver completed -> Guest ready

## Guardrails

- Guest allowance violations.
- Access blocked due to missing waiver or invalid reservation/session scope.
- Duplicate guest associations.
- Duplicate waiver acceptances.
- Fake waiver adapter or evidence-generation failures.

## Required Dimensions

- `location_id`
- `reservation_id`
- `session_id` when available
- `host_member_profile_id`
- `guest_id`
- `membership_plan_id`
- `failure_reason`
- `agreement_version_id`
- `provider`

No guest email, guest name, raw waiver text, payment data, or vendor-specific user identifiers are required in event payloads.

## Operational Diagnosis

Log or surface structured errors for:

- `GUEST_ALLOWANCE_EXCEEDED`
- `RESERVATION_NOT_GUEST_ELIGIBLE`
- `RESERVATION_GUEST_NOT_FOUND`
- `WAIVER_ACCEPTANCE_REQUIRED`
- `GUEST_NOT_ACCESS_ELIGIBLE`
- Duplicate/idempotency conflicts
- Fake waiver adapter failures

## Traceability

PRD: FR-GST-001 through FR-GST-010, FR-ACC-005, FR-UX-008, NFR-008 through NFR-010, BP-012 through BP-015.

Verification: `pnpm verify:vs1f`, `tests/domains/guests.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and the full VS1B-VS1E regression stack.
# Vertical Slice 1G Data Contract

**Slice:** Fairway Experience Foundation & Golden Demo  
**Status:** Implemented by VS1G

## Domain Events

No new transactional domain events are required for 1G. Existing reservation, session, access, guest, facility task, audit, and domain-event records remain authoritative.

## Product Analytics Events

Recommended behavioral telemetry event names for future analytics routing:

- `member_home.viewed`
- `play_now.initiated`
- `reservation_flow.started`
- `reservation_flow.completed`
- `golfer_passport.viewed`
- `performance_club.viewed`
- `session_summary.viewed`

1G documents and preserves these names but does not integrate a paid analytics vendor. Transactional operations must not depend on telemetry delivery.

## Primary KPI Enabled

Golden Demo Completion Rate: percentage of demo attempts that successfully move through member home, Play/Book, session state, My Golf, completion, turnover task creation, Facilities service, and inventory restoration.

## Guardrails

- Demo data is clearly labeled as simulated/non-production where it represents external-provider state.
- Member-facing UI does not expose raw backend enum language as primary state.
- Product analytics payloads avoid email, names, raw waiver text, payment data, and unnecessary guest PII.
- UX changes do not break VS1B-VS1F transactional verifiers.

## Stable Dimensions

When these events are implemented, use stable Fairway IDs where available:

- `member_profile_id`
- `location_id`
- `reservation_id`
- `session_id`
- `suite_id`
- `screen`
- `booking_mode`
- `demo_profile_id`
- `club_code`
- `failure_reason`

## Operational Diagnosis

1G should preserve readable client-facing error recovery and server/API errors needed to diagnose:

- Reservation unavailable.
- Credit or eligibility rejection.
- Session start/completion failure.
- Demo profile unavailable.
- Facilities verifier failure.

## Privacy

Demo performance data is canonical fixture data, not imported live vendor data. Official-golf values are simulated and must not imply GHIN/WHS authorization or sync.

## Traceability

PRD: FR-UX-009 through FR-UX-014, FR-CMP-010 through FR-CMP-012, PP-UX-001, PP-DATA-001, NFR-008 through NFR-010.

Verification: `pnpm verify:vs1g`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and VS1B-VS1F runtime regressions.
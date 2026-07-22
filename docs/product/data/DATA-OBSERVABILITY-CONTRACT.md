# Fairway Data & Observability Contract

**Status:** Standing product-development contract  
**Effective slice:** Vertical Slice 1F  
**Scope:** Lightweight slice-level data, analytics, and observability discipline

Every meaningful vertical slice must identify and document:

1. Domain events created.
2. Product analytics events or behavioral telemetry required.
3. Primary success KPI(s) enabled.
4. Guardrail metrics.
5. Required dimensions and stable IDs.
6. Logs, traces, and errors required for operational diagnosis.
7. Sensitive-data and privacy considerations.
8. PRD requirement and test traceability.

## Boundaries

Transactional/domain truth is recorded in Fairway-owned Postgres tables and auditable domain records.

Product analytics is behavioral telemetry derived from domain events or explicit user actions. Product analytics must use stable Fairway IDs where possible and must not include unnecessary PII.

Technical observability is logs, traces, and errors used to diagnose failures and operational health. Observability outages must not block core Fairway transactions.

## Event Naming

Use stable `domain.object.action` names. Do not create synonymous names for the same business event.

Examples:

- `guest.invited`
- `guest.associated`
- `guest.waiver_requested`
- `guest.waiver_completed`
- `guest.access_eligible`
- `guest.access_blocked`

## Stable Dimensions

Prefer:

- `location_id`
- `reservation_id`
- `session_id`
- `host_member_profile_id`
- `guest_id`
- `membership_plan_id`
- `failure_reason`
- `provider`

Avoid email, display name, phone, raw waiver text, payment details, and unnecessary guest PII.

## Vendor Independence

The event records introduced for MVP are not an analytics platform. They preserve event discipline and future routing to tools such as PostHog/Pendo-class product analytics, OpenTelemetry/New Relic-class observability, and warehouse/BI systems without coupling core domain logic to those vendors.
# Fairway Network Product Requirements Document

**Status:** Canonical living PRD  
**Established:** 2026-07-21  
**Product scope:** Fairway Network member, facility, reservation, access, credits, and future competition platform  
**Technical authority:** Architecture docs and ADRs remain authoritative for implementation design. This PRD is authoritative for product behavior, policy status, product rationale, configuration scope, and unresolved product decisions.

## 1. Product Vision And Positioning

Fairway Network is a software-enabled golf practice and competition network delivered through premium private Practice Suites. It happens to own physical locations; the durable product is the network, identity, membership, competition layer, and operating system for golf practice.

The first location is both a real operating club and the proving ground for a repeatable multi-location platform.

Core positioning:

- Private golf practice club.
- Software-enabled membership network.
- Persistent golfer identity and Golfer Passport.
- Private Practice Suites with self-service access.
- Competition-led engagement.
- Practice. Compete. Improve.
- Golf when you want to golf.

Broadmoor/Mission may be a reference or build-like location candidate only. The product and business model must not depend on that specific site.

## 2. Product Principles

| ID | Requirement / Principle | Status | Scope | Notes / Traceability |
|---|---|---|---|---|
| PP-001 | Fairway is a software-enabled golf practice and competition network that happens to own physical locations. | LOCKED | network | Source: locked context. |
| PP-002 | Fairway is not primarily a simulator-rental business. | LOCKED | network | Product thesis. |
| PP-003 | Practice. Compete. Improve. | LOCKED | network | Product language. |
| PP-004 | Competition drives engagement; improvement is the outcome. | LOCKED | network | Source: locked context. |
| PP-005 | Golf when you want to golf. The experience should be easier than deciding to visit a traditional driving range. | LOCKED | network | Drives Play Now and availability UX. |
| PP-006 | Availability is more important than maximizing theoretical utilization. | LOCKED | location | Informs suite count, booking rules, buffers, holds, and Play Now. |
| PP-007 | Buy the commodity; build the differentiator. | LOCKED | network | Buy auth, billing, access hardware, messaging, waivers, analytics, monitoring, workflows. Build identity, credits, reservations, Play Now, competition, operator workflows. |
| PP-008 | One golfer should have one persistent network identity. | LOCKED | network | Implemented as Person + MemberProfile in VS1B. |
| PP-009 | MemberProfile / Golfer Passport are network-level concepts, not vendor accounts. | LOCKED | network | Clerk authenticates; Fairway owns identity. |
| PP-010 | New locations are configured, not custom-coded. | LOCKED | network/location | Location #1 seed values are configuration, not global constants. |
| PP-011 | Inventory and operational policies may be location-specific. | LOCKED | location | Suite state and buffers are location-sensitive. |
| PP-012 | Undefined business rules must be reported rather than silently invented. | LOCKED | network | Standing product-development rule. |
| PP-UX-001 | Digital experience is a core Fairway product, not an administrative layer. | LOCKED | network | Member software must feel premium, intuitive, fast, and thoughtfully designed. Functional acceptance alone does not equal product acceptance. |
| PP-UX-002 | Member-facing UX is mobile-first, low-friction, visually intentional, accessible, and distinct from generic SaaS dashboards. | LOCKED | product type | Applies incrementally per slice; does not require premature full design system. |
| PP-UX-003 | Operator UX is intentionally designed for operational clarity, fast situational awareness, safe destructive actions, and minimal navigation friction. | LOCKED | product type | Implemented VS1D. |

## 3. Personas / Actors

| Actor | Description | Status |
|---|---|---|
| Member | Paying or test member with a Fairway MemberProfile, membership entitlement, credits, reservations, sessions, and future Golfer Passport history. | LOCKED |
| Guest | Session-associated non-member invited by a host member. Requires identity, waiver, allowance/payment, and time-scoped access. | DEFERRED |
| Facilities / Cleaning | Restricted location-scoped actor focused on suite readiness, turnover, cleaning, inspection flagging, and cleaning-relevant facility context. Distinct from full operator. | LOCKED |
| Operator / General Manager | Authorized facility operator responsible for suite state, exceptions, member support, and governed overrides. | LOCKED |
| Instructor | Future provider of instruction and possibly instructor bookings. | DEFERRED |
| System | Fairway automation that assigns suites, calculates availability, manages credits, creates access grants, and records audit events. | LOCKED |
| Vendor Provider | Clerk, Stripe, Kisi, Supabase, simulator software, waiver, messaging, analytics, or monitoring vendor behind Fairway-owned boundaries. | LOCKED |

## 4. Core Product Domain Concepts

| Concept | Definition | Status |
|---|---|---|
| AuthPrincipal | Authentication-provider identity used to access Fairway. Not durable business identity. | LOCKED |
| Person | Human identity record associated with one or more auth principals. | LOCKED |
| MemberProfile / Golfer Passport | Durable Fairway network identity for membership, credits, reservations, sessions, competition, achievements, and history. | LOCKED |
| Membership | Fairway interpretation of plan entitlements and status. Stripe does not own this concept. | LOCKED |
| Credit Ledger | Append-only auditable ledger for grants, holds, commits, releases, refunds, expirations, and adjustments. | LOCKED |
| Location | Configured facility with timezone, suite inventory, access windows, booking policies, and operational settings. | LOCKED |
| Practice Suite | Private practice inventory unit. Product language should prefer Practice Suite over bay. | LOCKED |
| Suite Operational State | Facility state of a suite such as available, maintenance, turnover, or administrative hold. Distinct from reservation/session/access state. | LOCKED |
| Facility Task | Durable suite-level or common-area service task for turnover, cleaning, inspection, or issue review. MVP implements suite-level turnover and inspection tasks first. | LOCKED |
| Servicing Activity | Temporary claimed/in-progress work on a facility task. Distinct from suite state and reservation state. | LOCKED |
| Reservation | Canonical Fairway booking record. Play Now is a booking mode, not a separate core model unless later justified. | LOCKED |
| Session | Actual facility/practice usage associated with a reservation. Distinct from reservation lifecycle. | LOCKED |
| AccessGrant | Fairway-owned authorization record for time-bound physical access. Access vendor executes; Fairway decides eligibility. | LOCKED |
| AuditEvent | Attributable record of meaningful state changes, overrides, and sensitive actions. | LOCKED |
| Competition | Fairway-owned engagement engine for events, challenges, rankings, streaks, achievements, and future Golfer Passport visibility. | DEFERRED |

## 5. Functional Requirements By Domain

### Membership / Identity

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-MEM-001 | Clerk authentication maps to Fairway-owned Person and MemberProfile records. | LOCKED | network | Implemented VS1B. Verified by `pnpm verify:vs1b`, `pnpm verify:vs1c`. |
| FR-MEM-002 | Bootstrap must be idempotent and create exactly one Person and MemberProfile per authenticated test user/location. | LOCKED | network/location | Implemented VS1B. Tests: `tests/domains/member-flow.integration.test.ts`; verifiers VS1B/VS1C. |
| FR-MEM-003 | TEST_BIRDIE membership exists for development with 24 monthly credits, 7-day booking window, max 2 active future reservations, Play Now enabled, 1 guest allowance. | PROVISIONAL | membership plan | Development seed only; not final commercial plan. |
| FR-MEM-004 | Development-only 100-credit grant may be used to exercise flows without production billing. | PROVISIONAL | environment/member | Implemented VS1B. Must not be production billing behavior. |
| FR-MEM-005 | Operator authorization must be enforced server-side through Fairway role/authorization boundaries. | LOCKED | location | Implemented VS1D. |
| FR-MEM-006 | Facilities/Cleaning authorization must be a restricted location-scoped role distinct from full operator. | LOCKED | location | Implemented VS1E. |

### Credits

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-CRD-001 | Credits use append-only ledger entries; balances are derived, not stored as a mutable-only field. | LOCKED | network | Implemented VS1A-1C. Tests: `tests/domains/credits.test.ts`, reservation tests. |
| FR-CRD-002 | Reservation credit operations must be idempotent, auditable, concurrency-safe, and reconstructable. | LOCKED | reservation/member | Implemented for create/cancel in VS1B/1C. |
| FR-CRD-003 | Valid cancellation preserves hold/commit history and uses compensating entries to restore credits exactly once. | LOCKED | reservation | Implemented VS1C. Tests and `pnpm verify:vs1c`. |
| FR-CRD-004 | Operator cancellation credit compensation follows the current development policy only until commercial cancellation economics are decided. | PROVISIONAL | reservation/location | Implemented VS1D. |

### Reservations

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-RES-001 | Fairway owns canonical reservations; calendars, access vendors, and simulator systems are not reservation authority. | LOCKED | network | Implemented with Supabase/Postgres reservation records. |
| FR-RES-002 | Reservation supports booking modes `ADVANCE`, `PLAY_NOW`, `OPERATOR`, `INSTRUCTOR`. | LOCKED | reservation | Implemented schema; only ADVANCE and PLAY_NOW active in member flow. |
| FR-RES-003 | Play Now is modeled as reservation acquisition mode with usage represented separately as Session. | LOCKED | reservation/session | Implemented VS1B. |
| FR-RES-004 | Play Now must preserve minimum duration, future reservations, turnover, eligibility, credits, and concurrency. | LOCKED | location/reservation | Implemented VS1B. Tests and verifiers. |
| FR-RES-005 | Member cancellation before reservation start is allowed under development policy. | PROVISIONAL | reservation | Implemented VS1C. Final commercial policy unresolved. |
| FR-RES-006 | Repeated or concurrent cancellation must produce one effective cancellation/refund. | LOCKED | reservation | Implemented VS1C. |
| FR-RES-007 | Reservation status transitions must be centralized and not arbitrary mutations. | LOCKED | reservation | Implemented VS1C in domain and DB functions. |
| FR-RES-008 | Operator cancellation/override must require authorization, actor identity, reason, audit, and compensating actions. | LOCKED | location/reservation | Implemented VS1D. |

### Access

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-ACC-001 | Membership alone never grants unrestricted building access. | LOCKED | network/location | Implemented as simulated access grants tied to reservations. |
| FR-ACC-002 | Access grants are created only after reservation persistence succeeds. | LOCKED | reservation/access | Implemented VS1B. |
| FR-ACC-003 | Cancelled reservations must not produce a valid unlock result; associated access is revoked/invalidated while history is preserved. | LOCKED | reservation/access | Implemented VS1C. |
| FR-ACC-004 | Real Kisi integration remains deferred behind an AccessProvider adapter until commercial validation. | DEFERRED | vendor/location | Fake adapter only. |

### Facility Operations

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-FAC-001 | Operator can view current facility and suite state for an authorized location. | LOCKED | location | Implemented VS1D. |
| FR-FAC-002 | Suite operational states include available, occupied, turnover, inspection_required, maintenance, out_of_service, administrative_hold where needed. | LOCKED | suite/location | Enum exists since VS1A; operator control implemented VS1D. |
| FR-FAC-003 | Suite operational state is separate from reservation state, session state, and access grant state. | LOCKED | suite/reservation/session/access | Implemented VS1D. |
| FR-FAC-004 | Suites that are not operationally eligible must be excluded from Advance and Play Now assignment. | LOCKED | suite/location | Implemented and verified by VS1D availability tests and runtime verifier. |
| FR-FAC-005 | Returning a suite to available makes it eligible again without disrupting protected future reservations. | LOCKED | suite/location | Implemented VS1D. |
| FR-FAC-006 | Operator suite-state changes require reason, actor, previous state, new state, timestamp, idempotency context, and audit. | LOCKED | suite/location | Implemented VS1D. |
| FR-FAC-007 | Cleaning should be managed at the suite/task level rather than by unnecessarily closing the entire facility. | LOCKED | suite/location | Implemented VS1E. |
| FR-FAC-008 | Facilities users receive reservation-aware priorities showing what can be serviced without disrupting golfers. | LOCKED | location/suite | Implemented VS1E; deterministic prioritization. |
| FR-FAC-009 | Cleaning and turnover workflows must support maximum safe inventory availability. | LOCKED | location/suite | Implemented VS1E. |
| FR-FAC-010 | Future demand-aware cleaning optimization is deferred; MVP uses deterministic reservation-aware prioritization. | DEFERRED | location | No AI/ML route optimization in MVP. |
| FR-FAC-011 | Session completion creates at most one required turnover/readiness task and does not duplicate transitions on retry. | LOCKED | session/reservation/suite | Implemented VS1E. |
| FR-FAC-012 | Facilities users can claim, start, complete, and flag suite-level service work while seeing only privacy-limited operational context. | LOCKED | product type/location | Implemented VS1E. |

### Instructor Ecosystem

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-PRO-001 | Instructor bookings may use dedicated booking mode and operator policies later. | DEFERRED | product type/location | Out of scope through VS1D. |

### Competition / Golfer Passport

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-CMP-001 | Competition is core product IP and must support multiple paths to success. | LOCKED | network/event | Deferred implementation. |
| FR-CMP-002 | Play the Tour Stop is a future flagship concept, but course rights, licensing, trademark usage, APIs, and affiliation are unverified. | UNRESOLVED | event/vendor/legal | Do not imply PGA TOUR affiliation. |
| FR-CMP-003 | Improvement Score is deferred; preserve useful facts without launching a formula prematurely. | DEFERRED | network/member | Source: locked context. |
| FR-CMP-004 | Who Needs a Fourth supports member-created real-world golf postings seeking 1-3 players, browse/discover, express/withdraw interest, host acceptance, privacy-safe identity, and Arrival Zone eligibility. | LOCKED | network/member | Deferred implementation; not in VS1E. |
| FR-CMP-005 | Who Needs a Fourth MVP excludes tee-time booking, payments, group chat, course APIs, and complex matchmaking. | LOCKED | network/member | Deferred implementation. |
| FR-CMP-006 | Golfer Passport supports official-handicap identity; GHIN/WHS is the initial U.S. target, subject to authorized vendor path. | LOCKED | jurisdiction/member/vendor | Real integration deferred. |
| FR-CMP-007 | Self-reported or manually verified handicap values must retain explicit provenance and verification status. | LOCKED | member | Deferred implementation. |
| FR-CMP-008 | Fairway first-party performance profile preserves authorized Uneekor-derived shot/session data through a Fairway-owned canonical model. | LOCKED | member/session/vendor | Real ingestion deferred pending API/data-rights validation. |
| FR-CMP-009 | Performance profile must distinguish raw source data from Fairway-derived metrics and avoid speculative AI coaching or unvalidated Improvement Score. | LOCKED | member/session | Deferred implementation. |

### UX

| ID | Requirement | Status | Scope | Implementation / Tests |
|---|---|---|---|---|
| FR-UX-001 | Member UI supports sign in, credits, availability, reserve, Play Now, access grant display, session start, upcoming/history, and cancel. | LOCKED | product type/member | Implemented VS1B/VS1C. |
| FR-UX-002 | Operator UI provides rapid situational awareness without becoming a generic admin dashboard. | LOCKED | product type/operator | Implemented VS1D. |
| FR-UX-003 | Destructive actions require clear context, confirmation, error feedback, and success feedback. | LOCKED | product type | Implemented VS1D. |
| FR-UX-004 | Loading, empty, error, disabled, accessibility, and responsive behavior are product acceptance concerns. | LOCKED | product type | Applies incrementally. |
| FR-UX-005 | Cleaning Mode must answer: what should I service now without disrupting golfers? | LOCKED | product type/facilities | Implemented VS1E. |
| FR-UX-006 | Arrival Zone display is a network-connected Fairway product surface for future community, competition, event, achievement, and operational content. | LOCKED | product type/location | Display app deferred. |
| FR-UX-007 | Arrival Zone public content must use privacy-safe identities/data and must not become a manually maintained slideshow dependency. | LOCKED | product type/location | Display app deferred. |

## 6. Business Policies And Rules

| ID | Policy | Status | Scope | Notes |
|---|---|---|---|---|
| BP-001 | Location #1 seed config: 12 suites, America/Chicago, 30-minute minimum, 15-minute booking increment, 15-minute turnover, +/-15-minute access window, Play Now enabled. | CONFIGURABLE | location | Implemented as seed/config values. |
| BP-002 | TEST_BIRDIE development plan grants 24 monthly credits, 7-day booking window, max 2 active future reservations, Play Now enabled, 1 guest allowance. | PROVISIONAL | membership plan | Dev/test only. |
| BP-003 | Development-only 100-credit grant is allowed for non-production workflow exercise. | PROVISIONAL | environment/member | Must not become production billing. |
| BP-004 | Member cancellation before start time is allowed and refunds committed reservation credits via compensating ledger entry. | PROVISIONAL | reservation | Development policy only; commercial cutoffs/fees unresolved. |
| BP-005 | Operator future-reservation cancellation uses the same development credit compensation until final cancellation economics are decided. | PROVISIONAL | reservation/location | Implemented VS1D. |
| BP-006 | Cancellation after a session starts is rejected for member self-service. Operator started-session cancellation/credit treatment is unresolved. | UNRESOLVED | reservation/session | Do not invent no-show or active-session economics. |
| BP-007 | No-show definition, grace period, credit forfeiture, repeat-offender policy, and automatic enforcement are unresolved. | UNRESOLVED | reservation/member | Not implemented. |
| BP-008 | Shared static building codes are prohibited. | LOCKED | location/access | Source: locked context. |
| BP-009 | Operator overrides require actor, reason, timestamp, previous/new state where relevant, and audit. | LOCKED | operator/location | Implemented VS1D. |
| BP-010 | A cleaning task being due does not always mean the suite must immediately become unavailable for every future booking. | LOCKED | suite/location | Implemented VS1E. |
| BP-011 | MVP cleaning priority is deterministic and reservation-aware: urgent turnover/inspection before upcoming reservations, shortest safe service window, overdue required work, then long-vacancy lower-priority work. | LOCKED | location/suite | Implemented VS1E. |

## 7. Configuration And Policy Scope

Location-scoped configuration:

- Suite count.
- Timezone.
- Minimum session minutes.
- Booking increment minutes.
- Turnover buffer minutes.
- Access before/after minutes.
- Play Now enabled.
- Suite operational state and facility holds.
- Facility task priority and due timestamps.
- Facilities role assignments.

Membership-plan-scoped configuration:

- Monthly credits.
- Booking window.
- Active future reservation limit.
- Play Now eligibility.
- Guest allowance.

Reservation-scoped configuration/behavior:

- Booking mode.
- Start/end time.
- Assigned suite.
- Credit commitment.
- Access grant timing.
- Cancellation eligibility.

Network-scoped locked principles:

- MemberProfile/Golfer Passport identity ownership.
- Buy-vs-build boundary.
- Vendor adapter ownership.
- Append-only ledger requirement.
- Fairway-owned reservation authority.

Unresolved commercial policies must not be implemented as permanent behavior without PRD update and founder decision.

## 8. Non-Functional Requirements

| ID | Requirement | Status | Scope | Traceability |
|---|---|---|---|---|
| NFR-001 | Sensitive operations are server-side and must not expose service-role or secret keys to browser code. | LOCKED | security | Implemented VS1B+. |
| NFR-002 | Credit and reservation mutations must be idempotent. | LOCKED | reliability | Tests and verifiers. |
| NFR-003 | Last-suite and cancellation race conditions must be transactionally safe. | LOCKED | reliability | Tests VS1B/1C; suite mutations verified by VS1D runtime verifier. |
| NFR-004 | Every sensitive operator override must be auditable. | LOCKED | security/audit | Implemented VS1D. |
| NFR-005 | Location isolation must be preserved from the first implementation even with one location. | LOCKED | multi-location | Implemented by location_id boundaries. |
| NFR-006 | Vendor-specific IDs and failures remain at integration boundaries where practical. | LOCKED | architecture | Fake adapters through VS1D. |
| NFR-007 | Product remains operable by a solo founder; avoid premature microservices and enterprise complexity. | LOCKED | delivery | Current modular monolith. |

## 9. Product State And Lifecycle Definitions

Reservation states currently implemented:

- `held`: inventory/credit hold state reserved for future workflows.
- `confirmed`: active reservation eligible for access/session according to policy.
- `checked_in`: reservation has a started Practice Suite session.
- `completed`: terminal reservation state for future completion workflow.
- `cancelled`: terminal reservation state for cancelled reservation.

Current valid transition model:

- `held -> confirmed | cancelled`
- `confirmed -> checked_in | cancelled | completed`
- `checked_in -> completed`
- `cancelled` terminal
- `completed` terminal

Suite operational states:

- `available`: eligible for assignment subject to reservation conflicts and policy.
- `occupied`: suite is physically in use; distinct from reservation/session state.
- `turnover`: suite is between uses and not bookable.
- `inspection_required`: suite requires review before use.
- `maintenance`: suite is temporarily unavailable for maintenance.
- `out_of_service`: suite is unavailable until restored.
- `administrative_hold`: operator/network hold blocks booking for non-maintenance reasons.

Access grant states currently implemented:

- `active`: grant exists and may be usable if inside access window and reservation remains eligible.
- `revoked`: grant was invalidated, commonly because reservation was cancelled.
- `expired`: grant is no longer usable after its configured window.

Session states currently implicit:

- No session row: facility usage has not started.
- Started session row: session has begun.
- Ended session row: session has explicitly completed. Implemented by VS1E.

Facility task states:

- `open`: task is available to claim.
- `claimed`: facilities actor has accepted responsibility.
- `in_progress`: service work has started.
- `completed`: work is finished and readiness may be restored if no other blocking suite state exists.
- `cancelled`: task was voided by an authorized workflow.

MVP task types:

- `turnover`: post-session suite readiness work.
- `inspection`: issue/damage/readiness review.

Temporary compromise: VS1E stores `turnover` directly on `suites.status` as an operational readiness state and projects `occupied` from active Session/Reservation records, while preserving separate Session, Reservation, AccessGrant, and FacilityTask records. A future readiness projection model may derive more suite states when operational complexity justifies it.

Do not conflate reservation completion, session completion, physical departure, access expiration, suite turnover, or inspection outcome.

## 10. Product Decisions And Open Questions

Locked decisions:

- Web/PWA first.
- Clerk and Supabase development projects are approved.
- Stripe, Kisi, simulator, notifications, waivers remain fake/deferred through VS1E.
- MemberProfile is durable business identity.
- Credits and reservations are Fairway-owned differentiators.
- Play Now is core, not an edge case.
- Operator overrides must be governed and audited.
- Cleaning Mode MVP is locked as suite/task-level, reservation-aware, restricted Facilities workflow.
- Who Needs a Fourth, Arrival Zone display, official handicap identity, and first-party performance profile are locked MVP product directions but deferred for implementation beyond VS1E.

Open questions / unresolved:

- Final commercial cancellation cutoff, fees, refunds, and forfeiture rules.
- No-show definition, grace period, penalties, and automation.
- Started-session operator cancellation/refund treatment.
- Facility turnover automation and inspection workflow detail.
- Final staff roles, MFA policy, and role-management UX.
- Waiver vendor and legal evidence model.
- Kisi commercial/API capabilities and fallback credential design.
- Stripe product/pricing and webhook entitlement projection.
- Simulator data rights and session ingestion capabilities.
- Competition event rules, rights, course availability, scoring validation, and official result semantics.

## 11. Requirement-To-Implementation/Test Traceability

| Slice / Artifact | Requirements Covered | Tests / Verifiers |
|---|---|---|
| VS1A domain foundation | PP-007, FR-CRD-001, FR-RES-001, FR-RES-004, BP-001 | `tests/domains/credits.test.ts`, `tests/domains/reservations.test.ts` |
| VS1B authenticated persistent member flow | FR-MEM-001, FR-MEM-002, FR-MEM-003, FR-MEM-004, FR-CRD-002, FR-RES-002, FR-RES-003, FR-ACC-001, FR-ACC-002, FR-UX-001 | `pnpm verify:vs1b`, `pnpm test`, `pnpm typecheck`, `pnpm build` |
| VS1C reservation lifecycle | FR-CRD-003, FR-RES-005, FR-RES-006, FR-RES-007, FR-ACC-003, BP-004, BP-006 | `pnpm verify:vs1c`, `tests/domains/reservations.test.ts` |
| VS1D operator & facility controls | FR-MEM-005, FR-FAC-001 through FR-FAC-006, FR-RES-008, FR-CRD-004, BP-005, BP-009, FR-UX-002, FR-UX-003 | `pnpm verify:vs1d`, `tests/domains/facility.test.ts`, full regression stack. |
| VS1E completion, turnover, cleaning, and readiness | FR-MEM-006, FR-FAC-007 through FR-FAC-012, FR-UX-005, BP-010, BP-011 | `pnpm verify:vs1e`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and VS1B-VS1D runtime regressions. |

Every future vertical slice must update this traceability table before completion.

## 12. Explicit Deferred / Out-Of-Scope Capabilities

Deferred through VS1E:

- Real Stripe billing, customer portal, payment collection, and webhook entitlement projection.
- Real Kisi integration, physical unlock, real PIN lifecycle, or access SDK.
- Real Uneekor/GSPro or simulator data ingestion.
- Who Needs a Fourth implementation.
- Arrival Zone display application.
- GHIN/WHS integration or official handicap vendor integration.
- Uneekor-derived first-party performance profile implementation.
- Resend/Twilio production notifications.
- Waiver execution and guest waiver evidence.
- Guest access workflows.
- Waitlists and autonomous offers.
- Competition engine, leagues, leaderboards, challenges, rankings, streaks, achievements.
- Play the Tour Stop implementation or any implied PGA TOUR affiliation.
- Instructor marketplace, instructor payments, or instructor scheduling UX.
- Native iOS/Android.
- AI coaching or Improvement Score formula.
- Enterprise admin suite or complete design system.

## Standing Product-Development Rule

Every vertical slice must:

1. Identify PRD requirements it implements.
2. Identify newly discovered product requirements or business-policy decisions.
3. Report unresolved ambiguities instead of inventing behavior.
4. Update PRD status and implementation/test traceability when complete.
5. Preserve configuration scope correctly.
6. Treat member-facing and operator-facing UX acceptance separately from mere functional correctness.
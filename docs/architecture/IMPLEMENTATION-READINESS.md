# Fairway Network Implementation Readiness

**Status:** Architecture and repository readiness assessment  
**Assessment date:** 2026-07-20  
**Scope:** Local folder inspection and source-of-truth review before application implementation

## 1. Executive Assessment

Fairway Network has strong product and architectural direction, and the confirmed local folder has now been initialized as a Git repository connected to the intended GitHub remote. It is still not yet application-ready because it contains no source code, schemas, migrations, package manifests, CI configuration, or environment examples.

What I know:

- The confirmed local path exists: `C:\Users\TheMachine\Documents\Fairway-Network`.
- The folder currently contains only the three starter Markdown files plus this readiness document.
- The folder is initialized as a local Git repository on branch `main`.
- `origin` is set to `https://github.com/tomHearttongue/fairway-network.git`.
- A read-only remote branch check returned no branch heads, so the GitHub repository appears empty or not yet populated from this machine.
- The product direction is unusually clear for an early-stage repository: member identity, credits, reservations, Play Now, suite assignment, access orchestration, waitlists, privacy, competition, and vendor boundaries are all materially defined.

What I do not know:

- Whether any vendor capabilities have been commercially validated beyond the documented research context.
- The actual Clerk and Supabase project credentials/URLs to use for development.

Recommendation:

Treat the current folder as a connected context seed and begin implementation only after committing the current baseline or otherwise confirming the desired version-control starting point. The first build should be a minimal modular-monolith Next.js application with database-first domain boundaries, real Clerk/Supabase development projects, and fake adapters for non-core external vendors.

Overall readiness:

- Product architecture readiness: **High**
- Repository implementation readiness: **Low to moderate**
- First vertical slice readiness: **Moderate to high**

## 2. Current Architecture

Existing repository contents:

- `README.md`
- `CONTEXT-CATEGORIES-E-F.md`
- `CONTEXT-BUY-VS-BUILD-APIS.md`
- `docs/architecture/IMPLEMENTATION-READINESS.md`

Existing code:

- None found.

Existing contracts:

- Conceptual provider boundary names are documented:
  - `AuthProvider`
  - `BillingProvider`
  - `AccessProvider`
  - `NotificationProvider`
  - `WaiverProvider`
  - `SimulatorProvider`
  - `HandicapProvider`
  - `AnalyticsProvider`
- A conceptual `AccessProvider` TypeScript interface is documented in `CONTEXT-BUY-VS-BUILD-APIS.md`.
- Canonical domain events are listed in `CONTEXT-CATEGORIES-E-F.md`.

Existing ADRs:

- None found.

Existing infrastructure:

- Local Git metadata exists.
- `origin` is configured for `https://github.com/tomHearttongue/fairway-network.git`.
- No application, database, hosting, CI/CD, or environment infrastructure exists yet.

Existing documentation structure:

- The README recommends placing the two context files under `docs/context/`, but they currently live at repository root.

## 3. Locked Decisions

The following decisions are authoritative and must be preserved unless superseded by a later accepted ADR.

- Fairway Network is a software-enabled golf practice and competition network, not primarily a simulator-rental business.
- Competition drives engagement; improvement is the outcome.
- The durable business identity is `MemberProfile`, not Clerk, Stripe, Kisi, Uneekor, GSPro, or any external identity.
- Launch web-first as a mobile-responsive web app/PWA; defer native iOS and Android.
- Use a buy-the-commodity, build-the-differentiator strategy.
- Buy authentication, billing, physical access, email, SMS, waivers, analytics/flags, monitoring, durable workflows, support tooling, hosting, and managed database infrastructure.
- Build member profile, entitlement interpretation, credit ledger, availability, reservations, Play Now, suite assignment, waitlists, competition, rankings, challenges, achievements, privacy enforcement, session ingestion boundaries, and operator workflows.
- Use an append-only, auditable, idempotent, concurrency-safe credit ledger.
- Fairway owns canonical reservations; generic calendars, booking SaaS, access vendors, and simulator software must not become the reservation authority.
- Play Now is core product capability.
- Minimum walk-up duration is 30 minutes.
- Dynamic walk-up duration must respect future reservations and turnover buffers.
- Advance reservations always take priority over walk-up demand.
- Suites are system-assigned by default; operator overrides require audit fields.
- Membership alone does not grant building access.
- Access is granted only from a valid reservation or successfully created walk-up session inside a configured access window.
- Primary access UX is mobile unlock; fallback is individual, time-bound PIN or credential.
- Shared static building codes are prohibited.
- Guests require identity, host association, waiver, session association, allowance/payment handling, and session-scoped access.
- Waitlist workflows must be durable, idempotent, auditable, and mostly autonomous.
- Privacy is layered: competition-visible, friends, and private-by-default data.
- Raw shot data and detailed practice sessions are private by default.
- Improvement Score is deferred; preserve input facts without launching a formula prematurely.
- Events may drive integrations, but PostgreSQL remains authoritative.
- Use a modular monolith initially.
- Avoid microservices, Kubernetes, custom auth, custom payments, custom queue infrastructure, native apps, AI coaching, and speculative abstractions.

## 4. Contradictions

### Resolved: Local Repository Verification

The starter prompt identifies `C:\Users\TheMachine\Documents\Fairway-Network` as the local repository root and expects the Git remote to correspond to `https://github.com/tomHearttongue/fairway-network.git`.

Inspection result:

- `C:\Users\TheMachine\Documents\Fairway-Network` exists.
- The earlier environment context referenced `C:\Users\TheMachine\Documents\Fairway Network`, but the user confirmed the hyphenated path is correct.
- The folder has been initialized as a local Git repository.
- Local branch is `main`.
- `origin` points to `https://github.com/tomHearttongue/fairway-network.git`.
- `git ls-remote --heads origin` returned no branch heads, so there is no remote branch history to reconcile at this time.

Recommended resolution:

- Before implementation, make an initial baseline commit and push to `origin/main`, or explicitly approve beginning local implementation with all current files uncommitted.

### Non-Blocking: README Destination vs Current File Location

`README.md` says the context files are "repo-ready" and recommends destination `docs/context/`, but the files currently live at repository root.

Recommended resolution:

- Leave files in place until the baseline commit/push decision is resolved.
- Once the baseline is committed, either move them to `docs/context/` with a clear commit or update README to state that root-level context files are intentional.

### Non-Blocking: Phase Order vs Preferred First Slice

`CONTEXT-BUY-VS-BUILD-APIS.md` lists a phased approach where Play Now and access follow reservations. The starter prompt prefers a first vertical slice that includes sign-in, test credits, availability, reservation or Play Now, simulated access, and simulated practice session.

Recommended resolution:

- Use the preferred first vertical slice, but implement it with real Clerk/Supabase development projects and fake adapters for billing, access, simulator/session ingestion, email/SMS, and waivers.

## 5. Missing Decisions

Decisions genuinely required before implementation:

- Clerk/Supabase development configuration: real Clerk and Supabase development projects are approved; credentials and URLs still need to be supplied or created when the app scaffold is ready for environment variables.
- Waiver requirement for the first slice: fake `waiver_valid=true` is acceptable for internal testing, but real access must not launch without a selected waiver provider and evidence model.

Decisions already supplied:

- Use the existing local folder and connect it to the existing GitHub repository.
- Create a baseline commit and push the current architecture/context/readiness state to `origin/main` before application implementation.
- Use real Clerk and Supabase development projects for the first build.
- Treat Location #1 seed values as configurable location-level data, not hardcoded global rules.
- Location #1 `suite_count`: `12`.
- Location #1 `timezone`: `America/Chicago`.
- Location #1 `minimum_session_minutes`: `30`.
- Location #1 `booking_increment_minutes`: `15`.
- Location #1 `turnover_buffer_minutes`: `15`.
- Location #1 `access_before_minutes`: `15`.
- Location #1 `access_after_minutes`: `15`.
- Location #1 `play_now_enabled`: `true`.
- Play Now maximum duration must preserve the configured turnover buffer before the next reservation.
- Play Now should be modeled as a reservation acquisition mode, preferably on canonical `Reservation.booking_mode` values such as `ADVANCE`, `PLAY_NOW`, `OPERATOR`, or `INSTRUCTOR`; actual facility use should be represented separately as `Session`.
- Introduce a dedicated walk-up table only if implementation requirements justify it.
- Add a Clock/time-provider abstraction at the domain/application boundary so reservation, Play Now, access, and waitlist logic can be tested with deterministic time.
- Keep the modular monolith lean: create only the domain modules required by the vertical slice while preserving documented boundaries.

Not required before the first implementation slice:

- Final Stripe products and prices.
- Final Kisi hardware purchase.
- Final simulator integration.
- Competition scoring formulas.
- Native mobile strategy.
- Improvement Score algorithm.
- Multi-location operating model beyond preserving `location_id` in the data model.

## 6. Vendor Dependencies

### Verified

Verified from local repository contents:

- The preferred managed stack is documented as: Vercel, Supabase/PostgreSQL, Clerk, Stripe, Kisi, Inngest, Resend, Twilio, PostHog, Sentry, API-capable waiver provider, and support tooling.
- The buy-vs-build boundary is documented.
- Vendor adapters/ports are required to protect Fairway-owned domain logic.
- Founder direction is to use real Clerk and Supabase development projects for the first build.

### Unverified

These are documented recommendations but not locally verifiable from contracts, credentials, or implementation artifacts:

- Clerk development project credentials and allowed redirect origins.
- Supabase development project URL, anon key, service-role key handling, and migration target.
- Kisi API availability for the exact desired plan.
- Kisi time-bound PIN lifecycle.
- Kisi mobile web unlock pattern.
- Kisi event/webhook support for held-open, forced-entry, offline, and unlock result events.
- Kisi local installer, hardware design, SLA, and total cost.
- Uneekor/GSPro commercial APIs, export rights, authentication, licensing, rate limits, and course/session data availability.
- Waiver provider API, webhook signing, evidence export, template versioning, and retention terms.
- Stripe webhook design for Fairway-specific credit grants and membership projections.
- SMS compliance requirements and opt-out handling.

### Blocking

Blocking before real-world production operation:

- Physical access vendor validation and fail-safe operating procedures.
- Waiver provider selection and legal evidence model.
- Stripe billing configuration and webhook processing policy.
- Secret management and signed webhook verification.

Blocking before the first fake-adapter vertical slice:

- Clerk and Supabase development environment configuration.

### Non-Blocking

Non-blocking for the first fake-adapter vertical slice:

- Real Kisi integration.
- Real Stripe billing.
- Real simulator ingestion.
- Real email/SMS delivery.
- Real waiver execution.
- Native access SDKs.
- Customer support tooling.
- Final competition integrations.

## 7. Security Risks

### Critical

- Physical access controls a real 24/7 facility. Any production implementation must enforce Fairway authorization before vendor access grants or unlock attempts.
- Shared static building codes are explicitly prohibited and must never be introduced as a fallback.
- Access grants must be tied to committed reservations and their valid access windows; access must not be created before the database transaction succeeds.

### High

- Webhook endpoints for Stripe, Clerk, Kisi, waiver provider, Resend, Twilio, and Inngest will require signed verification, replay protection, idempotency, and raw payload controls.
- Staff/operator features need MFA, least privilege, audited overrides, and reason capture.
- Access-provider failures must not corrupt reservation state or falsely confirm unlock success.
- Time-sensitive access must not depend on a single notification channel.
- Tenant/location isolation must exist from the beginning even with one location.

### Medium

- Analytics and monitoring must avoid unnecessary personal, payment, or raw performance data.
- Feature flags must not be the only enforcement layer for security, billing, or physical access.
- Guest flows create privacy and physical-access exposure if waiver, identity, and session scoping are weak.
- Manual operator overrides can become a shadow system unless audit trails are mandatory.

## 8. Data Architecture Risks

### Identity

Risk:

- External IDs could accidentally become canonical identities.

Mitigation:

- Model `AuthPrincipal`, `Person`, and `MemberProfile` separately.
- Store provider IDs in mapping tables.
- Use `member_profile_id` for Fairway business history.

### Credits

Risk:

- A simple mutable balance would lose auditability and fail under retries/concurrency.

Mitigation:

- Use an append-only ledger with grants, holds, commits, releases, refunds, expirations, and adjustments.
- Require idempotency keys and transaction-level consistency.
- Derive balances from ledger entries or a strongly controlled projection.

### Reservations

Risk:

- Double booking or walk-up overlap can occur without database constraints and transactional locks.

Mitigation:

- Use PostgreSQL transactions, exclusion constraints or equivalent conflict checks, suite locks, idempotency records, and concurrency tests.
- Treat Play Now as a first-class reservation/session path, not an afterthought.
- Store Location #1 seed values as location-level configuration, not process-global constants.

### Access

Risk:

- Access grants can drift from reservation state, especially across retries and vendor failures.

Mitigation:

- Store Fairway-owned `access_grant` records.
- Create grants only after reservation/session commit.
- Use configurable location-level access windows: Location #1 starts 15 minutes before and expires 15 minutes after the reservation/session.
- Use asynchronous orchestration with reconciliation and explicit failure states.

### Competition

Risk:

- Competition results can become unreproducible if rules, course mappings, or submission constraints are not versioned.

Mitigation:

- Version competition configurations.
- Link scores to member profiles, event rules, divisions/flights, and submission provenance.
- Preserve raw imports separately from normalized score records.

### Privacy

Risk:

- Detailed practice data may leak into social or analytics surfaces.

Mitigation:

- Encode privacy classification at the data-model and query-service boundary.
- Keep competition-required data separate from private practice telemetry.

## 9. Recommended Repository Structure

Preserve the existing context files until the baseline commit/push decision is resolved. After that, use a small modular-monolith structure:

```text
/
  README.md
  docs/
    context/
    architecture/
    decisions/
    security/
    data/
    product/
  src/
    app/
      (member)/
      (operator)/
      api/
    domains/
      identity/
      membership/
      credits/
      reservations/
      access/
      locations/
      sessions/
      competition/
      notifications/
      audit/
    integrations/
      auth/
      billing/
      access/
      notifications/
      waivers/
      simulator/
      analytics/
    lib/
      db/
      config/
      idempotency/
      observability/
      authorization/
  supabase/
    migrations/
    seed/
  tests/
    unit/
    integration/
    concurrency/
  .env.example
```

Guidance:

- Do not create separate services for MVP.
- Keep provider adapters outside core domain logic.
- Put database migrations under version control from the beginning.
- Add ADRs only for consequential decisions.
- Prefer vertical-slice folders inside domains over broad generic utility layers.

## 10. Recommended Implementation Sequence

1. Create a baseline commit and push to `origin/main`, or explicitly approve local implementation before the first commit.
2. Add documentation structure and first ADRs for stack, identity ownership, credit ledger, reservation authority, and access authority.
3. Scaffold a minimal Next.js + TypeScript application.
4. Configure real Clerk and Supabase development projects through environment variables and documented setup notes.
5. Add database migrations for locations, suites, people, member profiles, auth principals, memberships, credits ledger, canonical reservations with `booking_mode`, sessions, access grants, location configuration, and audit logs.
6. Add fake adapters for billing, access, simulator/session ingestion, email/SMS, and waivers.
7. Implement identity bootstrap from authenticated principal to `Person` and `MemberProfile`.
8. Implement `TEST_BIRDIE` membership seeding and the development-only 100-credit test grant through the immutable ledger.
9. Implement availability queries for Location #1 from configurable location-level values: 12 suites, `America/Chicago`, 30-minute minimum sessions, 15-minute booking increments, 15-minute turnover buffer, 15-minute access-before, 15-minute access-after, and Play Now enabled.
10. Implement advance reservation creation with credits, suite assignment, idempotency, and conflict prevention.
11. Implement Play Now as a canonical reservation acquisition mode with dynamic maximum duration, minimum duration, credit validation, suite assignment, and transaction-level concurrency safety.
12. Implement simulated access grant creation after reservation/session commit.
13. Implement a member-facing mobile-responsive flow for sign-in, availability, reserve/Play Now, access grant display, and session start.
14. Add tests for ledger behavior, reservation conflicts, Play Now duration calculation, and two-member final-suite contention.
15. Add Sentry/PostHog instrumentation only after core flow is stable enough to produce useful signals.
16. Replace fake adapters with real vendors one at a time after commercial validation.

## 11. First Vertical Slice

Recommended boundary:

> Member signs in, receives test credits, views availability, creates an advance reservation or Play Now session, receives a simulated access grant, and starts a simulated Practice Suite session.

Included:

- One seeded location.
- 12 seeded Practice Suites for Location #1.
- Location-level `timezone` set to `America/Chicago`.
- Location-level `minimum_session_minutes` set to `30`.
- Location-level `booking_increment_minutes` set to `15`.
- Location-level `turnover_buffer_minutes` set to `15`.
- Location-level `access_before_minutes` set to `15`.
- Location-level `access_after_minutes` set to `15`.
- Location-level `play_now_enabled` set to `true`.
- Member identity bootstrap with real Clerk authentication.
- Supabase/PostgreSQL-backed domain state.
- `TEST_BIRDIE` membership entitlement: 24 monthly credits, 7-day booking window, maximum 2 active future reservations, Play Now enabled, and 1 guest allowance.
- Development-only 100-credit test grant for workflow exercise.
- Append-only credit ledger with grant, hold, commit, release, and idempotency keys.
- Availability engine for advance reservation and Play Now.
- Dynamic Play Now duration calculation.
- System suite assignment.
- Canonical reservation creation inside a database transaction, with `booking_mode` distinguishing `ADVANCE`, `PLAY_NOW`, `OPERATOR`, and `INSTRUCTOR`.
- Session creation as the separate representation of actual facility usage.
- Simulated access provider adapter.
- Simulated simulator/session adapter.
- Audit log for sensitive state changes.
- Focused tests for concurrency and idempotency.

Excluded:

- Real Stripe billing.
- Real Kisi integration.
- Real Uneekor/GSPro ingestion.
- Real Resend/Twilio delivery.
- Real waiver execution.
- Production customer support tooling.
- Native mobile apps.
- Competition engine implementation beyond reserving clean boundaries.

Acceptance criteria:

- An authenticated test member maps to a Fairway-owned `MemberProfile`.
- Test credits are granted through ledger entries, not a direct mutable balance.
- Availability excludes reservations, operational holds, maintenance, turnover, and occupied suites.
- Advance reservation consumes or reserves credits exactly once.
- Play Now offers only durations that do not displace future reservations and preserve the configured location-level turnover buffer before the next reservation.
- Two simultaneous attempts for the final available suite result in exactly one success.
- Access grant is created only after reservation/session commit.
- Access grant is simulated, time-bound, attributable, and auditable.
- Session start is linked to the member profile, suite, location, and reservation or walk-up session.

## 12. Decision Requests

Founder input required now:

- Provide or approve creating real Clerk and Supabase development project configuration when the implementation scaffold is ready.

Founder input not required yet:

- Final membership pricing.
- Final Stripe product design.
- Final Kisi contract.
- Final waiver vendor.
- Final simulator integration.
- Competition scoring formulas.
- Native app timing.






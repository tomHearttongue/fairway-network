# Fairway Network — Product & Architecture Context Update

**Status:** Approved context  
**Effective date:** 2026-07-17  
**Scope:** Locked Category E and F decisions

## Purpose

This file extends the repository context with final product and architecture constraints for member identity, competition, privacy, reservations, walk-up play, access control, and autonomous operations.

## Business Thesis

Fairway Network is a software-enabled golf practice and competition network delivered through private physical clubs.

> Competition drives engagement. Improvement is the outcome.

The facility is a customer-acquisition channel, recurring-revenue business, data engine, community hub, and proving ground for the platform.

# Category E — Locked

## Member Profile Is the Primary Identity

The durable identity is the `MemberProfile`, not the authentication-provider account. Authentication is only an access mechanism.

Model separately:

- `AuthPrincipal`
- `Person`
- `MemberProfile`
- `Membership`
- `RoleAssignment`
- `LocationAffiliation`

A golfer's history must survive login changes, provider migrations, cancellation/reactivation, and movement between locations.

## Multiple Paths to Success

The platform must support meaningful competition for golfers at different ability and engagement levels:

- Gross and net champions
- Flights or divisions
- Most improved
- Handicap reduction
- Dispersion improvement
- Practice and event streaks
- Tour Grinder and participation awards
- Team, location, and rivalry winners

Every active member should be able to identify at least one credible competitive objective.

## Layered Privacy

**Competition-visible:** required scores, standings, leaderboards, public badges, event participation required by rules.

**Friends:** activity summaries, participation, high-level trends, streaks, and challenges.

**Private by default:** raw shot data, detailed sessions, club-level diagnostics, coaching notes, billing, and membership data.

> Transparency for competition. Privacy for development.

## Improvement Score Deferred

Preserve the facts needed for a future proprietary Improvement Score, but do not launch a formula before real behavioral data exists.

Potential inputs include frequency, consistency, dispersion, club-specific changes, handicap trend, personal bests, event participation, and session quality.

> Measure first. Score later.

## Data Ownership

Fairway Network owns the canonical records for:

- Member identity and membership
- Credit ledger
- Reservations and walk-up sessions
- Access grants
- Guests and waivers
- Leagues, events, scores, rankings, and challenges
- Achievements and social relationships
- Imported session references
- Vendor synchronization state

Vendors provide capabilities; they do not own the customer relationship or competition system.

## Web First

Launch as a mobile-responsive web app/PWA with deep links from email and SMS.

Defer native apps, embedded native access SDKs, AI coaching, and advanced personalization until usage justifies the operating burden.

# Category F — Locked

## Active-Session Access

Membership alone does not grant unrestricted entry.

Building access is enabled only for:

- A valid reservation inside its configured access window, or
- A successfully created immediate walk-up session

Access expires after the departure grace period.

## Walk-Up Play

An eligible member may start immediately when:

- Membership is active
- Required waivers are current
- Credits or payment are available
- A compatible suite is open
- No reservation is displaced
- No facility or suite block applies

Minimum duration: **30 minutes**.

Support configurable increments such as 30, 45, 60, 90, and longer uninterrupted periods.

> If a suite is open, an eligible member should be able to practice.

## Dynamic Maximum Duration

The system offers the longest safe session that fits before the next reservation and turnover buffer.

The UI must show the assigned suite, credit cost, maximum end time, required exit time, and whether extension is possible.

## Reservation Priority

Advance reservations always beat walk-up demand. Walk-up sessions cannot overlap, displace, or silently extend into reserved inventory.

## System-Assigned Suites

Assignment considers:

- Availability and future bookings
- Maintenance and inspection state
- Accessibility
- Equipment compatibility
- Cleaning state
- Wear rotation
- Administrative holds

Operator overrides require an audited reason.

## Hybrid Credentials

Primary: mobile web/app unlock.

Fallback: individual, time-bound PIN.

Future options: wallet credential, BLE/NFC, or guest QR/access link.

Never use shared static codes. Every unlock must be attributable.

## Controlled Guests

Guests require:

- A host member
- Identity record
- Digital waiver
- Session association
- Tier allowance or charge
- Session-scoped access

Guests receive no persistent access by default.

## Automated Waitlists

When inventory opens:

1. Select the next eligible member.
2. Create a temporary hold.
3. Send an offer.
4. Await acceptance for a configurable period.
5. Confirm atomically after eligibility and credit validation.
6. Expire and offer the next member if unanswered.

The workflow must be idempotent and require no staff action.

## Reservation Limits

Current direction:

- Birdie: 2 active future reservations
- Eagle: 3
- Tour: 4

Distinguish reservations, walk-ups, waitlist holds, instructor bookings, and administrative holds. Walk-ups must not become a hoarding loophole.

## Security

Cameras cover entrances, hallways, common areas, and appropriate equipment areas—not private practice suites.

Support entry logs, held-open and forced-entry alerts, occupancy awareness, incident review, member accountability, and remote escalation.

## Staffing

Target:

- One full-time operator/general manager
- Contract or part-time cleaning
- Contract maintenance and technical support
- Remote member support
- No permanent front desk

Critical flows need self-service resolution, remote intervention, emergency instructions, authorized override, and auditability.

## Facility Readiness

Suite states:

- `available`
- `occupied`
- `turnover`
- `inspection_required`
- `maintenance`
- `out_of_service`
- `administrative_hold`

# Required Domains

1. Identity and profiles
2. Memberships and entitlements
3. Immutable credits ledger
4. Reservations and inventory
5. Walk-up availability
6. Waitlists and offers
7. Access grants and unlock audits
8. Guests and waivers
9. Locations, suites, and equipment
10. Operations and maintenance
11. Competitions and rankings
12. Session/vendor adapters
13. Notifications
14. Privacy and consent
15. Staff administration and audit

# Canonical Walk-Up Transaction

The transaction receives member, location, current time, duration request, entitlements, credits, suite eligibility, reservations, holds, buffer, and operational state.

On success it atomically:

- Creates the session/reservation
- Assigns a suite
- Reserves or commits credits
- Creates an access grant
- Queues confirmation
- Emits an audit event

On failure it creates none of those and returns a safe, specific reason.

Concurrent attempts for the final suite must not both succeed. Use database transactions, constraints/locking, and idempotency keys.

# Canonical Events

- `member.profile.created`
- `membership.activated`
- `membership.suspended`
- `reservation.created`
- `reservation.cancelled`
- `reservation.checked_in`
- `walkup.availability.requested`
- `walkup.session.created`
- `walkup.session.denied`
- `waitlist.joined`
- `waitlist.offer.created`
- `waitlist.offer.accepted`
- `waitlist.offer.expired`
- `credits.reserved`
- `credits.committed`
- `credits.released`
- `access.grant.created`
- `access.unlock.requested`
- `access.unlock.succeeded`
- `access.unlock.failed`
- `guest.waiver.completed`
- `suite.status.changed`
- `session.started`
- `session.ended`
- `incident.created`

Events drive integrations; the transactional database remains authoritative.

# Non-Negotiable Rules

1. Door vendors do not decide membership eligibility.
2. Stripe does not replace the Fairway credit ledger.
3. Generic calendars do not become the canonical reservation engine.
4. Simulator-vendor IDs do not become member identity.
5. Access is not granted before the reservation commits.
6. Retries cannot consume credits twice.
7. Raw vendor errors are not shown to members.
8. Time-sensitive access cannot rely on one notification channel.
9. Native apps are not required for initial operation.
10. Every staff override records actor, reason, timestamp, and affected records.

# MVP Acceptance Scenarios

- Advance reservation creates valid access.
- Early entry is denied outside the configured window.
- An eligible member starts a 30-minute Play Now session.
- A future reservation constrains the maximum walk-up duration.
- Two members contend for the last suite; only one succeeds.
- Cancellation triggers the correct waitlist offer.
- An expired offer advances automatically.
- Insufficient credits produce a clear purchase/upgrade path.
- Access-provider failure does not corrupt the reservation.
- Backup PIN works when mobile unlock fails.
- Guest waiver creates only session-scoped access.
- A suite can be removed from inventory immediately.
- Operator reassignment records a reason.
- Private practice data remains private.
- Membership suspension revokes future access.

# Preferred Product Language

- Practice suite, not bay
- Start a session / Play Now
- Available until
- Member Profile or Golfer Passport
- Guest
- Club or location

> Practice whenever the urge strikes.

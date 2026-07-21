# Fairway Network — Buy-vs-Build API & Platform Context

**Status:** Recommended architecture  
**Research date:** 2026-07-17  
**Objective:** Deliver an excellent member experience with minimal implementation and operating burden for a solo founder.

# Executive Recommendation

Use a **buy-the-commodity, build-the-differentiator** architecture.

## Buy

- Authentication and account recovery
- Subscription billing and customer self-service
- Physical access control
- Transactional email
- SMS
- Waiver execution and signature evidence
- Product analytics and feature flags
- Error/performance monitoring
- Durable background workflows
- Hosting and managed database infrastructure
- Customer-support tooling

## Build

- Member Profile and Golfer Passport
- Membership entitlement interpretation
- Immutable credit ledger
- Reservation and availability engine
- Play Now/walk-up logic and dynamic duration
- Waitlist priority and offers
- Suite assignment
- Access orchestration policy
- Competition, rankings, challenges, streaks, and achievements
- Privacy-policy enforcement
- Vendor-neutral session ingestion
- Fairway-specific operator workflows

Generic appointment, gym, court, and calendar software should not own the canonical reservation model. Fairway's credit economy, dynamic walk-up sessions, tier limits, private suites, competition, and access rules are core product IP.

# Recommended Initial Stack

| Layer | Recommendation |
|---|---|
| Web application | Next.js + TypeScript |
| Hosting | Vercel |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| Authentication | Clerk |
| Billing | Stripe Billing + Checkout + Customer Portal |
| Physical access | Kisi, subject to commercial validation |
| Durable workflows | Inngest |
| Transactional email | Resend |
| SMS | Twilio Programmable Messaging |
| Product analytics/flags | PostHog |
| Error/performance monitoring | Sentry |
| Waivers | Smartwaiver or comparable API-capable provider |
| Customer support | Buy: Crisp, Help Scout, or Intercom; select by cost and mobile experience |

# Capability Decisions

| Capability | Decision | Reason |
|---|---|---|
| Authentication | Buy: Clerk | Polished sign-in, recovery, passwordless/social options, prebuilt UI |
| Member Profile | Build | Durable golfer identity must outlive auth vendor |
| Subscription billing | Buy: Stripe | Mature recurring billing, webhooks, hosted self-service |
| Credit ledger | Build | Credits are a core entitlement and audit domain |
| Reservations | Build | Unique walk-up, credits, suites, limits, and access rules |
| Door control | Buy: Kisi | Hardware, credentials, APIs/SDKs, and audit trail |
| Email | Buy: Resend | Lightweight API and delivery webhooks |
| SMS | Buy: Twilio | Reliable time-sensitive delivery and status callbacks |
| Workflows | Buy: Inngest | Timers, retries, cancellation, and observability without queue operations |
| Analytics/flags | Buy: PostHog | Funnels, events, flags, and controlled rollout |
| Monitoring | Buy: Sentry | Errors, traces, performance, and release visibility |
| Waiver signatures | Buy | Legal evidence and versioning are not worth rebuilding |
| Competition | Build | Strategic moat |
| Session ingestion | Build adapter layer | Portability and data ownership |
| Support desk | Buy | Solo-founder leverage |
| Native mobile | Defer | Avoid duplicate product and release burden |

# Authentication — Clerk

Use Clerk for authentication while maintaining independent Fairway `person` and `member_profile` records.

Use Clerk for:

- Sign-up/sign-in
- Passwordless and social login
- Session management
- Account recovery
- MFA for staff
- Authentication webhooks
- Authentication-oriented roles/claims

Do not use Clerk as:

- The canonical Member Profile
- The membership or credit ledger
- The competition identity
- The only business authorization source

Required mapping:

```text
Clerk user ID
  -> auth_principal.external_id
  -> person.id
  -> member_profile.id
```

Recommended member login order:

1. Passkey/passwordless where supported
2. Email verification code or magic link
3. Apple and Google
4. Password fallback

Require MFA for staff.

# Database — Supabase Postgres

Use managed Postgres through Supabase.

Fairway's core problems are relational and transactional:

- Suites cannot be double-booked.
- Credits must balance.
- Access must map to an eligible session.
- Results must link to participants and versioned rules.
- Overrides must be auditable.

Use:

- Transactions
- Foreign keys
- Unique/exclusion constraints
- Idempotency records
- Immutable credit entries
- Explicit authorization checks
- Versioned event configuration
- Audit logs
- Backups and migration discipline

Use Realtime selectively for:

- Live availability refresh
- Waitlist countdowns
- Operator dashboards
- Leaderboards

Realtime delivery must never be the sole proof that a business transaction completed.

# Billing — Stripe

Use Stripe Billing, Checkout, and the hosted Customer Portal.

Stripe owns:

- Payment methods
- Charges and refunds
- Subscription invoices
- Payment authentication
- Billing portal
- Financial webhook events

Fairway owns:

- Tier interpretation
- Monthly credit grants
- Credit expiration
- Booking entitlements
- Reservation limits
- Guest allowances
- Founding-member benefits
- Operational suspensions
- Product-facing membership state

Process Stripe webhooks idempotently into Fairway state.

A successful Stripe payment never directly opens a door. It updates Fairway's membership projection, after which Fairway authorization determines access.

# Physical Access — Kisi

Kisi is the recommended first vendor candidate because its current official documentation describes:

- JSON APIs for organizations, users, locks, and access rights
- Mobile applications
- Mobile SDKs
- User-attributed unlocks and audit trails
- QR codes and temporary access links
- BLE/NFC tap-to-unlock
- Offline-support concepts
- Fitness-studio integrations tied to membership and bookings

## Phase 1 Experience

- Member taps **Unlock** in the Fairway mobile web app.
- Fairway validates session, identity, time window, location, and door.
- Fairway calls the access adapter.
- The UI reports actual success/failure.
- A time-bound backup PIN or credential exists.
- Guests receive temporary links/QR credentials where supported.

## Phase 2

Consider embedded mobile SDK, wallet credential, or tap-to-unlock only after a native app is justified.

## Mandatory Validation Before Purchase

Confirm in writing:

- Which subscription includes API access
- Mobile SDK approval and partner requirements
- Time-bound PIN lifecycle
- User-attributed unlock support
- Offline behavior
- Door-held-open and forced-entry events
- Webhooks/event availability
- Rate limits
- Multi-location pricing
- Kansas City installer/hardware support
- Support SLA and escalation
- Data export and retention
- Immediate revocation
- Guest credential behavior
- Fire/life-safety responsibilities
- First-year and recurring all-in cost

Use a vendor interface:

```ts
interface AccessProvider {
  createGrant(input: CreateGrantInput): Promise<ExternalGrant>;
  revokeGrant(input: RevokeGrantInput): Promise<void>;
  unlock(input: UnlockInput): Promise<UnlockResult>;
  createGuestCredential(input: GuestCredentialInput): Promise<GuestCredential>;
  getDoorStatus(input: DoorStatusInput): Promise<DoorStatus>;
}
```

Keep Kisi-specific identifiers outside the core domain where practical.

# Durable Workflows — Inngest

Use Inngest instead of operating a custom queue/workflow engine.

Best uses:

- Waitlist offer timers
- Reservation reminders
- Access-grant creation/revocation
- Payment-failure follow-up
- Waiver reminders
- Session-end actions
- Nightly reconciliation
- Vendor sync retries
- Achievement evaluation
- League processing
- Maintenance alerts

Example:

```text
reservation.cancelled
  -> identify next eligible member
  -> create held offer
  -> send SMS/email/in-app notice
  -> wait for acceptance for 15 minutes
  -> accepted: confirm atomically
  -> timeout: expire and continue
```

Inngest coordinates work; Postgres remains the business source of truth.

# Notifications — Resend + Twilio

## Resend

Use email for:

- Welcome/onboarding
- Reservation confirmation
- Receipts and membership notices
- Waivers
- League summaries
- Non-urgent waitlist communication
- Operational notices

Consume delivery, bounce, and failure webhooks for important messages.

## Twilio

Use SMS for:

- Imminent reminders
- Short-lived waitlist offers
- Access problems
- Closures
- Urgent operational alerts

Store delivery status for critical messages.

## Channel Policy

- In-app/web is the canonical current state.
- SMS is urgent and time-sensitive.
- Email is durable and detailed.

Do not rely on email alone for a short waitlist response window.

Maintain explicit channel consent and opt-out state.

# Analytics and Feature Flags — PostHog

Track:

- `availability.viewed`
- `walkup.started`
- `walkup.denied`
- `reservation.created`
- `reservation.cancelled`
- `waitlist.joined`
- `waitlist.offer.accepted`
- `unlock.attempted`
- `unlock.failed`
- `session.completed`
- `league.joined`
- `leaderboard.viewed`
- `friend.added`
- `streak.extended`

Measure funnels such as:

1. Landing page -> intro offer purchase
2. Account -> first reservation
3. Availability -> Play Now
4. Waitlist -> accepted offer
5. First session -> second session within 14 days
6. League view -> enrollment
7. Membership start -> 90-day retention

Use feature flags for controlled rollouts, experiments, location pilots, and emergency disablement.

Never use analytics flags as the only security or billing enforcement.

# Monitoring — Sentry

Use Sentry from the first production release for:

- Browser and server errors
- API latency
- Failed reservation transactions
- Access errors
- Stripe webhook failures
- Inngest failures
- Release regressions
- Slow availability queries

Tag with safe operational identifiers such as location, suite, reservation, provider, and error category. Avoid unnecessary personal or payment data.

# Waiver Provider

Buy waiver execution and signature evidence.

Required features:

- API-created invitations/participants
- Versioned templates
- Electronic signature and timestamp
- Guardian/minor support if needed
- Signed webhooks
- Search and retrieval
- PDF/evidence export
- Retention controls
- Low-friction guest signing
- Reasonable per-signature economics

Store in Fairway:

- Provider
- External waiver ID
- Template/version
- Signer relationship
- Signed timestamp
- Expiration
- Verification state
- Evidence reference

Do not build electronic-signature evidence yourself.

# API and Adapter Rules

Do not add an enterprise API gateway for MVP.

Use:

- Next.js server endpoints
- An application-service layer
- Signed webhook endpoints
- Provider adapters
- Centralized authorization
- Idempotency middleware
- Structured logs

Each provider integration needs:

- Adapter interface
- Configuration
- Health state
- Last successful sync
- Retry policy
- Graceful degradation/circuit breaker
- Raw-event storage with sensitive-data controls

# Failure Behavior

## Clerk unavailable

Allow existing safe sessions only within policy. Do not bypass identity for new sensitive actions.

## Stripe unavailable

Do not duplicate charges. Existing prepaid entitlement may continue according to policy; queue reconciliation.

## Kisi unavailable

Show support instructions, allow authorized remote/manual override, use securely provisioned fallback only, record an incident, and never display a false unlock confirmation.

## Twilio unavailable

Fall back to email/in-app when timing permits. Keep offer state visible in-app.

## Resend unavailable

Retry asynchronously. Current in-app state remains authoritative.

## PostHog unavailable

The product continues functioning.

## Sentry unavailable

The product continues with platform logs.

# Buy-vs-Build Test

Before building a commodity capability, ask:

1. Does it directly differentiate Fairway?
2. Does it encode unique membership, golf, competition, or inventory logic?
3. Can vendor lock-in be reversed through owned data and an adapter?
4. Is the legal/security/operations burden greater than the SaaS cost?
5. Does the vendor save several weeks of founder time?
6. Can vendor failure be isolated from core operation?

# Implementation Order

## Phase 0 — Commercial Discovery

- Validate Kisi APIs, hardware, installer, and total cost
- Validate launch-monitor/simulator export rights
- Select waiver and support providers
- Validate SMS compliance
- Create a data-processing inventory

## Phase 1 — Foundation

- Next.js/Vercel
- Supabase
- Clerk
- Sentry
- PostHog
- Member Profile
- Locations/suites
- Audit log

## Phase 2 — Money and Entitlement

- Stripe
- Membership projection
- Credit ledger
- Reconciliation

## Phase 3 — Reservations

- Availability
- Advance booking
- Tier limits
- Cancellation
- Operator holds
- Concurrency tests

## Phase 4 — Play Now and Access

- Dynamic walk-up duration
- Suite assignment
- Kisi adapter
- Access grants
- Backup credential
- Incident path

## Phase 5 — Automation

- Inngest
- Resend
- Twilio
- Reminders
- Waitlists
- Expiring offers
- Revocation
- Reconciliation

## Phase 6 — Competition

- Events
- Versioned rules
- Gross/net standings
- Achievements
- Streaks
- Social layer

# Highest-Priority Vendor Questions

## Kisi

1. Which plan includes API access?
2. Can Fairway create time-bound grants and PINs by API?
3. Can unlocks be attributed to the actual member?
4. What mobile-web unlock pattern is recommended before native apps?
5. What events exist for held-open, forced-entry, offline, and unlock result?
6. What is required for Mobile SDK access?
7. Which Kansas City installer and hardware configuration is recommended?
8. What are first-year and recurring costs?
9. How are temporary guest credentials revoked?
10. What happens during internet/cloud outages?

## Stripe

1. Best structure for tiers and monthly credit grants?
2. How should founding price locks be represented?
3. Which changes should be permitted in Customer Portal?
4. Which webhook ordering/retry cases must be handled?
5. How should payment failure affect Fairway entitlement?

## Waiver Vendors

1. Is signed evidence retrievable by API?
2. How are template versions represented?
3. Are guardian/minor workflows supported?
4. Are webhooks signed?
5. What are retention/export terms?

# Research Basis

Official documentation reviewed:

- Stripe Billing, subscriptions, and Customer Portal
- Clerk authentication, UI, and Organizations
- Kisi APIs, SDKs, mobile credentials, QR/access links, and user unlock
- Supabase Postgres, Storage, Realtime, and architecture
- Inngest durable functions, events, timers, retries, and cancellation
- Resend email webhooks
- Twilio Programmable Messaging and delivery callbacks
- PostHog analytics and feature flags
- Sentry Next.js monitoring

Vendor features, API access, contracts, and pricing can change. Commercial validation is mandatory before hardware purchase or long-term commitment.

# Community Tips v1 Refinement Backlog

Status: `DISCOVERY - NOT APPROVED FOR IMPLEMENTATION`

## Epic

### Community Tips v1 — Structured Practice Knowledge

#### Problem statement

Members benefit from practical, contextual golf knowledge, but Fairway must avoid turning private practice into a noisy social feed or exposing private performance telemetry. Community Tips v1 should test whether structured, moderated, context-aware tips increase member confidence, repeat practice behavior, and engagement with Fairway’s golf identity surfaces.

#### Solution statement

Introduce a bounded Community Tips capability that allows eligible members and Fairway staff to author short, structured, moderated tips attached to safe golf/practice contexts such as club, warmup, simulator setup, session completion, or future challenge context. Tips are consumed contextually inside existing member surfaces rather than through a generic social feed.

#### Constraints

- Discovery only in this branch.
- No production implementation.
- No primary nav change in v1 without future acceptance.
- No raw telemetry exposure.
- No comments, DMs, follower graph, or arbitrary media.
- Server-authoritative visibility and moderation.
- Auditability for authorship and moderation.
- Compatible with future Competition/Compete surfaces.

#### Epic business value

- Tests a differentiated member-value hypothesis without creating a social platform.
- Connects golfer identity surfaces to practical next-session action.
- Preserves calm product hierarchy and member privacy.
- Creates owned, reusable practice knowledge for future challenges and competition.

#### Epic acceptance criteria

- Founder resolves all blocking questions in [DECISION-LOG.md](DECISION-LOG.md).
- Canonical PRD gains approved Community Tips requirements and policy statuses before implementation.
- One `community` domain owns canonical tips, revisions, contexts, visibility, moderation, usefulness, reports, and audits.
- V1 uses Home, Play, and My Golf without a fourth primary destination.
- Private telemetry is neither published nor used for v1 ranking.
- Member content follows the approved review policy.
- Moderator actions are authorized, attributable, reasoned, idempotent, and reconstructable.
- Helpful behavior is idempotent and does not create a public social scoreboard.
- A separate deterministic CT1 overlay proves behavior without changing DU1-v1.
- Future Product Acceptance covers function, privacy, moderation, accessibility, DLS/UX, fixtures, evidence, and negative cases.

#### Epic dependencies

- Founder product-policy decisions.
- Existing MemberProfile identity.
- Existing server-side authorization and audit boundaries.
- Existing Home/My Golf/session-completion experience contracts.
- A named moderation owner and feasible pilot size.
- PRD and data-contract updates in the future implementation slice.

#### Explicit exclusions

- Feed, fourth nav, comments, DMs, follows, reactions, arbitrary media, anonymous publishing.
- AI coaching, swing diagnosis, Improvement Score, or private-telemetry recommendations.
- Instructor marketplace/authority.
- Challenge or competition implementation.
- Guest community access.
- Paid promotion or author monetization.
- External community/content platform as source of truth.

## Story 1 - Define Community Tip Domain Model

**User story:** As Fairway, I need one canonical, versioned model for tips so authorship, edits, publication, and history remain trustworthy.

**Business value:** Prevents mutable content and vendor ownership from undermining trust or auditability.

**Acceptance criteria:**

- Conceptual ownership remains in one `community` domain.
- Tip identity and immutable revisions are separate.
- Publication, report, and moderation lifecycles are separate.
- Removal preserves history.
- Member authors link through `MemberProfile`.
- Concurrency and idempotency invariants are documented.

**Non-goals:** Migration design, ORM selection, service extraction, rich media.

**Dependencies:** Identity, audit, authorization; decisions `CT-OQ-012`.

**Risks:** Over-modeling; conflating report state with publication state.

**Open questions:** Exact restoration authority and published-edit behavior.

**Suggested tasks:**

- Approve entity boundaries in `DOMAIN-MODEL.md`.
- Add future PRD requirements with status and scope.
- Refine transition matrix and concurrency cases.
- Produce a migration proposal only in an approved implementation slice.

## Story 2 - Define Tip Context Taxonomy

**User story:** As an author and reader, I need stable golf/practice contexts so tips are specific without becoming a free-form tag wall.

**Business value:** Enables truthful contextual placement and later reuse in competition.

**Acceptance criteria:**

- V1 taxonomy has versioned club, practice-intent, and facility/preparation keys.
- Every publishable revision has one primary context.
- Free-form tags are excluded.
- Putting and challenge contexts remain deferred until supported.
- Network versus location scope is explicit.

**Non-goals:** Ontology platform, automatic classification, challenge implementation.

**Dependencies:** Decisions `CT-OQ-006`, `CT-OQ-011`.

**Risks:** Taxonomy too broad for quality ranking; club groups that do not match member language.

**Open questions:** Exact launch keys and specific-club-to-group mapping.

**Suggested tasks:**

- Test taxonomy labels with golfer language.
- Define stable machine keys and member labels.
- Define unknown/retired-key behavior.
- Version the taxonomy in the future data contract.

## Story 3 - Define Member And Staff Authoring Policy

**User story:** As an eligible member, I want to share one practice observation and know how it will appear and be reviewed.

**Business value:** Captures differentiated member knowledge while controlling launch risk.

**Acceptance criteria:**

- Author eligibility is server-authoritative.
- Staff curation privileges are explicit and not inherited from operator status.
- Member drafts cannot publish directly under the recommended v1 policy.
- Author sees public identity treatment before submission.
- Member edits only their own content.
- Published edits create a reviewed revision.

**Non-goals:** Anonymous tips, instructor authority, media, links, monetization.

**Dependencies:** Decisions `CT-OQ-001`, `002`, `004`, `005`, `012`.

**Risks:** Author cohort perceived as unfair; public identity deters contribution; review queue overload.

**Open questions:** Pilot invitation criteria, identity treatment, review response expectation.

**Suggested tasks:**

- Founder selects pilot policy.
- Privacy-review the author preview.
- Define author restriction/revocation behavior.
- Validate one-idea plain-text authoring prototype before production work.

## Story 4 - Define Moderation Lifecycle

**User story:** As an authorized moderator, I need state-driven review and report actions so Fairway can protect trust without rewriting history.

**Business value:** Makes community knowledge operable by a small team.

**Acceptance criteria:**

- Draft, pending review, published, hidden, removed, and archived semantics are approved.
- Report state remains separate.
- Every visibility-reducing/restoring action requires authorization and reason.
- Authors cannot view reporter identity or private report detail.
- Concurrent moderation validates the current revision/state.
- Facilities and ordinary operators receive no implied moderation privilege.

**Non-goals:** Automated takedown thresholds, appeals system, external case-management platform.

**Dependencies:** Decisions `CT-OQ-008`, `009`, `012`.

**Risks:** Unowned queue, inconsistent policy, coordinated reporting abuse.

**Open questions:** Moderator staffing, response expectation, emergency hide authority, restoration.

**Suggested tasks:**

- Approve reason-code taxonomy and prohibited-content policy.
- Define queue ownership and escalation.
- Map valid actions per lifecycle state.
- Define audit and author-facing outcome projections.

## Story 5 - Define Helpfulness Signal

**User story:** As a member, I want to indicate that a tip helped without participating in a popularity contest.

**Business value:** Supplies a low-friction quality signal for ranking and hypothesis measurement.

**Acceptance criteria:**

- V1 supports Helpful mark and withdrawal only.
- One member has at most one active signal per tip.
- Retry and concurrent requests are exactly-once effective.
- Authors cannot mark their own tip.
- Hidden/removed tips reject new marks.
- Public count behavior follows an explicit product decision.

**Non-goals:** Likes, reactions, downvotes, comments, author leaderboards.

**Dependencies:** Decision `CT-OQ-003`; canonical member identity.

**Risks:** Popularity bias, manipulation, ambiguous withdrawal meaning.

**Open questions:** Whether aggregate counts are ever shown; abuse-rate threshold.

**Suggested tasks:**

- Approve hidden-count recommendation.
- Define append-only event and active projection semantics.
- Define ranking normalization and abuse monitoring.
- Include accessibility and optimistic-state recovery in future UX tests.

## Story 6 - Define Contextual Read Placement

**User story:** As a member, I want one relevant tip where I am already thinking about golf, without navigating a feed.

**Business value:** Tests usefulness while preserving accepted IA and Play Now hierarchy.

**Acceptance criteria:**

- My Golf club context is approved or replaced by an explicit founder decision.
- Tips are optional modules, not blockers for host-surface actions.
- No qualified tip means omission, not irrelevant filler.
- One tip receives primary contextual treatment.
- Home never outranks Play Now with Community Tips.
- Session completion does not imply analysis of unrecorded club/session data.

**Non-goals:** Fourth nav, infinite scroll, generic browse page, Play Now interruption.

**Dependencies:** Decision `CT-OQ-007`; accepted Experience Brief and DLS.

**Risks:** Diagnosis implication, completion-state crowding, Home hierarchy erosion.

**Open questions:** First placement and when a related-tip set is justified.

**Suggested tasks:**

- Founder selects first placement.
- Prototype mobile first-viewport hierarchy.
- Conduct privacy-language review.
- Define loading, empty, stale, and removed states before implementation.

## Story 7 - Define Privacy And Telemetry Boundary

**User story:** As a member, I want relevant practice knowledge without my private golf data becoming community content or social metadata.

**Business value:** Protects the trust required for Golfer Passport and first-party performance history.

**Acceptance criteria:**

- Community-visible, moderator-restricted, private-performance, private-session, and analytics classifications are explicit.
- V1 ranking excludes private telemetry.
- Author projection excludes handicap/rank/performance by default.
- Analytics excludes bodies, names, emails, shots, sessions, and private metrics.
- Contextual placement does not reveal why a tip was selected from private facts.
- Unauthorized roles receive no drafts, reports, or moderation history.

**Non-goals:** Public performance sharing, consent framework for telemetry recommendations, social profile.

**Dependencies:** Existing privacy principles; decision `CT-OQ-004`.

**Risks:** Accidental response-field leakage; misleading personalization copy.

**Open questions:** Future explicit-sharing model; privacy review owner.

**Suggested tasks:**

- Produce a future field-level data classification.
- Threat-model API responses, events, logs, and moderation exports.
- Define negative privacy fixtures and response snapshots.
- Require privacy acceptance before pilot launch.

## Story 8 - Define Audit And Event Contract

**User story:** As Fairway operations, I need attributable community events and diagnostics so moderation decisions and failures are reconstructable.

**Business value:** Supports trust, support, quality measurement, and low-overhead diagnosis.

**Acceptance criteria:**

- Domain event names follow `domain.object.action`.
- Sensitive decisions include actor, target, reason, prior/new state, timestamp, and correlation.
- Product analytics, domain truth, and technical observability remain separate.
- Analytics outages cannot block community transactions.
- Stable Fairway IDs replace PII/vendor IDs.
- Required logs diagnose authorization, idempotency, moderation conflict, and placement failure.

**Non-goals:** Data warehouse, paid vendor integration, duplicate event catalog.

**Dependencies:** Standing Data & Observability Contract.

**Risks:** Duplicate event names; content or PII in telemetry; audit/event duplication.

**Open questions:** Retention and moderator reason-detail access.

**Suggested tasks:**

- Approve canonical domain event list.
- Map events to KPIs and guardrails.
- Define redaction rules.
- Add future PRD/test traceability.

## Story 9 - Define Future Deterministic Demo Overlay

**User story:** As a product reviewer, I need coherent Community Tips evidence attached to accepted personas without changing DU1-v1.

**Business value:** Makes privacy, moderation, and contextual-value claims inspectable.

**Acceptance criteria:**

- Overlay has its own version, seed, clock, and fingerprint.
- Overlay references but never mutates DU1 records.
- Published, draft, pending, reported, hidden, removed, and archived examples reconcile.
- Persona authorship remains coherent without revising DU1 histories.
- Repeated reset is deterministic.
- Evidence reports base and overlay fingerprints separately.

**Non-goals:** DU1-v1.1 mutation, production seed, fake live provider claims.

**Dependencies:** Approved implementation contract; accepted DU1 IDs.

**Risks:** Overlay accidentally deletes/updates base facts; screenshots claim unsupported state.

**Open questions:** CT1 clock and exact seed inventory after UX is implemented.

**Suggested tasks:**

- Approve CT1 fixture contract.
- Add base-record mutation guard.
- Define reconciliation and fingerprint rules.
- Create evidence only after implementation is committed.

## Story 10 - Define Product Acceptance Plan

**User story:** As the founder, I need objective and human evidence that Community Tips is useful, private, trustworthy, accessible, and coherent before accepting it.

**Business value:** Prevents functional completion from being mistaken for product readiness.

**Acceptance criteria:**

- Functional acceptance covers lifecycle, ownership, authorization, idempotency, and concurrency.
- Privacy acceptance proves no telemetry/PII leakage across roles and events.
- Moderation acceptance proves queue, reports, state transitions, reasons, and audit.
- Accessibility acceptance covers keyboard, focus, labels/errors, status, contrast, and automated findings.
- DLS/UX acceptance reviews contextual hierarchy and absence of feed behavior.
- Demo evidence reconciles CT1 facts to rendered states.
- Negative cases are included and must fail safely.
- Human Product Acceptance remains explicit and commit-specific.

**Non-goals:** Treating automated checks as subjective acceptance; accepting mutable working-tree evidence.

**Dependencies:** All previous stories; Experience QA provenance controls.

**Risks:** Evidence volume without decision value; screenshots that do not prove declared state.

**Open questions:** Reviewer, acceptance threshold, required browsers, and pilot evidence window.

**Suggested tasks:**

- Create future acceptance matrix tied to PRD IDs.
- Define canonical personae and logical states.
- Add privacy and moderation evidence manifests.
- Generate review artifact from exact committed source.

## Future Product Acceptance Plan

### Functional acceptance

- Server-authoritative lifecycle and authorization.
- Immutable revisions.
- Idempotent Helpful/report/submit/moderation.
- Concurrent author/moderator conflict handling.
- Removed/hidden discovery exclusion.

### Privacy acceptance

- Field-level response and event inspection.
- Cross-role negative access tests.
- No raw shots, session detail, handicap, performance values, guest data, or identifiable Helpful behavior in member/analytics surfaces.
- Public author identity matches explicit consent policy.

### Moderation acceptance

- Submission and report queues.
- State-driven action availability.
- Required reasons and actor attribution.
- Restore rules.
- Complete audit reconstruction.

### Accessibility acceptance

- WCAG 2.2 AA intent.
- Keyboard-only reading, authoring, reporting, and moderation.
- Focus, labels/errors, target sizing, status announcements, and contrast.
- Automated axe evidence plus human review.

### DLS/UX acceptance

- Mobile-first hierarchy.
- Golf-forward member language.
- No feed or generic SaaS card wall.
- Home/Play/My Golf navigation unchanged.
- Play Now remains dominant.
- Honest omission when no useful tip exists.

### Demo evidence acceptance

- Exact committed revision.
- Viewport screenshots for My Golf, completion, Home if implemented, authoring, report, and moderation.
- State and source reconciliation.
- Empty, loading, error, hidden, removed, and blocked states.
- Zero unexpected console/network failures on reviewed flows.

### Deterministic fixture acceptance

- CT1 version, seed, clock, reset receipt, fingerprints, and per-record provenance.
- Unchanged DU1 fingerprints.
- Repeatability across reset, refresh, login, and server restart.
- No mutable working-tree source in review package.

### Negative-case acceptance

- Unauthorized authoring or moderation.
- Cross-member edit.
- Direct member publish.
- Self-Helpful.
- Duplicate/concurrent operations.
- Invalid context.
- Superseded revision.
- Removed-tip retrieval.
- Privacy payload leak.
- Analytics/observability outage.
- Rate-limit/abuse response.

## Refinement Exit Criteria

This epic becomes implementation-ready only when:

1. All blocking decisions are answered.
2. The canonical PRD and data contract are updated with approved statuses.
3. The pilot author cohort and moderator owner are named.
4. The first placement and success rubric are approved.
5. Privacy and prohibited-content policies are reviewable.
6. A vertical-slice boundary and implementation sequence are approved.
7. DU1-v1 immutability is explicitly preserved.

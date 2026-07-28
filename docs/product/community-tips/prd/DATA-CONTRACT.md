# Community Tips v1 Conceptual Data Contract

**Status:** `CONCEPTUAL - NO SCHEMA OR MIGRATION AUTHORIZED`
**Product requirements:** [`PRD.md`](PRD.md)
**Standing contract:** [`../../data/DATA-OBSERVABILITY-CONTRACT.md`](../../data/DATA-OBSERVABILITY-CONTRACT.md)

This document defines product-level data ownership, invariants, privacy, events, and observability. It deliberately does not prescribe SQL, ORM, indexes, API payloads, or migration syntax.

## 1. Data Ownership Boundary

One Fairway-owned `community` domain owns:

- Canonical tip identity.
- Immutable content revisions.
- Controlled context taxonomy and assignments.
- Publication and visibility state.
- Authorship and publication-consent evidence.
- Helpful event history and current projection.
- Reports and report lifecycle.
- Moderation decisions and reasons.
- Placement policy and diagnostics.
- Community domain events.

Existing Fairway boundaries remain authoritative for:

- `MemberProfile`: canonical member identity.
- Authentication: authenticated principal only.
- Authorization: role grants and server-side policy.
- Location: canonical location identity.
- Audit: cross-domain sensitive-action reconstruction.
- My Golf: visible club context and golfer identity presentation.
- Competition: future challenge/event identity and rules.
- Analytics/observability: non-blocking consumers.

No external community, moderation, analytics, or content vendor becomes source of truth.

## 2. Conceptual Privacy Classes

| Class | Examples | Audience |
|---|---|---|
| `COMMUNITY_VISIBLE` | Approved title/body, context labels, approved role identity or consented display name, approved source note. | Eligible members |
| `AUTHOR_PRIVATE` | Own drafts, own review outcome, own consent status. | Author and authorized curator/admin |
| `MODERATOR_RESTRICTED` | Rejected revisions, reports, reporter identity/detail, moderation reasons/history, consent evidence. | Authorized curator/admin |
| `PRIVATE_BEHAVIORAL` | Individual Helpful choices and placement diagnostics. | Authorized application/data operations only |
| `PRIVATE_GOLF` | Raw shots, club baselines, handicap, performance history, detailed sessions. | Existing private Fairway boundaries; never Community Tips content in v1 |
| `AUDIT_RESTRICTED` | Actor, previous/new state, reasons, correlation, exceptional actions. | Authorized audit/security/curator roles |

Contextual placement never changes a field's privacy class.

## 3. Common Requirements

All conceptual entities use:

- Stable Fairway IDs.
- Server-generated timestamps through the application Clock boundary.
- Idempotency/correlation context for retriable mutations.
- Canonical MemberProfile references rather than email, Clerk user ID, or display name as business identity.
- Explicit location scope where applicable.
- Append-only history or reconstructable state changes for sensitive actions.

Binary floating point, vendor identity, and arbitrary client-authored authority are irrelevant to this domain and must not become canonical inputs.

### Economic Authority Boundary

- CommunityTip, placement, Helpful, report, revision, consent, and moderation records are not credit-ledger, payment, entitlement, capacity-allocation, reservation, session, or access records.
- Community Tips records must not create credit grants, holds, commits, releases, refunds, expirations, or adjustments.
- References to club, location, member-safe context, or a future Competition-owned challenge context do not make Community Tips reservation, session, inventory, or access authority.
- Community Tips events may support engagement, utilization, and retention analysis, but they are not payment, entitlement, or capacity-allocation facts.
- Any action that leads toward practice must cross the existing server-authoritative membership, pricing, credit, inventory, reservation or Play Now, session, and access boundaries.

## 4. CommunityTip

### Purpose

Stable canonical identity and lifecycle container for one practice tip across revisions.

### Candidate Key Fields

- `id`
- `author_type`: `member` or `fairway_staff`
- `author_member_profile_id` when member-authored
- `staff_authorship_role_key` when staff/Fairway-authored
- `current_revision_id`
- `publication_status`
- `visibility_policy_id`
- `published_at`
- `hidden_at`
- `removed_at`
- `archived_at`
- `created_at`
- `updated_at`

### Owner

`community`

### Invariants

- One tip has one stable ID and one or more immutable revisions.
- Only one approved current revision is eligible for member visibility.
- Publication status is server-authoritative.
- Removing or archiving never deletes revision, report, consent, Helpful, moderation, or audit history.
- Member authors link through canonical `MemberProfile`.
- Author type does not itself grant visibility or publication authority.
- Staff/Fairway authorship uses an approved role identity.

### Privacy Classification

Mixed:

- Tip ID and published lifecycle projection: `COMMUNITY_VISIBLE`.
- Member linkage and internal timestamps/state: `MODERATOR_RESTRICTED` or internal.

### Authorization Notes

- Ordinary members read only eligible published tips.
- Member authors mutate through revision use cases, not direct tip-state writes.
- Curator/admin controls visibility transitions.

### Audit Needs

- Create.
- Submit.
- Publish.
- Hide.
- Remove.
- Archive.
- Restore.
- Consent-withdrawal visibility effect.

### Future Extensibility

- Verified instructor author type only after an approved identity/claims policy.
- Organization/tenant scope only after isolation architecture.

## 5. CommunityTipRevision

### Purpose

Immutable snapshot of title, body, source note, and approved contexts for initial creation and every edit.

### Candidate Key Fields

- `id`
- `tip_id`
- `revision_number`
- `title`
- `body`
- `source_note`
- `created_by_member_profile_id`
- `created_at`
- `review_state`
- `reviewed_by_member_profile_id`
- `reviewed_at`
- `supersedes_revision_id`

### Owner

`community`

### Invariants

- Revision numbers are monotonic per tip.
- Content fields are immutable after revision creation.
- Published content references an approved revision.
- Editing published content creates a new revision.
- Every member-authored revision requires review.
- The current published revision may remain visible while a new revision is reviewed unless separately hidden.
- Content is plain text; stored HTML, executable content, rich embeds, and arbitrary attachments are rejected.
- Every publishable revision has exactly one primary controlled context.

### Privacy Classification

- Approved published revision: `COMMUNITY_VISIBLE`.
- Draft, pending, returned, rejected, and superseded content: `AUTHOR_PRIVATE` and `MODERATOR_RESTRICTED`.

### Authorization Notes

- Member may create revisions only for their own tip.
- Curator/admin reviews member revisions.
- Staff authoring privilege does not imply unrestricted moderation.

### Audit Needs

- Revision created.
- Submitted.
- Approved.
- Returned.
- Rejected/removed.
- Superseded.

### Future Extensibility

- Reviewed attachment references only after a separate media policy.
- Versioned Fairway drill reference only after a canonical drill domain exists.

## 6. CommunityTipContext

### Purpose

Attach an immutable revision to controlled, versioned placement contexts.

### Candidate Key Fields

- `id`
- `tip_revision_id`
- `taxonomy_version`
- `context_type`: `club`, `practice_intent`, or `preparation`
- `context_key`
- `is_primary`
- `created_at`

### Owner

`community`

### Invariants

- Keys come from the approved taxonomy, never free-form tags.
- Every publishable revision has exactly one primary context.
- Context assignments change only through a new revision.
- Context describes the tip, not private viewer state.
- Unknown or retired keys cannot be newly published.
- Challenge/event references are excluded from v1.

### Privacy Classification

`COMMUNITY_VISIBLE`

### Authorization Notes

- Authors choose only enabled keys.
- Curator validates context before publication.

### Audit Needs

Revision history preserves context changes; taxonomy-version changes require a decision record.

### Future Extensibility

- Specific club keys.
- Versioned Competition-owned challenge reference.
- Organization-specific context only after policy/isolation review.

## 7. CommunityTipPlacement

### Purpose

Represent or explain one server-authoritative selection for a product surface.

### Recommended V1 Form

A derived application response plus bounded diagnostic evidence when needed. It is not a permanent member-profile trait.

### Candidate Key Fields

- `placement_id`
- `tip_id`
- `tip_revision_id`
- `surface`
- `explicit_context_keys`
- `location_id` when relevant
- `visibility_policy_id`
- `ranking_rule_version`
- `selected_at`
- `result`: selected or valid-no-result

### Owner

`community` application layer

### Invariants

- V1 inputs are explicit surface context, publication/visibility eligibility, location scope, curation priority, bounded recency, and private Helpful projection when Phase 3 exists.
- V1 does not use private performance/session telemetry.
- Placement diagnostics do not copy tip body, display name, report data, or private golf facts.
- Same canonical inputs and rule version produce deterministic ordering.
- No qualified result is valid product behavior.

### Privacy Classification

`PRIVATE_BEHAVIORAL`; selected published content remains independently `COMMUNITY_VISIBLE`.

### Authorization Notes

- Member sees only the selected eligible tip.
- Diagnostic inputs are not returned as recommendation explanation.

### Audit Needs

Ordinary placement does not require sensitive audit. Ranking-rule changes require a versioned decision and deployment trace.

### Future Extensibility

Future private personalization may be evaluated only after privacy review and Product Acceptance. Underlying telemetry must remain private and server-side.

## 8. CommunityTipHelpfulEvent

### Purpose

Append-only member action recording Helpful mark or withdrawal.

### Candidate Key Fields

- `id`
- `tip_id`
- `member_profile_id`
- `action`: `marked` or `withdrawn`
- `idempotency_key`
- `created_at`

### Owner

`community`

### Invariants

- One member has at most one active Helpful projection per tip.
- Retry produces no duplicate effective change.
- Concurrent operations resolve to one canonical current state.
- Author cannot mark their own tip.
- Hidden/removed tips reject a new mark.
- Withdrawal is not a negative rating.
- Counts are derived projections, never the event authority.

### Privacy Classification

`PRIVATE_BEHAVIORAL`

### Authorization Notes

- Authenticated eligible members only.
- Individual choices are not visible to authors, members, operators, or Facilities.

### Audit Needs

Normal domain event is sufficient. Administrative mutation or abuse investigation requires audit.

### Future Extensibility

- No reaction types or negative-score inference in v1.

## 9. CommunityTipReport

### Purpose

Private allegation about the exact published revision a member viewed.

### Candidate Key Fields

- `id`
- `tip_id`
- `tip_revision_id`
- `reporter_member_profile_id`
- `reason_code`
- `detail`
- `status`
- `created_at`
- `assigned_to_member_profile_id`
- `resolved_at`

### Owner

`community`

### Invariants

- Report remains attached to the revision viewed.
- One active report per member, revision, and reason context.
- Report detail is never visible to the author or ordinary members.
- Reporting does not automatically alter publication status.
- Report state remains separate from tip state.
- Reason must come from an approved member-report taxonomy.

### Privacy Classification

`MODERATOR_RESTRICTED`

### Authorization Notes

- Eligible members may report published tips.
- Only curator/admin can read details or change report status.

### Audit Needs

- Report created.
- Assigned.
- In review.
- Resolved with action.
- Resolved with no action.
- Reopened or escalated if later supported.

### Future Extensibility

External legal/safety case reference may be added without moving canonical report truth out of Fairway.

## 10. CommunityTipModerationAction

### Purpose

Append-only record of a governed content or report decision.

### Candidate Key Fields

- `id`
- `tip_id`
- `tip_revision_id`
- `report_id` when applicable
- `action`
- `actor_member_profile_id`
- `reason_code`
- `reason_detail`
- `previous_status`
- `new_status`
- `correlation_id`
- `idempotency_key`
- `created_at`

### Owner

`community`

### Invariants

- Publish, hide, remove, restore, and report-review actions have authorized actor and reason.
- `other` requires reason detail.
- Previous and new state are captured.
- Prior actions are never overwritten.
- Repeated requests in one idempotency context produce one effective action.
- Current-state validation prevents lost or superseded moderator decisions.
- Staff-authored content is not exempt.

### Privacy Classification

`MODERATOR_RESTRICTED` and `AUDIT_RESTRICTED`

### Authorization Notes

Fairway curator/admin only for MVP.

### Audit Needs

This entity is the detailed moderation history. A corresponding platform `AuditEvent` supports cross-domain reconstruction without duplicating sensitive detail unnecessarily.

### Future Extensibility

- Appeal case.
- Delegated organization moderation after isolation policy.

## 11. CommunityTipVisibilityPolicy

### Purpose

Define which eligible members may discover a published tip.

### Candidate Key Fields

- `id`
- `scope`: `network` or `location` in v1
- `location_id` when location-scoped
- `audience`
- `effective_from`
- `effective_to`
- `created_by_member_profile_id`
- `created_at`

### Owner

`community`

### Invariants

- Golf/practice tips may default to network scope.
- Simulator setup and suite etiquette use explicit location scope when details differ.
- Location is never inferred from author home location.
- Removed/hidden/archived content remains ineligible regardless of policy.
- Policy cannot expand author or moderator authority.

### Privacy Classification

Internal policy; eligibility result is member-visible.

### Authorization Notes

Curator/admin creates or changes policy.

### Audit Needs

Policy creation and material changes.

### Future Extensibility

- Organization/tenant.
- Membership plan.
- Competition challenge/event.
- Jurisdiction.

Future scopes require explicit isolation and policy-inheritance design.

## 12. CommunityTipAuthorshipConsent

### Purpose

Versioned evidence that a member explicitly approved public display-name attribution for a defined publication context.

### Candidate Key Fields

- `id`
- `tip_id`
- `tip_revision_id` or publication scope reference
- `author_member_profile_id`
- `identity_projection_type`: `display_name`
- `approved_display_name_snapshot`
- `policy_version`
- `status`: `granted` or `withdrawn`
- `granted_at`
- `withdrawn_at`
- `evidence_reference`
- `idempotency_key`

### Owner

`community`

### Invariants

- Draft submission does not imply publication consent.
- Publication fails closed without active consent.
- Consent identifies the exact public treatment the member approved.
- Only display name is supported for member authors in v1.
- Consent evidence is historical and is never destructively rewritten.
- Withdrawal immediately makes the public tip ineligible and triggers governed review.
- A name/policy/publication-scope change requiring materially different public treatment requires new consent.

### Privacy Classification

`MODERATOR_RESTRICTED` and `AUTHOR_PRIVATE`

### Authorization Notes

- Member author may grant/withdraw their own consent.
- Curator may inspect validity but cannot fabricate member consent.

### Audit Needs

- Consent granted.
- Consent withdrawn.
- Publication blocked for missing consent.
- Visibility changed because of withdrawal.

### Future Extensibility

- Pseudonym or instructor identity only after separate policy.
- Organization-specific disclosure language.

## 13. Lifecycle Definitions

### Tip Publication Status

- `draft`
- `pending_review`
- `published`
- `hidden`
- `removed`
- `archived`

Recommended transitions:

```text
draft -> pending_review
pending_review -> draft | published | removed
published -> hidden | archived | removed
hidden -> published | archived | removed
archived -> draft
removed -> draft only through authorized, reasoned restoration
```

Member publication additionally requires active authorship consent.

### Revision Review State

- `draft`
- `pending_review`
- `approved`
- `returned`
- `superseded`

### Report State

- `open`
- `in_review`
- `resolved_actioned`
- `resolved_no_action`

`reported` is not a tip publication status.

## 14. Scope And Business Model

| Scope | V1 | Data implication |
|---|---|---|
| Network | Yes | Explicit network visibility policy. |
| Location | Yes where local guidance differs | Canonical `location_id`; never inferred. |
| Organization/tenant | No | Do not create tenant fields/config merely for future optionality. |
| Challenge/context | No | Future reference to Competition-owned ID only. |
| Member-authored | Invited/approved | Canonical MemberProfile and consent evidence. |
| Staff-authored | Explicit role | Role identity and audit. |
| Fairway-curated | Initial inventory | Network or explicit location scope. |
| Privately personalized | No | Future server-side policy after privacy acceptance. |
| Community-visible | Approved projection only | No private inputs or restricted history. |

The conceptual model must support future owned, licensed, and hybrid deployments without pretending v1 is a multi-tenant platform.

## 15. Competition Boundary

Community Tips may later store a reference to a versioned Competition-owned challenge context.

It must not store as canonical:

- Challenge rules.
- Eligibility.
- Scores.
- Rankings.
- Divisions/flights.
- Results.

Competition does not own tip content, moderation, consent, Helpful events, or visibility.

## 16. Domain Events

Canonical candidate events:

- `community.tip.created`
- `community.tip.revision_created`
- `community.tip.submitted`
- `community.tip.consent_granted`
- `community.tip.consent_withdrawn`
- `community.tip.publication_blocked`
- `community.tip.published`
- `community.tip.hidden`
- `community.tip.removed`
- `community.tip.archived`
- `community.tip.restored`
- `community.tip.helpful_marked`
- `community.tip.helpful_withdrawn`
- `community.tip.reported`
- `community.tip.report_reviewed`

Requirements:

- Events use stable Fairway IDs.
- Idempotent retries do not emit duplicate effective events.
- Events are transactional facts or transactionally coupled outbox/domain records.
- Analytics failure does not roll back domain truth.
- Event names are not duplicated with synonyms.

## 17. Product Analytics

Potential behavioral events:

- `community.tip.viewed`
- `community.tip.authoring_started`
- `community.tip.consent_presented`
- `community.tip.submitted`
- `community.tip.reported`

Helpful domain events may supply analytics without inventing duplicate names.

Required dimensions:

- `tip_id`
- `tip_revision_id`
- `placement_id`
- `surface`
- `context_key`
- `location_id` when applicable
- `viewer_member_profile_id`
- `author_member_profile_id` only where authorized
- `moderation_status`
- `report_reason`
- `ranking_rule_version`
- `failure_reason`

Prohibited analytics fields:

- Tip title/body/source note.
- Display name, email, phone.
- Report detail.
- Consent evidence detail.
- Raw shots, handicap, baselines, trends.
- Session, reservation, guest, or access detail.

## 18. KPI And Guardrails

Primary KPI:

- Qualified Helpful Rate.

Leading metrics:

- Eligible placement rate.
- Meaningful view rate.
- Draft start/submission rate.
- Submission-to-publication rate.
- Queue age.

Guardrails:

- Privacy incidents.
- Report rate by reason.
- Unsafe/security/private-data reports.
- Hidden/removed rate.
- Duplicate/spam rate.
- Queue age and curator workload.
- Authorization rejection.
- Irrelevant placement.
- Accessibility failures.

Numeric thresholds remain a later pilot decision.

## 19. Logs, Traces, And Errors

Operational diagnosis must distinguish:

- Authorization denial.
- Ownership violation.
- Missing invitation.
- Missing/withdrawn consent.
- Invalid or retired context.
- Idempotency conflict.
- Superseded revision.
- Concurrent moderation conflict.
- Visibility-policy mismatch.
- Placement failure versus valid no-result.
- Report persistence failure.
- Domain-event persistence failure.
- Analytics delivery failure.

Logs/traces may include:

- Stable IDs.
- Correlation/idempotency IDs.
- Rule/taxonomy version.
- Controlled action/failure code.
- Timing.

They must not include:

- Tip bodies.
- Display names or email.
- Report detail.
- Consent evidence content.
- Private golf/session data.
- Authentication tokens or secrets.

## 20. Reliability And Security Invariants

- Server authorization is authoritative.
- Removed/hidden content is excluded by server query.
- Plain text is escaped at output.
- Mutations are idempotent.
- Concurrent moderation uses current-state validation.
- Consent is a publication precondition.
- Rate limiting is required before member authoring.
- Audit/revision/consent history remains reconstructable.
- Location scope is explicit.
- Analytics/observability outage is non-blocking.

## 21. Test Traceability

| Contract area | Future proof |
|---|---|
| Tip/revision invariants | Domain and persistence tests |
| Consent precondition/withdrawal | Domain, integration, and browser tests |
| Helpful idempotency | Unit, integration, and concurrency tests |
| Report/publication separation | Domain and integration tests |
| Moderation reasons/audit | Authorization and reconstruction tests |
| Privacy classes | Field-level response/event/log snapshots |
| Placement determinism | Ranking and My Golf integration tests |
| Analytics non-blocking behavior | Failure-injection integration tests |
| DU1 immutability | CT1 reset/fingerprint guard |
| Product evidence | Commit-specific Experience QA bundle |

## 22. Unresolved But Non-Blocking Data Decisions

- Exact persistence/table design.
- Exact retention periods.
- Exact title/body limits.
- Whether ordinary placement diagnostics are persisted or only emitted as bounded telemetry.
- Internal moderation queue projection.
- Future organization/tenant isolation.
- Future legal/safety case integration.

These decisions must be resolved at the appropriate implementation or production-readiness gate without changing the locked product behavior.

# Community Tips v1 Conceptual Domain Model

Status: `DISCOVERY - NO SCHEMA OR IMPLEMENTATION`

## Recommended Ownership Boundary

Create one `community` bounded domain inside the existing modular monolith when implementation is approved.

V1 should not split content, moderation, ranking, and helpfulness into separate services or speculative domain packages. The `community` domain owns tip truth and policy while calling existing Fairway boundaries:

- `identity/member-profile`: canonical actor identity and privacy-safe display projection.
- `authorization`: community author, curator, moderator, and administrator privileges.
- `audit`: attributable sensitive decisions.
- `locations`: optional location scope.
- `analytics/observability`: non-blocking event consumers.
- `competition`: future context consumer, not a v1 dependency.

`golf-context` should initially be a versioned value taxonomy owned by `community`, not a new empty domain. Extract it only when multiple implemented domains share the same contract.

## Business Scope Model

The conceptual model must not assume Fairway owns every future facility:

- Network scope supports Fairway-curated knowledge and shared trust policy.
- Organization/tenant scope may later represent a third-party facility operator's authorized staff and moderation responsibility.
- Location scope supports local simulator setup, suite etiquette, and preparation.
- Challenge/context scope may later reference a Competition-owned identifier.
- Member/staff/Fairway authorship identifies who supplied knowledge; it does not determine visibility by itself.
- Private personalization is a placement concern, never a content-visibility shortcut.

V1 should implement only scopes approved by the future PRD. This discovery does not authorize organization tables, tenant configuration, policy inheritance, cross-tenant sharing, or a multi-tenant service split.

Deployment packaging such as Location OS, Golfer Identity/My Golf, Engagement Layer, and Network Layer uses the same canonical Community Tip records. Packaging is not domain ownership.

## Competition Boundary

Competition owns challenges, rules, eligibility, scoring, rankings, divisions/flights, and competition results.

Community Tips owns structured practice knowledge, authorship, revisions, context taxonomy, moderation, helpfulness, visibility, and placement.

A future Community Tip context may reference a versioned challenge ID for placement. Community Tips must not copy or interpret challenge rules/results, and Competition must not become the tip or moderation authority. Neither domain depends on the other for MVP, so Community Tips v1 does not require a competition engine.

## Conceptual Entities

No entity in this document authorizes a migration.

### CommunityTip

Purpose: Stable canonical identity and lifecycle container for one tip.

Key fields:

- `id`
- `author_type`: `member` or `fairway_staff`
- `author_member_profile_id` when member-authored
- `authorship_visibility`
- `current_revision_id`
- `publication_status`
- `visibility_policy_id`
- `published_at`
- `hidden_at`
- `removed_at`
- `archived_at`
- `created_at`
- `updated_at`

Owner: `community`

Important invariants:

- One stable tip may have many immutable revisions.
- Only the current approved revision is member-visible.
- Publication status is server-authoritative.
- Removing or archiving never deletes revisions, reports, or moderation history.
- A member author remains linked through canonical `MemberProfile`, never email or Clerk ID.
- Member-visible authorship is produced from the approved privacy-safe identity policy, not copied from private identity fields.

Privacy: Mixed. Published tip identity is community-visible; author linkage and lifecycle metadata are internal.

Audit: Create, submit, publish, hide, remove, archive, restore, and ownership-affecting actions.

Future extensibility: Instructor authorship may add a verified author type later without changing member identity ownership.

### CommunityTipRevision

Purpose: Immutable content snapshot for creation and every edit.

Key fields:

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

Owner: `community`

Important invariants:

- Revision numbers are monotonic per tip.
- Published content references an approved revision.
- Editing published content creates a new revision and does not rewrite what members previously saw.
- Member-authored revision changes require review in v1.
- Content is plain text; stored HTML or arbitrary embeds are not accepted.

Privacy: Content is internal until approved, then community-visible according to visibility policy. Rejected revision content remains moderator-restricted.

Audit: Revision created, submitted, approved, returned, or superseded.

Future extensibility: Rich media references are deliberately absent; a future version may add reviewed attachment boundaries.

Related drills are also deferred. A future tip may reference a Fairway-owned, versioned drill record, but v1 must not store an arbitrary drill name or link as though a canonical drill domain exists.

### CommunityTipContext

Purpose: Attach a tip revision to controlled, versioned placement contexts.

Key fields:

- `id`
- `tip_revision_id`
- `taxonomy_version`
- `context_type`
- `context_key`
- `is_primary`
- `created_at`

Owner: `community`

Important invariants:

- Context keys come from an approved taxonomy, not free-form tags.
- Every publishable revision has exactly one primary context.
- Challenge/event IDs cannot be attached until the competition contract exists.
- Context describes the tip, not the viewer's private state.

Privacy: Community-visible taxonomy; no private member metric or session fact.

Audit: Context changes are preserved through revision history.

Future extensibility: Versioned competition and challenge references may be added later.

### CommunityTipHelpfulEvent

Purpose: Append-only record of a member marking or withdrawing Helpful.

Key fields:

- `id`
- `tip_id`
- `member_profile_id`
- `action`: `marked` or `withdrawn`
- `idempotency_key`
- `created_at`

Owner: `community`

Important invariants:

- A member has at most one active Helpful projection per tip.
- Retry produces no duplicate effective signal.
- A member cannot mark their own tip Helpful.
- Removed or hidden tips cannot receive a new Helpful mark.
- Counts are projections from events and are not the canonical record.

Privacy: Restricted behavioral data. Aggregate quality may be used for ranking; individual choices are not community-visible.

Audit: Domain event is sufficient for normal member action; suspicious or administrative mutation requires audit.

Future extensibility: A separate negative-quality signal should not be inferred from withdrawal.

### CommunityTipReport

Purpose: Private member report about a published tip.

Key fields:

- `id`
- `tip_id`
- `tip_revision_id`
- `reporter_member_profile_id`
- `reason_code`
- `detail`
- `status`
- `created_at`
- `resolved_at`

Owner: `community`

Important invariants:

- One active report per member, tip, and reason.
- Report detail is never shown to the author or normal members.
- Reporting does not silently alter content state.
- A report remains attached to the revision the reporter saw.
- Report state is separate from tip publication state.

Privacy: Moderator-restricted. Report details may contain sensitive allegations or accidentally disclosed PII.

Audit: Report created, assigned, resolved, escalated, or reopened.

Future extensibility: Legal/safety escalation may reference an external case without moving canonical report truth out of Fairway.

### CommunityTipModerationAction

Purpose: Append-only record of a governed moderation decision.

Key fields:

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
- `created_at`

Owner: `community`

Important invariants:

- Every visibility-reducing or restoring decision has an authorized actor and reason.
- Previous and new state are recorded.
- A moderation action never destroys content or prior actions.
- Repeated requests with one idempotency/correlation context produce one effective action.

Privacy: Moderator-restricted, with limited author-facing outcome projection.

Audit: This entity is itself the detailed moderation audit; a corresponding cross-domain `AuditEvent` supports platform-level reconstruction.

Future extensibility: Appeal workflow is deferred.

### CommunityTipVisibilityPolicy

Purpose: Define who may discover a published tip.

Key fields:

- `id`
- `scope`: `network` or `location` in v1; future `organization` only after approval
- `organization_id` only in a future organization-scoped model
- `location_id` when location-scoped
- `audience`
- `effective_from`
- `effective_to`
- `created_by_member_profile_id`

Owner: `community`

Important invariants:

- Location scope is explicit and cannot be inferred from author home location.
- Normal members see only published tips allowed by current policy.
- Facilities role does not grant community visibility beyond normal membership.
- Removed tips are never visible to normal members regardless of policy.

Privacy: Internal policy; resulting eligibility is member-visible.

Audit: Policy creation or change.

Future extensibility: Organization/tenant, membership-plan, challenge, or event scope may be added only with an approved need and isolation review.

### CommunityTipPlacement

Purpose: Explain a server-authoritative selection decision for a surface.

Recommended v1 form: A derived application response or bounded diagnostic record, not a permanent member profile.

Candidate fields:

- `placement_id`
- `tip_id`
- `tip_revision_id`
- `surface`
- `context_keys`
- `location_id` when relevant
- `ranking_rule_version`
- `selected_at`

Owner: `community` application layer

Important invariants:

- Placement does not copy private telemetry into tip content, events, or author metadata.
- V1 inputs are explicit surface context, controlled taxonomy, location scope, moderation eligibility, curation priority, Helpful projection, and recency.
- If a diagnostic placement record exists, it excludes tip body and private member facts.

Privacy: Internal/behavioral. The selected tip is member-visible; ranking inputs are not.

Audit: No sensitive audit for ordinary placement. Rule-version changes require a decision record.

Future extensibility: Private recommendation context may be evaluated later behind a dedicated privacy decision and must remain server-side.

## Lifecycle Model

### Publication status

- `draft`: Author-editable and not member-visible.
- `pending_review`: Submitted, locked from ordinary edits, and awaiting review.
- `published`: Current approved revision may be placed for eligible members.
- `hidden`: Temporarily unavailable while preserving a reversible moderation path.
- `removed`: Unavailable because of a moderation decision; normal members cannot discover it.
- `archived`: Intentionally retired without a misconduct implication.

`reported` is a moderation condition derived from one or more open reports, not a publication status. A published tip may remain published while a report is reviewed, or a moderator may explicitly hide it. This separation prevents a report from silently rewriting publication truth.

Recommended transitions:

```text
draft -> pending_review
pending_review -> draft | published | removed
published -> hidden | archived | removed
hidden -> published | archived | removed
archived -> draft
removed -> draft only through an administrator-authorized, audited restoration
```

The exact restoration authority is a pre-implementation decision.

### Report status

- `open`
- `in_review`
- `resolved_actioned`
- `resolved_no_action`

No automatic report-count threshold should hide content in v1. Privacy or safety reports may receive priority, but a human-authorized action changes publication state.

## Authorization Rules

| Actor | Read | Draft | Edit | Submit | Publish | Report | Hide/remove | Restore | Moderation history |
|---|---|---|---|---|---|---|---|---|---|
| Active member | Eligible published tips | Only if author-eligible | Own draft; own published content through new reviewed revision | Own draft | No | Published tip | No | No | No |
| Invited member author | Same as member | Yes | Own only | Yes | No | Yes | No | No | Own review outcome only |
| Community curator | Yes | Fairway-authored | Authorized Fairway content | Yes | Fairway-authored directly; member content only if also moderator | Yes | No unless also moderator | No | Limited |
| Community moderator | Yes | No implied right | No implied authorship right | No implied right | Approve member submission | Yes | Yes, with reason | Hidden content; removed only if policy grants | Full community moderation history |
| Community administrator | Yes | Yes | Governed exceptional action | Yes | Yes | Yes | Yes | Yes, with reason | Full |
| Operator | Normal member rights only unless separately granted | No implied right | No | No | No | Yes as member | No | No | No |
| Facilities | Normal member rights only if also a member | No | No | No | No | Yes only as member | No | No | No |
| Guest | None in v1 | No | No | No | No | No | No | No | No |

All authorization is server-side. UI visibility is not enforcement.

## Ranking And Placement

V1 ranking should be deterministic and server-authoritative:

1. Exclude anything not published, visible, and context-eligible.
2. Prefer exact primary-context matches.
3. Apply explicit Fairway curation priority.
4. Prefer trusted staff/approved-author content only as a controlled quality input.
5. Apply an abuse-resistant Helpful projection.
6. Use bounded recency so older evergreen tips do not disappear solely because of age.
7. Break ties deterministically.

Do not rank by public popularity, author follower count, handicap, raw shots, dispersion, session frequency, private performance trend, or other private telemetry in v1.

Future private personalization may be evaluated later. It must remain server-side, must never publish or expose the underlying private telemetry, and requires explicit privacy review and Product Acceptance before it changes placement behavior.

## Audit And Domain Events

Canonical event names:

- `community.tip.created`
- `community.tip.revision_created`
- `community.tip.submitted`
- `community.tip.published`
- `community.tip.hidden`
- `community.tip.removed`
- `community.tip.archived`
- `community.tip.restored`
- `community.tip.helpful_marked`
- `community.tip.helpful_withdrawn`
- `community.tip.reported`
- `community.tip.report_reviewed`

Meaningful audit records include actor, target tip/revision/report, previous and new state, reason, timestamp, and correlation/idempotency context.

Product analytics may consume selected events or explicit interactions later. Analytics and observability failures must never block authoring, moderation, reading, reporting, or Helpful operations.

Required operational diagnosis should distinguish:

- Author or moderator authorization rejection.
- Invalid/retired context key.
- Idempotency collision or duplicate retry.
- Superseded-revision publication attempt.
- Concurrent moderation conflict.
- Report persistence or queue-projection failure.
- Placement failure versus valid no-qualified-tip result.
- Analytics delivery failure, which remains non-blocking.

Logs and traces use stable Fairway IDs, rule versions, correlation IDs, and failure reasons. They must not include tip bodies, report details, display names, emails, raw telemetry, or other unnecessary PII.

## Privacy Boundary

### Community-visible

- Approved tip title and body.
- Approved contexts.
- Privacy-safe author display identity and authorized role badge.
- Optional approved source/provenance note.

### Moderator-restricted

- Draft and rejected revision content.
- Reports and report detail.
- Moderation reasons and history.
- Author eligibility restrictions.

### Private member data

- Raw shot data.
- Detailed practice sessions.
- Club baselines and trends.
- Handicap unless separately authorized for a future public use.
- Reservation and guest details.
- Helpful choices by identifiable member.
- Private placement inputs.

Contextual placement never authorizes publication of the context used to select a tip.

## Reliability And Security Invariants

- Creation, submission, Helpful changes, reports, and moderation actions are idempotent.
- Concurrent Helpful operations produce one effective current state.
- Concurrent moderation uses locked/current-state validation and cannot publish a superseded revision.
- Member ownership is checked through `MemberProfile`.
- Plain text is escaped at output; no member-supplied HTML executes.
- Removed content is excluded by server queries, not merely hidden in the browser.
- Rate limits and abuse controls are required before member authoring launches.
- Audit and revision retention are append-only even when member-visible content is removed.

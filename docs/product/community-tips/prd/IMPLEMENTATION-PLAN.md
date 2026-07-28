# Community Tips v1 Implementation Plan

**Status:** `PLANNING ONLY - NO IMPLEMENTATION APPROVED`
**Product requirements:** [`PRD.md`](PRD.md)
**Acceptance contract:** [`ACCEPTANCE-CRITERIA.md`](ACCEPTANCE-CRITERIA.md)

## 1. Delivery Strategy

Implement Community Tips as one bounded `community` module inside the existing Fairway modular monolith.

The recommended sequence establishes content truth and privacy before increasing member participation:

1. Accept the PRD.
2. Ship Fairway-curated reading and curation.
3. Add invited member drafts, consent, reports, and review.
4. Add private Helpful behavior and ranking refinement.
5. Consider challenge placement only after a Competition contract exists.

Do not create separate content, moderation, ranking, or recommendation services. PostgreSQL remains authoritative. Existing MemberProfile, authorization, audit, location, My Golf, analytics, and observability boundaries should be reused.

## 2. Phase Summary

| Phase | Objective | Product status |
|---|---|---|
| Phase 0 | Accept requirements, policy, risks, data contract, and delivery boundary. | Documentation only |
| Phase 1 | Fairway/staff-authored curated tips in My Golf club context. | First implementation candidate |
| Phase 2 | Invited pilot-member drafts, publication consent, review, reports, and moderation. | Follows Phase 1 acceptance |
| Phase 3 | Private Helpful signal and deterministic ranking refinement. | Follows stable read/moderation behavior |
| Phase 4 | Optional future challenge-context placement. | Deferred, separate approval |

Phases 1 through 3 define the intended v1 capability. Phase 4 is not part of v1 acceptance.

## 3. Phase 0: PRD Acceptance Only

### Objective

Approve the product contract without implementing runtime behavior.

### Required Outcomes

- Founder reviews and approves the six-document PRD package.
- The three founder decisions remain `LOCKED`.
- Remaining non-blocking decisions retain owners and decision points.
- The modular-monolith and Competition separation boundaries are accepted.
- Privacy, authorization, moderation, analytics, and Product Acceptance gates are accepted.
- DU1-v1 immutability remains explicit.

### Exit Criteria

- Founder decision: `APPROVED FOR IMPLEMENTATION PLANNING` or explicit remediation.
- No source, schema, migration, test, fixture, package, or runtime change is part of Phase 0.
- A future implementation slice identifies exactly which later phases it includes.

## 4. Phase 1: Staff/Fairway-Authored Curated Tips

### Objective

Prove that one trusted practice note adds value in My Golf without creating member-authoring or moderation volume.

### Included Product Behavior

- One canonical Community Tip identity with immutable revisions.
- Controlled v1 context taxonomy.
- Explicit network or location visibility.
- Fairway/staff role-based authorship.
- Explicit Community Tips curator/admin authorization.
- Curator create, revise, publish, hide, remove, archive, and permitted restore.
- Required moderation reason and audit history.
- My Golf club-context reading placement.
- Deterministic server-authoritative eligibility and ranking.
- Omit placement when no qualified tip exists.
- Member reporting may be implemented in Phase 1 only if its complete curator review path is also included; do not create an unowned report action.
- Domain events and non-blocking observability.

### Recommended Technical Boundary

Create only what the phase needs:

- `src/domains/community/` for lifecycle, policy, taxonomy, visibility, and ranking rules.
- `src/application/community-flow/` for member reading and curator use cases.
- Server routes/actions for member read and authorized curator mutation.
- PostgreSQL migrations for the approved Phase 1 subset.
- My Golf integration through the existing member application flow.
- Existing audit and MemberProfile boundaries for actor attribution.

Exact file paths are implementation guidance, not a requirement to refactor existing domains.

### Excluded From Phase 1

- Pilot-member drafts.
- Member publication consent.
- Helpful events.
- Public Helpful counts.
- Private telemetry.
- Home, session completion, Play Now, or challenge placement.
- Competition implementation.
- Organization/tenant support.

### Phase 1 Verification

- Domain tests for revision and publication lifecycle.
- Database integration tests for current revision, visibility, and audit.
- Server authorization tests for curator, ordinary member, operator, and Facilities.
- My Golf placement tests for Driver/Iron/Wedge context.
- Negative response tests for hidden, removed, archived, wrong-location, and no-qualified-tip states.
- Plain-text/XSS tests.
- Responsive, accessibility, loading, empty, error, and success-state Experience QA.
- Existing VS1B-VS1G and DU1 regressions remain green as applicable.

### Phase 1 Product Acceptance

- Human review confirms the tip feels like golf value, not a feed or promotion.
- My Golf hierarchy and accepted club metrics remain primary and coherent.
- No text implies private diagnosis or live professional instruction.
- `Curated by Fairway` treatment is understandable and restrained.

## 5. Phase 2: Invited Pilot-Member Draft Submission With Approval

### Objective

Test whether a small invited cohort can contribute useful practice observations without weakening trust or privacy.

### Included Product Behavior

- Server-authoritative invited-author eligibility.
- Member creates and edits only their own draft.
- Immutable member-authored revisions.
- Submit-for-review workflow.
- Every member revision requires review before publication.
- Display-name-only author projection.
- Explicit publication consent evidence.
- Publication fails closed without current consent.
- Curator review, return, publish, hide, remove, archive, and permitted restore.
- Report creation and curator report review.
- Consent withdrawal hides public content pending governed review.
- Rate limiting and abuse controls.
- Author-visible review outcome without report/moderation detail leakage.

### Required Operational Readiness

- One accountable curator/admin is assigned.
- Prohibited-content and moderation reason policy is available in the curator workflow.
- Internal queue-age monitoring exists.
- A small pilot cohort is named.
- Privacy review approves the author preview and consent language.
- Support/escalation path exists for safety, privacy, and access-security content.

### Excluded From Phase 2

- Direct member publication.
- Anonymous or pseudonymous publication.
- Instructor authority.
- Public profiles or performance badges.
- Appeals workflow.
- Automated report-count takedown.
- Arbitrary media, links, comments, or DMs.

### Phase 2 Verification

- Ownership tests for own/other draft and revision access.
- Invite eligibility tests.
- Consent-required publication tests.
- Consent withdrawal and fail-closed visibility tests.
- Universal member-revision review tests.
- Concurrent edit/review tests that reject superseded publication.
- Report privacy and report/publication lifecycle separation tests.
- Curator reason/audit reconstruction.
- Operator and Facilities least-privilege tests.
- Rate-limit and repeated-request tests.
- Mobile authoring/moderation accessibility and recovery tests.

### Phase 2 Product Acceptance

- Author understands draft, review, consent, and publication.
- Display-name preview is clear before consent.
- No private golfer data accompanies the public author identity.
- Moderator actions are state-driven, reasoned, and safe.
- Report receipts do not promise removal or expose restricted facts.

## 6. Phase 3: Helpful Signal And Ranking Refinement

### Objective

Add one private usefulness signal and use it carefully to improve tip quality without creating social validation.

### Included Product Behavior

- Helpful mark and withdrawal.
- Append-only/idempotent event history.
- One active Helpful projection per member and tip.
- Self-Helpful rejection.
- Hidden/removed tip rejection.
- Aggregate and individual Helpful behavior remain private.
- Server-authoritative ranking may use an abuse-resistant Helpful projection after context, visibility, and curation.
- Qualified Helpful Rate and related guardrails.

### Ranking Order

1. Exclude ineligible publication/visibility/context state.
2. Prefer exact primary context match.
3. Apply explicit Fairway curation priority.
4. Apply bounded trust/quality policy.
5. Apply abuse-resistant private Helpful projection.
6. Apply bounded recency.
7. Break ties deterministically.

Private performance/session telemetry remains excluded.

### Phase 3 Verification

- Mark/withdraw retry idempotency.
- Concurrent Helpful operations produce one current state.
- Self-Helpful rejection.
- Hidden/removed state conflict handling.
- No public aggregate or identifiable member choices.
- Ranking determinism and tie-break tests.
- Analytics outage does not block Helpful operations.
- Qualified Helpful Rate reconciliation from canonical events.

### Phase 3 Product Acceptance

- Helpful interaction feels quiet and useful, not like a social like button.
- No public popularity treatment appears.
- Ranking changes remain explainable from approved non-private inputs.

## 7. Phase 4: Optional Future Challenge-Context Placement

### Status

`DEFERRED - NOT COMMUNITY TIPS V1`

### Entry Conditions

- Competition domain is implemented and Product Accepted.
- Competition exposes a versioned, read-only context identity.
- Product evidence supports challenge-specific practice knowledge.
- Privacy review confirms only competition-visible facts are used.
- A separate PRD update and Product Acceptance plan are approved.

### Boundary

Community Tips may reference a Competition-owned challenge context for placement. It must not own or copy challenge rules, eligibility, scoring, rankings, divisions/flights, or results.

## 8. Dependencies

### Existing Fairway Dependencies

- Canonical `MemberProfile`.
- Server-side authentication and authorization.
- Existing role-assignment boundary.
- PostgreSQL transaction and migration conventions.
- Existing `AuditEvent` and domain-event discipline.
- Location identity for explicit location scope.
- My Golf club presentation context.
- DLS v0.1 and Fairway Experience QA harness.
- Standing Data & Observability Contract.
- Secret-safe Product Acceptance bundling.

### Product/Operational Dependencies

- Approved PRD package.
- Initial curated tip inventory.
- Assigned curator before member pilot.
- Approved consent language and author preview.
- Approved prohibited-content policy and reason labels.
- Retention decision before production launch.

### Non-Dependencies

Community Tips v1 does not depend on:

- Competition engine.
- Stripe, Kisi, GHIN/WHS, Uneekor, GSPro, waiver, or notification integration.
- Native mobile app.
- External content/community platform.
- AI or recommendation vendor.
- Multi-tenant SaaS configuration.

## 9. Sequencing And Commit Strategy

Each implementation phase should use small vertical commits:

1. Domain policy and tests.
2. Migration and persistence integration.
3. Server-side application use cases and authorization.
4. Member or curator experience.
5. Data/observability contract and verifier.
6. Experience QA and acceptance evidence.

Do not combine Phase 1, member authoring, Helpful ranking, and challenge context into one broad implementation.

## 10. Test And Verifier Expectations

### Automated Test Layers

- Unit: lifecycle, consent, taxonomy, visibility, ranking, reason policy.
- Integration: transactions, immutable revision persistence, current-state projection, audit, idempotency, concurrency.
- Authorization: role matrix and cross-member negative cases.
- Privacy: field-level response/event/log snapshots.
- Browser: member reading, authoring, reporting, curator review, responsive structure, accessibility.
- Regression: existing member, My Golf, operator, Facilities, guest, DU1, and Experience QA flows.

### Suggested Repeatable Verifier

A future implementation may add a bounded verifier such as:

```text
pnpm verify:community-tips:v1
```

The command name is planning guidance only. It must not replace focused tests or Product Acceptance.

### Required Failure Cases

- Direct member publish.
- Missing/withdrawn consent publication.
- Cross-member edit.
- Unauthorized operator/Facilities moderation.
- Invalid or retired context.
- Superseded revision publish.
- Hidden/removed discovery.
- Duplicate/concurrent Helpful or report.
- Private-data field leakage.
- Analytics/observability failure.
- Rate-limit/abuse rejection.

## 11. Product Acceptance Gates

Each implemented phase requires:

1. Functional Acceptance.
2. Privacy Acceptance.
3. Authorization and Moderation Acceptance.
4. Automated Experience QA.
5. Accessibility evidence.
6. Deterministic demo/evidence reconciliation.
7. Human Product Acceptance against the PRD, DLS, and Experience Brief.
8. Lightweight acceptance record only after explicit founder approval.

The complete gate definitions are in [`ACCEPTANCE-CRITERIA.md`](ACCEPTANCE-CRITERIA.md).

## 12. Demo And Evidence Strategy

Implementation evidence should use a separately versioned CT1 overlay referencing stable DU1 IDs.

The overlay must:

- Declare version, seed, clock, and fingerprint.
- Preserve accepted DU1 fingerprints.
- Own every Community Tips fact.
- Fail if it attempts to mutate DU1 records.
- Reconcile rendered tips, revisions, consent, moderation, reports, Helpful state, and placement to canonical overlay facts.
- Generate screenshots and reports from exact committed source.
- Exclude secrets and authenticated state.

Do not create or modify CT1 fixtures in this planning branch.

## 13. Explicitly Excluded Work

- Production implementation in this branch.
- Competition or challenge implementation.
- Home, session-completion, or Play Now placement in Phase 1.
- Fourth navigation destination or browse feed.
- Comments, DMs, follows, media, external-link posting.
- Public Helpful counts.
- Private telemetry personalization.
- AI coaching or generated instruction.
- Instructor authority.
- Multi-tenant organization configuration.
- External community platform.
- DU1 mutation.

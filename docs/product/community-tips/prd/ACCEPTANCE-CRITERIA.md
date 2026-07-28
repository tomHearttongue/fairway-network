# Community Tips v1 Acceptance Criteria

**Status:** `PLANNING - REQUIRED FOR FUTURE IMPLEMENTATION`
**Product requirements:** [`PRD.md`](PRD.md)
**Implementation phases:** [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)

Functional correctness does not equal Product Acceptance. Community Tips must earn objective acceptance and explicit human product approval.

## 1. Acceptance Model

1. Functional Acceptance proves domain behavior, persistence, authorization, idempotency, concurrency, and regression safety.
2. Privacy Acceptance proves private member data does not become content, metadata, telemetry, or explanation.
3. Moderation Acceptance proves governed content decisions and reconstructable history.
4. Automated Experience QA proves major routes/states are connected, responsive, accessible in proportional automated checks, and technically quiet.
5. Human Product Acceptance judges whether the experience feels like calm, premium Fairway practice knowledge rather than a social feed.

No implementation is Product Accepted until Tom explicitly accepts a commit-specific review package.

## 2. Functional Acceptance

### Content And Revision Lifecycle

- `CT-AC-FN-001`: Tip creation produces one canonical tip and one immutable initial revision.
- `CT-AC-FN-002`: Editing creates a new monotonic revision and never overwrites published history.
- `CT-AC-FN-003`: Only an approved current revision may be member-visible.
- `CT-AC-FN-004`: Published, hidden, removed, and archived content follows centralized valid transitions.
- `CT-AC-FN-005`: Report state remains separate from publication state.
- `CT-AC-FN-006`: Removed/archived content preserves revisions, reports, moderation, consent, and audit history.
- `CT-AC-FN-007`: Concurrent review cannot publish a superseded revision.

### Placement And Reading

- `CT-AC-FN-008`: My Golf returns at most one primary tip for an explicit supported club context.
- `CT-AC-FN-009`: Placement excludes draft, pending, hidden, removed, archived, expired-visibility, and wrong-location content.
- `CT-AC-FN-010`: No qualified tip produces an omitted optional module, not filler or an error.
- `CT-AC-FN-011`: V1 ranking is deterministic for the same canonical inputs.
- `CT-AC-FN-012`: Driver/Iron/Wedge mapping does not mutate or reinterpret canonical My Golf performance facts.

### Authoring And Consent

- `CT-AC-FN-013`: Only invited pilot members can create member-authored drafts.
- `CT-AC-FN-014`: A member can edit only their own draft or create a new revision of their own published tip.
- `CT-AC-FN-015`: Member submission does not publish directly.
- `CT-AC-FN-016`: Every member-authored revision requires curator approval.
- `CT-AC-FN-017`: Publication fails closed without explicit consent for display-name publication.
- `CT-AC-FN-018`: Consent applies to the current author projection and cannot be inferred from account creation or draft submission.
- `CT-AC-FN-019`: Consent withdrawal hides the public tip pending review and does not delete evidence.
- `CT-AC-FN-020`: Staff/Fairway content uses approved role identity and remains auditable.

### Helpful And Reports

- `CT-AC-FN-021`: Mark and withdrawal operations are idempotent.
- `CT-AC-FN-022`: Concurrent Helpful operations produce one effective current projection.
- `CT-AC-FN-023`: An author cannot mark their own tip Helpful.
- `CT-AC-FN-024`: Hidden/removed tips reject new Helpful marks.
- `CT-AC-FN-025`: One member cannot create duplicate active reports for the same tip/revision/reason context.
- `CT-AC-FN-026`: Reporting does not automatically alter publication state.

## 3. Privacy Acceptance

- `CT-AC-PRV-001`: Public author projection contains only approved display name for member content or approved role identity for Fairway/staff content.
- `CT-AC-PRV-002`: Public responses contain no handicap, rank, raw shots, club baselines, private session detail, practice frequency, guest data, reservation detail, or performance history.
- `CT-AC-PRV-003`: V1 placement queries and ranking inputs contain no private performance/session telemetry.
- `CT-AC-PRV-004`: Member-facing placement does not explain selection using private facts.
- `CT-AC-PRV-005`: Helpful-member identity and individual Helpful history are not community-visible.
- `CT-AC-PRV-006`: Reporter identity, report detail, rejected revisions, consent evidence, and moderation history are restricted.
- `CT-AC-PRV-007`: Facilities and unauthorized operators receive none of the restricted data above.
- `CT-AC-PRV-008`: Consent withdrawal removes public attribution through server-side eligibility, not only UI hiding.
- `CT-AC-PRV-009`: Analytics and logs exclude tip bodies, display names, emails, report detail, raw telemetry, and other unnecessary PII.
- `CT-AC-PRV-010`: Field-level response snapshots and event inspections prove minimization for reader, author, curator, operator, Facilities, and guest roles.

Privacy Acceptance fails on any unexplained private-data exposure.

## 4. Moderation Acceptance

- `CT-AC-MOD-001`: Publish, hide, remove, restore, and report-review actions require Fairway curator/admin authority.
- `CT-AC-MOD-002`: Every moderation action captures an allowed reason code.
- `CT-AC-MOD-003`: `other` requires restricted reason detail.
- `CT-AC-MOD-004`: Every action records actor, tip/revision/report, previous/new state, timestamp, and correlation/idempotency context.
- `CT-AC-MOD-005`: Staff-authored content cannot bypass moderation history.
- `CT-AC-MOD-006`: Reports can resolve with action or no action without rewriting the report allegation.
- `CT-AC-MOD-007`: Report-count thresholds do not automatically hide content.
- `CT-AC-MOD-008`: Restore is available only to approved admin/curator authority and requires reason.
- `CT-AC-MOD-009`: Concurrent moderator conflict fails safely and preserves the winning canonical action.
- `CT-AC-MOD-010`: Prohibited-content examples map to the locked reason policy.
- `CT-AC-MOD-011`: Author-facing outcomes do not expose reporter identity or restricted moderator notes.

## 5. Authorization Acceptance

| Capability | Member | Invited author | Staff author | Curator/admin | Operator | Facilities | Guest |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read eligible published tip | Yes | Yes | If member-eligible | Yes | Normal member right only | Normal member right only | No |
| Mark/withdraw Helpful | Yes | Yes | If member-eligible | If member-eligible | Normal member right only | Normal member right only | No |
| Report | Yes | Yes | If member-eligible | Yes | Normal member right only | Normal member right only | No |
| Create member draft | No | Own only | No implied right | Governed exception | No | No | No |
| Create Fairway/staff content | No | No | Explicit grant | Yes | No implied right | No | No |
| Publish/review | No | No | No implied right | Yes | No | No | No |
| Hide/remove/restore | No | No | No implied right | Yes, governed | No | No | No |
| View reports/history/consent | No | Own public outcome only | No implied right | Yes | No | No | No |

Required negative tests:

- UI-hidden controls cannot bypass server authorization.
- Operator role alone cannot publish or moderate.
- Facilities role cannot read restricted Community Tips data.
- Cross-member identifiers cannot be used to read or edit another author's draft.
- A role grant for one location/organization scope cannot silently apply elsewhere if future scoping is introduced.

## 6. UX And DLS Acceptance

- `CT-AC-UX-001`: Home, Play, and My Golf remain the only primary member navigation.
- `CT-AC-UX-002`: My Golf club context is the first reading placement.
- `CT-AC-UX-003`: The tip module remains secondary to the club's meaningful golfer value.
- `CT-AC-UX-004`: One focused tip appears; no infinite list or feed composition exists.
- `CT-AC-UX-005`: No qualified tip omits the module cleanly.
- `CT-AC-UX-006`: Member copy uses Tip, Practice note, Helpful, Report, Curated by Fairway, and Shared by [display name].
- `CT-AC-UX-007`: Member copy does not expose taxonomy, revision, ranking, moderation enum, or internal implementation language.
- `CT-AC-UX-008`: Tip copy does not imply diagnosis from My Golf metrics.
- `CT-AC-UX-009`: Helpful feels like a quiet usefulness action rather than a social like.
- `CT-AC-UX-010`: Authoring clearly separates draft submission, review, consent, and publication.
- `CT-AC-UX-011`: Public display-name preview is visible before consent.
- `CT-AC-UX-012`: Moderator actions are state-driven; invalid actions are absent or clearly unavailable.
- `CT-AC-UX-013`: Report confirmation says Fairway received the report without promising removal.
- `CT-AC-UX-014`: Loading, empty, success, error, reported, hidden/unavailable, blocked-author, and recovery states are intentional.
- `CT-AC-UX-015`: At 360-390 CSS pixels, tip, authoring, and moderation layouts remain full-width/readable without compressed columns or horizontal scrolling.
- `CT-AC-UX-016`: DLS v0.1 color, typography, spacing, border, radius, and motion guidance is preserved.
- `CT-AC-UX-017`: No social-media grammar, avatar wall, confetti, reactions, or vanity metrics appear.

Human Product Acceptance determines whether the experience feels premium, calm, golf-forward, and worthwhile.

## 7. Accessibility Acceptance

- Semantic heading order remains correct within My Golf and curator surfaces.
- Tip content and actions require no hover.
- Helpful, Report, authoring, consent, and moderation controls are keyboard operable.
- Interactive controls retain visible focus.
- Programmatic focus on non-interactive headings does not create persistent decorative chrome.
- Forms use persistent labels, associated descriptions, and inline errors.
- Consent is not preselected or inferred.
- Dialog focus is contained and returns to the invoking control.
- Status changes are announced accessibly.
- Touch targets meet Fairway's mobile intent.
- Color contrast targets WCAG 2.2 AA.
- Reduced motion is respected.
- Automated axe checks return zero unexplained serious/critical findings on accepted surfaces.

Automated accessibility evidence does not replace human review.

## 8. Analytics And Observability Acceptance

### Domain Truth

Canonical records and events exist for:

- Tip/revision creation.
- Submission.
- Consent grant/withdrawal.
- Publication and visibility changes.
- Helpful mark/withdrawal.
- Report and report outcome.
- Moderation action.

### Product Analytics

Proportional behavioral events may include:

- `community.tip.viewed`
- `community.tip.helpful_marked`
- `community.tip.helpful_withdrawn`
- `community.tip.authoring_started`
- `community.tip.submitted`
- `community.tip.reported`

Acceptance:

- Stable Fairway IDs and controlled dimensions are used.
- No synonymous duplicate events exist.
- Meaningful-view semantics are documented.
- Qualified Helpful Rate reconciles to canonical facts.
- Analytics outage does not fail member/curator transactions.
- Event payloads contain no prohibited content/PII fields.

### Technical Observability

Logs/traces/errors distinguish:

- Authorization rejection.
- Invalid/retired context.
- Idempotency collision.
- Superseded revision.
- Concurrent moderation conflict.
- Consent precondition failure.
- Placement failure versus valid no-result.
- Report persistence failure.
- Analytics delivery failure.

Operational evidence uses stable IDs, rule versions, correlation IDs, and controlled failure reasons rather than content bodies or PII.

## 9. Negative-Case Acceptance

The future implementation must prove:

1. Unauthorized member cannot create a draft.
2. Invited member cannot edit another member's draft.
3. Member cannot publish directly.
4. Member content cannot publish without valid consent.
5. Withdrawn consent removes public eligibility.
6. Operator cannot moderate without an explicit Community Tips role.
7. Facilities cannot access restricted data.
8. Guest cannot access Community Tips in v1.
9. Invalid/retired context cannot publish.
10. Superseded revision cannot publish.
11. Hidden/removed content cannot be discovered through direct identifiers.
12. Author cannot self-mark Helpful.
13. Duplicate/concurrent Helpful requests remain exactly-once effective.
14. Duplicate report attempts do not create unbounded records.
15. A report does not automatically hide content.
16. Private-data-leaking content can be reported and removed with complete history.
17. HTML/script input is rendered harmless or rejected.
18. Analytics/observability failure does not block transactions.
19. Rate limits fail safely.
20. CT1 overlay cannot mutate DU1-v1.

## 10. Demo And Evidence Acceptance

Use a future separately versioned CT1 overlay.

Required evidence:

- Exact implementation commit and clean source snapshot.
- CT1 version, seed, clock, and deterministic fingerprint.
- Accepted DU1 version/fingerprints unchanged.
- Curated, draft, pending, published, hidden, removed, archived, reported, consent, and Helpful facts reconciled.
- My Golf Driver/Iron/Wedge placement screenshots.
- New-member no-private-history behavior.
- Member authoring and display-name consent states.
- Curator submission/report review.
- Operator/Facilities negative-privilege evidence.
- Responsive mobile-primary, mobile-compact, desktop, and presentation evidence where material.
- Accessibility findings.
- Console and failed-network classification.
- Secret/path/authenticated-state exclusion.
- Per-file hashes and exact bundle provenance.

Review screenshots must visibly prove their declared state. Automated assertions alone are insufficient for Human Product Acceptance.

## 11. Product Acceptance Review Requirements

The review package must answer:

- Does this make My Golf more useful without looking like a feed?
- Is the advice concrete and golf-specific?
- Does placement avoid implying private diagnosis?
- Is public member identity understandable and consensual?
- Are staff role and member display-name treatments honest?
- Are moderation and report outcomes fair and clear?
- Does Helpful avoid vanity/social pressure?
- Are empty, blocked, error, and removed states calm and recoverable?
- Does mobile remain readable and focused?
- Is all review evidence tied to exact committed facts?

Possible outcomes:

- `PASS`
- `PASS WITH REFINEMENT`
- `FAIL PRODUCT ACCEPTANCE`

No acceptance record is created until Tom explicitly approves the reviewed commit.

## 12. Phase Gate Matrix

| Acceptance area | Phase 1 | Phase 2 | Phase 3 |
|---|---:|---:|---:|
| Tip/revision lifecycle | Required | Regression | Regression |
| Curator authorization/audit | Required | Expanded | Regression |
| My Golf placement | Required | Regression | Ranking update |
| Member authoring/consent | Not included | Required | Regression |
| Reports/moderation queue | If complete path included | Required | Regression |
| Helpful behavior | Not included | Not included | Required |
| Privacy field inspection | Required | Expanded | Expanded |
| UX/accessibility | Required | Expanded | Expanded |
| Deterministic CT1 evidence | Required subset | Expanded | Full v1 |
| Human Product Acceptance | Required | Required | Required |

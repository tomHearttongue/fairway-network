# Community Tips v1 Product Requirements Document

**Status:** `PLANNING - FOUNDER REVIEW REQUIRED`
**Product:** Fairway Network
**Capability:** Community Tips v1
**Source discovery:** [`../README.md`](../README.md)
**Technical planning:** [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)
**Acceptance contract:** [`ACCEPTANCE-CRITERIA.md`](ACCEPTANCE-CRITERIA.md)

This package converts the merged Community Tips discovery into implementation-ready product requirements. It does not approve or implement production code.

## 1. Executive Summary

Community Tips is structured, contextual practice knowledge. It is not a social network.

V1 should place one trusted practice tip inside the existing My Golf club context. Fairway and explicitly authorized staff publish the initial curated inventory. Invited pilot members may later create drafts, but member-authored content cannot become public without curator approval and explicit display-name consent for the current publication.

Fairway owns canonical tips, revisions, contexts, visibility, moderation, Helpful events, reports, consent evidence, and audit history. Community Tips must not publish, infer, or expose private practice telemetry. It must not require Competition, a fourth primary navigation destination, or an external community platform.

Recommended release boundary:

1. Curated staff/Fairway tips in My Golf.
2. Invited pilot-member drafts with governed review and consent.
3. Private Helpful signal and bounded ranking refinement.

Future challenge-context placement is not part of v1.

## 2. Product Problem

Fairway members can practice and inspect their golfer identity, but the product does not yet surface the useful, practical knowledge already present in the club.

Generic golf content is plentiful. The missing product value is one concise, credible practice idea that fits the golfer's explicit current context without pretending to diagnose private performance.

The product problem is not a lack of posting or social activity. It is a lack of trusted, contextual practice guidance at the moment a member is thinking about a club.

## 3. Product Hypothesis

If Fairway places one short, trusted tip in a clear golf context, members will feel more confident about what to practice and will perceive greater value from My Golf.

Fairway should test whether members:

- Meaningfully view context-eligible tips.
- Mark useful tips Helpful.
- Return to practice after useful exposures.
- Begin Play Now after a contextual tip exposure.
- Need fewer repeated staff explanations for covered topics.
- Contribute a manageable amount of publishable knowledge when invited.

These are hypotheses. V1 must measure behavior without claiming causation or inventing benchmark targets.

## 4. Product Principles

| ID | Requirement | Status | Scope |
|---|---|---|---|
| `CT-PP-001` | Community Tips is structured, contextual practice knowledge, not a social network. | `LOCKED` | network |
| `CT-PP-002` | Context comes before navigation; Home, Play, and My Golf remain the only primary member destinations in v1. | `LOCKED` | member UX |
| `CT-PP-003` | Practice relevance and trust are more important than content volume or publishing speed. | `LOCKED` | network |
| `CT-PP-004` | Fairway owns canonical content, revisions, visibility, moderation, usefulness, consent evidence, and audit history. | `LOCKED` | network |
| `CT-PP-005` | Private context never authorizes publication of private performance, session, or identity facts. | `LOCKED` | privacy |
| `CT-PP-006` | Human moderation remains accountable; reports do not automatically rewrite publication state. | `LOCKED` | network |
| `CT-PP-007` | Empty space is preferable to an irrelevant or unqualified tip. | `LOCKED` | member UX |
| `CT-PP-008` | Community Tips and Competition remain logically independent for MVP. | `LOCKED` | architecture |
| `CT-PP-009` | Analytics and observability are non-blocking consumers, never transactional authority. | `LOCKED` | data |
| `CT-PP-010` | Any deterministic Community Tips demo data extends DU1 through a separate versioned overlay and never mutates DU1-v1. | `LOCKED` | demo |

## 5. MVP Scope

### 5.1 Included

| ID | Requirement | Status | Scope |
|---|---|---|---|
| `CT-FR-001` | An eligible member can read one published tip in My Golf when the visible club context matches an approved context. | `LOCKED` | member UX |
| `CT-FR-002` | Fairway/admin-curator users can create, revise, approve, publish, hide, remove, archive, and permittedly restore tips through server-authoritative actions. | `LOCKED` | network |
| `CT-FR-003` | Fairway/staff-authored published tips use an approved role identity rather than private staff identity data. | `LOCKED` | network |
| `CT-FR-004` | An invited pilot member can create and revise only their own draft and submit it for review. | `LOCKED` | member |
| `CT-FR-005` | A pilot member cannot publish directly. Every member-authored revision requires approval before it becomes visible. | `LOCKED` | network |
| `CT-FR-006` | A member-authored tip can publish with display name only after explicit publication consent. | `LOCKED` | member/privacy |
| `CT-FR-007` | A member can mark a published tip Helpful or withdraw that signal; the aggregate signal remains private in v1. | `LOCKED` | member |
| `CT-FR-008` | A member can report an eligible published tip using controlled reason input. | `LOCKED` | member |
| `CT-FR-009` | Authorized curator/admin users can review submissions and reports without exposing report details or moderation history to ordinary members. | `LOCKED` | network |
| `CT-FR-010` | Tips use controlled, versioned club, practice-intent, and preparation contexts rather than free-form tags. | `LOCKED` | network |
| `CT-FR-011` | Publication, revision review, report review, and Helpful state remain separate lifecycles. | `LOCKED` | network |
| `CT-FR-012` | Every moderation action records actor, reason, previous/new state, timestamp, and correlation/idempotency context. | `LOCKED` | audit |
| `CT-FR-013` | V1 placement is deterministic and server-authoritative using explicit surface context, eligibility, visibility, curation, bounded recency, and private Helpful projection. | `LOCKED` | network |
| `CT-FR-014` | If no qualified tip exists, the host surface omits the optional module. | `LOCKED` | member UX |

### 5.2 Controlled V1 Taxonomy

The initial taxonomy uses stable machine keys and member-facing labels.

Club context:

- `driver`
- `iron`
- `wedge`

Practice intent:

- `warmup`
- `tempo`
- `alignment`
- `dispersion`
- `distance_control`
- `pre_shot_routine`

Facility and preparation:

- `simulator_setup`
- `session_preparation`
- `suite_etiquette`

Requirements:

- Every publishable revision has exactly one primary context.
- Secondary contexts are optional and controlled.
- Free-form tags are excluded.
- Specific clubs such as 7 Iron or PW may map to the `iron` or `wedge` group without changing My Golf performance facts.
- Putting and challenge contexts are deferred until supported by truthful product contracts.

## 6. Non-Goals

Community Tips v1 does not include:

- A generic feed or fourth primary navigation destination.
- Comments, replies, threads, DMs, followers, or social graphs.
- Public Helpful counts, author leaderboards, or social popularity scoring.
- Arbitrary media, rich embeds, files, promotional links, or external-link posting.
- Anonymous or pseudonymous publication.
- Creator monetization, sponsorships, paid promotion, or tipping.
- AI coaching, swing diagnosis, Improvement Score, or generated instruction.
- Approved-instructor authoring or professional-instructor marketplace behavior.
- Private performance/session telemetry in ranking or placement.
- Public exposure of handicap, rank, raw shots, club baselines, session detail, practice frequency, or performance history.
- Guest authoring or Facilities community privileges.
- Competition rules, scoring, rankings, divisions/flights, results, or challenge implementation.
- Multi-tenant SaaS configuration, organization provisioning, or cross-tenant sharing.
- An external community/content platform as canonical source of truth.

## 7. Locked Founder Decisions

The three former discovery blockers are now locked for MVP. Full rationale and revisit conditions are in [`FOUNDER-DECISIONS.md`](FOUNDER-DECISIONS.md).

### 7.1 Public Author Identity And Consent

| ID | Requirement | Status |
|---|---|---|
| `CT-BP-001` | Fairway/staff-authored tips publish with approved role identity. | `LOCKED` |
| `CT-BP-002` | Invited pilot-member tips may publish with display name only. | `LOCKED` |
| `CT-BP-003` | Explicit consent is required before publication of each member-authored public identity treatment; submission may occur before consent is granted. | `LOCKED` |
| `CT-BP-004` | Author identity excludes handicap, rank, shots, sessions, practice frequency, performance history, and private telemetry. | `LOCKED` |
| `CT-BP-005` | Anonymous and pseudonymous publication are excluded from v1. | `LOCKED` |
| `CT-BP-006` | Consent withdrawal blocks continued public attribution. The safe default is to hide the tip pending review; conversion to Fairway-curated/internal content requires a governed decision and must not silently retain the member attribution. | `LOCKED` |

### 7.2 Moderator Authority

| ID | Requirement | Status |
|---|---|---|
| `CT-BP-007` | Fairway admin/curator owns publish, hide, remove, restore, and report review authority. | `LOCKED` |
| `CT-BP-008` | Ordinary operator status does not imply Community Tips authority. | `LOCKED` |
| `CT-BP-009` | Facilities roles receive no Community Tips privileges by default. | `LOCKED` |
| `CT-BP-010` | Every moderation action requires reason capture and audit history. | `LOCKED` |
| `CT-BP-011` | Moderation history and report details are restricted to authorized curator/admin roles. | `LOCKED` |
| `CT-BP-012` | Staff-authored content remains subject to moderation and audit. | `LOCKED` |

### 7.3 Prohibited Content

V1 prohibits:

- Abuse, harassment, and discriminatory language.
- Spam, promotions, and solicitation.
- Impersonation.
- Private-data exposure or inference about another member.
- Unsafe advice or medical claims.
- Gambling or wagering prompts.
- Illegal conduct.
- Sexual content.
- Political campaigning.
- Unsupported professional-instruction claims.
- Swing diagnosis presented as professional instruction unless a later approved instructor/staff policy authorizes it.
- Facility-security or access-circumvention advice.
- Content that undermines safe use of the facility or equipment.

Required moderation reason codes:

- `abusive_or_harassing`
- `discriminatory`
- `spam_or_promotion`
- `private_data_exposure`
- `unsafe_or_medical_claim`
- `unauthorized_instruction_claim`
- `impersonation`
- `facility_safety_or_security`
- `irrelevant_or_low_quality`
- `duplicate`
- `other`

## 8. Target Users And Authorization Roles

| Actor | Product need | V1 authority |
|---|---|---|
| Active member reader | Receive one relevant practice tip without a feed or privacy exposure. | Read eligible published tips, mark/withdraw Helpful, report. |
| Invited pilot-member author | Share one useful practice observation safely. | Create/edit own drafts, submit, view own outcome, consent to display-name publication. |
| Fairway staff author | Create trustworthy operational or practice content. | Author Fairway/staff content only when explicitly granted; no implied moderation authority. |
| Fairway curator/admin | Protect quality, visibility, trust, and policy. | Publish, review, hide, remove, restore, review reports, inspect restricted history. |
| Ordinary operator | Operate a location without inheriting content power. | Normal member rights only unless separately granted Community Tips authority. |
| Facilities actor | Service facility inventory with least privilege. | No Community Tips privileges by default. |
| Guest | Participate in a host session without community identity. | No Community Tips access in v1. |

All authorization is enforced server-side. UI visibility is never sufficient enforcement.

## 9. Jobs To Be Done

### Member reviewing My Golf

When I inspect a club, show one concise, relevant practice note so I have a useful next-session idea without implying that Fairway diagnosed my swing.

### Member responding to quality

When a tip helps, let me say so with one quiet action without creating a popularity contest.

### Invited member sharing knowledge

When I have a useful practice observation, let me draft it in a structured context, understand the review process, and explicitly approve the display name used before publication.

### Fairway staff author

When Fairway needs to share safe setup, preparation, or practice knowledge, let an explicitly authorized staff author create governed, role-attributed content.

### Curator/admin

When content is submitted or reported, give me the revision, context, authorship/consent state, policy reasons, and history required for a reconstructable decision.

## 10. Primary User Flows

### 10.1 Curated Tip Publication

1. Authorized staff/curator begins a plain-text tip.
2. The author selects one primary controlled context and optional secondary contexts.
3. The system creates an immutable revision.
4. The curator validates role identity, visibility scope, content policy, and provenance.
5. An authorized publish action records reason and audit.
6. The approved revision becomes eligible for My Golf placement.

### 10.2 Member Reading In My Golf

1. Member opens a supported club context in My Golf.
2. Server resolves published, visible tips for that explicit club group.
3. Server applies deterministic v1 ranking without private telemetry.
4. The surface renders at most one primary tip.
5. Member may mark Helpful, report, or move on.
6. No eligible result means the optional module is omitted.

### 10.3 Pilot-Member Draft And Publication

1. Invited member begins from a supported context.
2. Member enters a plain-text title, body, and optional provenance note.
3. System creates an immutable draft revision linked to canonical `MemberProfile`.
4. Member submits the draft for review.
5. Curator reviews content, context, public display-name treatment, and consent evidence.
6. Publication is blocked until explicit consent covers the display name and current publication.
7. Curator publishes with a reason, returns to draft, or removes under policy.
8. Published edits create a new revision and repeat review/consent validation; the current approved revision remains visible unless separately hidden.

### 10.4 Reporting And Moderation

1. Member reports the revision they viewed using a controlled reason and optional detail.
2. Report becomes moderator-restricted and does not automatically hide the tip.
3. Curator/admin reviews the report and current tip/revision state.
4. Curator records a governed outcome and reason.
5. Visibility changes take effect server-side.
6. Ordinary members receive only a neutral report receipt or author outcome, never reporter identity or restricted detail.

### 10.5 Consent Withdrawal

1. Member author withdraws public-attribution consent through an approved pathway.
2. System makes the public tip ineligible by hiding it pending curator review.
3. Curator may leave it hidden, remove it, archive it, or create a separately governed Fairway-curated/internal record.
4. The system never silently leaves the member display name public or silently rewrites historical consent/audit facts.

## 11. Information Architecture And Placement

Primary navigation remains:

- Home
- Play
- My Golf

V1 placement order:

| Placement | Decision | Rationale |
|---|---|---|
| My Golf club context | `V1 FIRST` | Safest explicit golf context and no interruption to Play Now. |
| Session completion | `LATER V1 EVALUATION` | Useful continuity, but must not imply unrecorded analysis or compete with accepted completion UX. |
| Home | `LIMITED PILOT AFTER EVIDENCE` | Must remain below Play Now and disappear when no qualified tip exists. |
| Play Now preparation | `DEFERRED` | Must not slow quote, confirmation, access, or Start Session. |
| Challenge detail | `DEFERRED` | Requires a truthful Competition-owned context contract. |
| Community/Compete destination | `EXCLUDED V1` | Requires future evidence and separate Product Acceptance. |

Member language should prefer:

- Tip
- Practice note
- Suggested for your session
- Curated by Fairway
- Shared by [display name]
- Helpful
- Report

Avoid feed, post, followers, viral, influencer, and internal lifecycle labels.

## 12. Privacy Principles

| ID | Requirement | Status |
|---|---|---|
| `CT-PRV-001` | V1 ranking and placement do not use private performance or session telemetry. | `LOCKED` |
| `CT-PRV-002` | Contextual placement never publishes or explains private member facts. | `LOCKED` |
| `CT-PRV-003` | Public member author identity is display name only and requires explicit publication consent. | `LOCKED` |
| `CT-PRV-004` | Individual Helpful choices are private behavioral data. | `LOCKED` |
| `CT-PRV-005` | Reports, report detail, rejected drafts, moderation reasons, and moderation history are restricted. | `LOCKED` |
| `CT-PRV-006` | Analytics excludes tip bodies, display names, emails, report detail, raw shots, sessions, handicap, and private performance values. | `LOCKED` |
| `CT-PRV-007` | Facilities and unauthorized operators receive no draft, report, consent, or moderation data. | `LOCKED` |
| `CT-PRV-008` | Future private personalization requires explicit privacy review and Product Acceptance and may never expose its underlying telemetry. | `DEFERRED` |

## 13. Business Model Flexibility

Community Tips must preserve one Fairway-owned product model across potential deployments without implementing multi-tenant infrastructure in v1.

### Deployment Models

| Deployment | Product interpretation |
|---|---|
| Single Fairway-owned location | Fairway owns network policy and local content responsibility. |
| Multiple Fairway-owned locations | Network tips may be shared; setup and etiquette remain explicitly location-scoped. |
| Software-only third-party licensed facility | A future organization may operate Community Tips through Fairway software and receive bounded staff/curation authority under Fairway network trust and isolation policy. |
| Hybrid owned-location plus SaaS/network deployment | Fairway-owned and licensed locations may share approved network knowledge while organization/location content remains explicit. |

### Potential Scope Dimensions

| Scope | V1 treatment | Future option |
|---|---|---|
| Network | Supported for Fairway-curated golf/practice tips. | Shared network knowledge and policy. |
| Organization/tenant | Not implemented. | Third-party staff authority and organization policy after isolation review. |
| Location | Supported where setup/etiquette differs. | Local operational knowledge. |
| Challenge/context | Not implemented. | Reference Competition-owned versioned context. |
| Member-authored | Invited drafts with approval and consent. | Broader eligibility only after measured pilot. |
| Staff-authored | Explicit Community Tips role required. | Organization/location staff after future tenancy policy. |
| Fairway-curated | Initial published inventory. | Network quality baseline. |
| Privately personalized | Not used in v1. | Future server-side placement after privacy acceptance. |
| Community-visible | Approved tips and approved author projection only. | Never includes private placement inputs. |

Packaging may contribute to Location OS, Golfer Identity/My Golf, an Engagement Layer, or a Network Layer. Packaging does not create separate sources of truth or services.

## 14. Competition Separation

Competition owns:

- Challenges and events.
- Rules and eligibility.
- Scoring and validation.
- Rankings.
- Divisions and flights.
- Competition results.

Community Tips owns:

- Structured practice knowledge.
- Authorship and consent.
- Revisions.
- Context taxonomy.
- Moderation and reports.
- Helpful events.
- Visibility and placement.

A future placement may reference a versioned Competition-owned challenge ID. Community Tips must not copy or interpret challenge rules/results, and Competition must not become tip or moderation authority.

Neither domain depends on the other for MVP. Community Tips v1 must not require implementing the Competition engine.

## 15. Success Metrics And Data Contract

The standing Data & Observability Contract applies.

### Primary KPI

`Qualified Helpful Rate`:

> Unique members with an active Helpful signal divided by unique members with a meaningful view of an eligible tip.

The meaningful-view definition must be documented before instrumentation and must avoid unnecessary attention surveillance.

### Leading Indicators

- Eligible placement rate.
- Meaningful tip-view rate.
- Helpful mark and withdrawal rate.
- Invited-author draft start and submission rate.
- Submission-to-publication rate.
- Report rate by controlled category.
- Moderator queue age and workload.

### Outcome Indicators

- Median interval to next completed session after exposure.
- Play Now initiation after contextual exposure.
- New-member activation after exposure.
- Repeat helpful behavior across sessions.
- Staff support-question trend for covered topics.

Outcome indicators are correlational until a valid evaluation design supports stronger claims.

### Guardrails

- Privacy incident count.
- Hidden/removed rate.
- Unsafe/medical/security report rate.
- Spam and duplicate rate.
- Moderator queue age.
- Author abandonment rate.
- Irrelevant-placement dismissal rate.
- Accessibility failures.
- Authorization denials and suspicious retry/conflict rates.

### Stable Dimensions

- `tip_id`
- `tip_revision_id`
- `placement_id` or placement key
- `context_key`
- `viewer_member_profile_id`
- `author_member_profile_id` only in authorized records
- `location_id` only when applicable
- `moderation_status`
- `report_reason`
- `surface`
- `ranking_rule_version`

Detailed conceptual records and events are defined in [`DATA-CONTRACT.md`](DATA-CONTRACT.md).

## 16. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| `CT-NFR-001` | All authoring, publication, reporting, visibility, and moderation authorization is enforced server-side. | `LOCKED` |
| `CT-NFR-002` | Creation, submission, Helpful changes, reports, consent, and moderation actions are idempotent. | `LOCKED` |
| `CT-NFR-003` | Concurrent moderation cannot publish a superseded revision or lose an intervening visibility change. | `LOCKED` |
| `CT-NFR-004` | Content revisions, consent evidence, moderation actions, and audit history are append-only or historically reconstructable. | `LOCKED` |
| `CT-NFR-005` | Plain text is escaped at output; member-supplied HTML or executable content is rejected. | `LOCKED` |
| `CT-NFR-006` | Removed/hidden content is excluded by server queries, not browser-only filtering. | `LOCKED` |
| `CT-NFR-007` | Community Tips remains one module in the modular monolith; no new service is required for v1. | `LOCKED` |
| `CT-NFR-008` | Analytics/observability outage never blocks core Community Tips transactions. | `LOCKED` |
| `CT-NFR-009` | Member-facing surfaces meet Fairway's WCAG 2.2 AA intent and DLS v0.1 acceptance standards. | `LOCKED` |
| `CT-NFR-010` | Location scope is explicit and never inferred from author home location. | `LOCKED` |
| `CT-NFR-011` | V1 supports rate limiting and abuse controls before pilot-member authoring launches. | `LOCKED` |
| `CT-NFR-012` | Review evidence is deterministic, secret-safe, commit-specific, and cannot mutate DU1-v1. | `LOCKED` |

## 17. Remaining Non-Blocking Decisions

These do not prevent implementation planning:

| Decision | Recommended default | Required by |
|---|---|---|
| Pilot cohort size and invitation mechanics | Small manually invited cohort of active members in good standing. | Before Phase 2 pilot launch |
| Moderator response target | No public SLA; measure internal queue age and establish an operating target before pilot launch. | Before Phase 2 pilot launch |
| Title/body character limits | Validate concise limits during UX implementation; preserve one idea per tip. | Before Phase 2 Product Acceptance |
| Exact launch tip inventory | Small reviewed Fairway collection covering each enabled context. | Before Phase 1 Product Acceptance |
| Numeric pilot continuation thresholds | Instrument first; approve thresholds before evaluating pilot continuation. | Before pilot evaluation |
| Data retention periods | Define with privacy/legal/security review before production launch. | Before production launch |
| Member-facing role badge copy | Use `Curated by Fairway` for Fairway content; validate any staff-role label in Product Acceptance. | Before Phase 1 Product Acceptance |

## 18. Release Recommendation

1. Founder reviews and accepts this PRD package as Phase 0.
2. Phase 1 may proceed as a bounded curated-tip implementation after acceptance.
3. Phase 2 member authoring launches only after an accountable curator is assigned, prohibited-content operations are ready, rate limits exist, and privacy acceptance passes.
4. Phase 3 Helpful/ranking refinement follows a stable reading and moderation foundation.
5. Phase 4 challenge placement remains deferred and requires a separate product decision plus Competition contract.

No phase is approved for implementation by this documentation branch.

## 19. Traceability

| Product requirement area | Planning artifact |
|---|---|
| Locked founder decisions | [`FOUNDER-DECISIONS.md`](FOUNDER-DECISIONS.md) |
| Conceptual entities, events, privacy | [`DATA-CONTRACT.md`](DATA-CONTRACT.md) |
| Phases, dependencies, verification | [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) |
| Functional and Product Acceptance | [`ACCEPTANCE-CRITERIA.md`](ACCEPTANCE-CRITERIA.md) |
| Risks and escalation | [`RISK-REGISTER.md`](RISK-REGISTER.md) |

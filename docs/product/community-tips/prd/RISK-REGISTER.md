# Community Tips v1 Risk Register

**Status:** `PLANNING - ACTIVE THROUGH IMPLEMENTATION`
**Product requirements:** [`PRD.md`](PRD.md)

Severity:

- `CRITICAL`: Privacy, safety, security, or product-truth failure that blocks launch/acceptance.
- `HIGH`: Material trust, authorization, moderation, or usability failure.
- `MEDIUM`: Meaningful operational, measurement, or extensibility risk.
- `LOW`: Bounded polish or efficiency risk.

Owners are accountable roles, not named individuals.

## Risk Register

| ID | Category | Risk | Severity | Owner | Mitigation | Escalation trigger |
|---|---|---|---|---|---|---|
| `CT-R-001` | Product | Community Tips becomes a generic feed or fourth destination. | `HIGH` | Product/Founder | My Golf-first, one tip, no feed/nav, omit when irrelevant. | Proposal adds browse/feed/nav before contextual evidence and Product Acceptance. |
| `CT-R-002` | Product | Content feels generic, promotional, or lower value than My Golf. | `HIGH` | Product + Curator | Curated-first inventory, controlled taxonomy, quality policy, human review. | Repeated low Helpful behavior, dismissals, or human review finds filler. |
| `CT-R-003` | Product | My Golf placement implies diagnosis from private metrics. | `CRITICAL` | Product + Privacy | Explicit club context only; no private telemetry; careful copy and negative evidence. | UI or logs explain selection using carry, dispersion, handicap, trends, or sessions. |
| `CT-R-004` | Privacy | Member author identity exposes more than consented display name. | `CRITICAL` | Privacy + Engineering | Versioned consent, approved projection, field-level tests, fail-closed publication. | Any public payload contains unapproved identity/performance facts. |
| `CT-R-005` | Privacy | Consent withdrawal leaves public attribution visible. | `CRITICAL` | Privacy + Community Curator | Immediate server-side ineligibility/hide and governed follow-up. | Public retrieval remains possible after withdrawal. |
| `CT-R-006` | Privacy | Helpful, report, or moderation data leaks to members/operators/Facilities. | `CRITICAL` | Engineering + Security | Server role matrix, minimized projections, response/event snapshots. | Unauthorized role receives reporter, Helpful member, reason detail, or history. |
| `CT-R-007` | Privacy | Tip content or analytics discloses private practice/performance data. | `CRITICAL` | Privacy + Data | Prohibited-content policy, moderation, field allowlists, no private telemetry in v1. | Private golf/session data appears in content, events, logs, or placement explanation. |
| `CT-R-008` | Moderation | No accountable human owns queues. | `HIGH` | Founder/Product | Assign curator before Phase 2; monitor queue age; bound pilot size. | Queue exceeds operating target or privacy/safety reports remain unreviewed. |
| `CT-R-009` | Moderation | Reason policy is applied inconsistently. | `HIGH` | Community Curator | Locked categories, required reason, audit, review calibration. | Frequent `other`, conflicting outcomes, or author complaints indicate ambiguity. |
| `CT-R-010` | Moderation | Reports automatically suppress legitimate content or enable coordinated abuse. | `HIGH` | Community Curator + Engineering | Separate report/publication state; human decision; no report-count auto-hide. | Any count threshold changes visibility without authorized action. |
| `CT-R-011` | Moderation | Staff content bypasses review/audit because staff is trusted. | `HIGH` | Community Curator | Staff content uses explicit role and governed publication/audit. | Staff-authored content lacks revision, reason, or actor history. |
| `CT-R-012` | Safety | Unsafe, medical, security, or unauthorized instruction content is published. | `CRITICAL` | Community Curator + Safety/Security | Prohibited policy, review, report path, reason codes, escalation. | Report or review identifies credible risk to member/facility safety or access security. |
| `CT-R-013` | Authorization | Operator or Facilities role inherits Community Tips authority. | `CRITICAL` | Security + Engineering | Separate explicit grants and server-side tests. | Role-only operator/Facilities request can author, publish, moderate, or inspect restricted data. |
| `CT-R-014` | Authorization | Member edits or accesses another member's draft. | `CRITICAL` | Engineering | Canonical MemberProfile ownership checks and negative tests. | Cross-member identifier returns or mutates restricted content. |
| `CT-R-015` | Technical | Mutable content destroys revision/audit history. | `HIGH` | Engineering | Immutable revisions and append-only moderation/consent evidence. | Published title/body changes without a new revision. |
| `CT-R-016` | Technical | Concurrent review publishes a superseded or invalid revision. | `HIGH` | Engineering | Transactional current-state validation and concurrency tests. | Two reviewers create conflicting effective publication state. |
| `CT-R-017` | Technical | Helpful/report retries create duplicate effects. | `MEDIUM` | Engineering | Idempotency keys, unique effective-state constraints, concurrency tests. | Repeated request changes counts or creates duplicate active reports. |
| `CT-R-018` | Security | Member text executes as HTML/script or unsafe link. | `CRITICAL` | Security + Engineering | Plain text only, output escaping, no arbitrary links/media, security tests. | Stored or reflected executable content is observed. |
| `CT-R-019` | UX | Author confuses draft submission with public consent/publication. | `HIGH` | Product/UX + Privacy | Separate state language, preview, unambiguous consent, Product Acceptance. | User testing cannot distinguish submitted, approved, consented, or public. |
| `CT-R-020` | UX | Helpful feels like social validation or popularity ranking. | `MEDIUM` | Product/UX | Private count, restrained action, no reactions/leaderboards. | UI emphasizes totals, status, or social comparison. |
| `CT-R-021` | UX | Tip placement crowds accepted My Golf or mobile layout. | `HIGH` | Product/UX | Secondary hierarchy, one tip, full-width mobile, responsive assertions. | Club value/primary actions become less clear or layout compresses at 360-390 px. |
| `CT-R-022` | Accessibility | Reading, report, consent, or moderation is inaccessible. | `HIGH` | Product/UX + Engineering | Semantic controls, focus, labels/errors, status announcements, WCAG checks. | Serious/critical axe issue or keyboard journey fails. |
| `CT-R-023` | Operations | Pilot author volume exceeds curator capacity. | `HIGH` | Founder + Community Curator | Manual cohort, queue-age guardrail, staged expansion. | Queue age exceeds target or unsafe reports are delayed. |
| `CT-R-024` | Measurement | Metrics imply causation or collect excessive attention data. | `MEDIUM` | Product + Data/Privacy | Correlational language, minimal meaningful-view definition, privacy review. | Decision materials claim retention lift without valid design or payloads collect invasive detail. |
| `CT-R-025` | Measurement | Analytics outage blocks product transactions. | `HIGH` | Engineering | Transactional domain truth, non-blocking consumers, failure injection. | View/Helpful/author/moderation operation fails because analytics is unavailable. |
| `CT-R-026` | Business model | V1 hardcodes Fairway-owned-location assumptions. | `MEDIUM` | Architecture/Product | Explicit network/location scope; future organization boundary without implementation. | Core records infer scope from one location or author home location. |
| `CT-R-027` | Business model | Premature tenant abstractions slow MVP or weaken isolation. | `MEDIUM` | Architecture | No organization/tenant implementation in v1; later isolation review. | Proposal adds tenant provisioning/policy inheritance without approved deployment need. |
| `CT-R-028` | Architecture | Community Tips absorbs Competition rules or depends on its engine. | `HIGH` | Architecture/Product | Reference-only future context; explicit domain ownership. | Tip schema/workflow copies rules, results, rankings, or blocks on Competition. |
| `CT-R-029` | Architecture | External content/moderation vendor becomes canonical authority. | `HIGH` | Architecture | Fairway-owned records and adapters only for commodity capabilities. | Vendor ID/payload replaces canonical tip, visibility, identity, or moderation state. |
| `CT-R-030` | Demo | Community Tips fixtures mutate accepted DU1-v1. | `CRITICAL` | Demo/Data + Engineering | Separate CT1 overlay, base mutation guard, independent fingerprint. | DU1 seed, facts, fingerprints, or accepted evidence changes. |
| `CT-R-031` | Evidence | Screenshots or reports claim a state not backed by canonical facts. | `HIGH` | QA/Product | Exact-commit bundle, reconciliation paths, duplicate-state checks. | Evidence state cannot reconcile to CT1/domain records. |
| `CT-R-032` | Data | Retention policy preserves sensitive reports/consent too long or deletes required evidence too early. | `HIGH` | Privacy/Legal + Security | Retention decision before production launch; classify records separately. | Production launch approaches without approved retention/deletion policy. |
| `CT-R-033` | Product | Private personalization is introduced as a shortcut to relevance. | `CRITICAL` | Product + Privacy | Explicit v1 exclusion; later privacy review and Product Acceptance. | Ranking reads private shots, sessions, handicap, trends, or frequency. |
| `CT-R-034` | Content | Golf observation is presented as professional instruction. | `HIGH` | Community Curator + Product | Role disclosure, prohibited claims, no instructor role in v1. | Content promises diagnosis, cure, guaranteed outcome, or professional authority. |
| `CT-R-035` | Business model | Community Tips is mistaken for a directly monetized content surface. | `HIGH` | Product/Founder | Explicit MVP non-monetization; no paid tips, sponsorship, tipping, creator economics, or standalone subscription. | Proposal introduces payment, premium-tip access, sponsorship, or creator compensation. |
| `CT-R-036` | Business model | Community Tips bypasses or dilutes Fairway's credit-backed capacity model. | `CRITICAL` | Product + Architecture | Preserve membership, credit, pricing, inventory, reservation/Play Now, session, and access authority boundaries. | Tip interaction grants capacity, changes credits, or creates an alternate entitlement path. |
| `CT-R-037` | Measurement | Correlation between tip exposure and practice is presented as causal retention or revenue proof. | `HIGH` | Product + Data | Label outcome metrics as correlational until a valid evaluation design supports causal claims. | Product, investor, or operating materials claim caused revenue/retention lift without valid design. |
| `CT-R-038` | Architecture | A tip action creates a booking or access shortcut outside existing server-authoritative rules. | `CRITICAL` | Architecture + Security | Any practice CTA delegates to existing pricing, credit, inventory, reservation, session, and access operations. | Community Tips creates or authorizes a reservation, session, access grant, or unlock result directly. |

## Launch-Blocking Risks

The following categories block the affected phase until resolved:

- Any `CRITICAL` privacy, safety, security, authorization, or DU1 mutation finding.
- No assigned curator before Phase 2.
- Missing consent enforcement for member publication.
- Missing prohibited-content/reason workflow.
- Unresolved serious/critical accessibility findings on reviewed surfaces.
- Evidence that does not represent exact committed source and canonical facts.

## Risk Review Cadence

- Phase 0: Founder reviews product and business-model risks.
- Phase 1: Engineering/Product reviews curated reading, authorization, privacy, and My Golf UX risks.
- Phase 2: Curator/Privacy reviews consent, moderation, safety, queue, and authoring risks before pilot launch.
- Phase 3: Product/Data reviews Helpful, ranking, abuse, and measurement risks.
- Production readiness: Security/Privacy/Legal reviews retention, escalation, and deployment-scope risks.

Risk status must be included in each future implementation completion report. A risk is not resolved merely because a test passes; human review remains required where identified.

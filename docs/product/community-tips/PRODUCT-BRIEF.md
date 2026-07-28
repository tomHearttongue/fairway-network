# Community Tips v1 Product Brief

Status: `DISCOVERY - FOUNDER REVIEW REQUIRED`

## Member Problem

Fairway members can reserve and practice, but the product does not yet help them benefit from the practical knowledge already present in the club community. Generic golf content is abundant; credible, concise advice that fits the golfer's immediate practice context is not.

The problem is not a lack of a social feed. It is the absence of one trustworthy, relevant practice idea at the right moment.

## Behavior To Create

Primary behavior:

> A member encounters one relevant tip, uses it to shape a session or next-session intent, and provides a lightweight usefulness signal.

Secondary behavior:

> A trusted member converts a useful practice observation into a structured draft that Fairway can review and share safely.

The product should reward useful knowledge, not posting frequency or popularity.

## Business Hypothesis

Structured contextual tips can increase perceived membership value and practice confidence. Fairway should test whether exposed members:

- Read tips in meaningful contexts.
- Mark tips Helpful.
- Return to practice sooner.
- Begin Play Now after a useful contextual exposure.
- Require fewer repeated staff explanations.
- Contribute a manageable amount of publishable member knowledge.

These are hypotheses. Discovery defines measurements, not benchmark claims or causal guarantees.

## Jobs To Be Done

### Member preparing to practice

When I am deciding what to work on, give me one concrete idea that fits my current golf context so I can begin with confidence.

### Member reviewing My Golf

When I inspect a club baseline, show a concise practice note relevant to that club without exposing why Fairway selected it or disclosing my private performance.

### Member finishing a session

When I complete a session, help me carry one sensible idea into next time without inventing performance analysis.

### Member sharing knowledge

When I have a useful practice observation, let me submit it in a structured form and understand how it will appear before it is reviewed.

### Fairway curator

When members submit tips, give me enough context, history, and policy guidance to publish useful material and remove unsafe or inappropriate material with an audit trail.

## Recommended V1 User Stories

- As a member, I can read a published tip matched to the current safe surface context.
- As a member, I can mark a tip Helpful or withdraw that mark.
- As a member, I can report a published tip using a controlled reason.
- As an invited author, I can create and revise my own draft.
- As an invited author, I can submit a draft for review and see its review state.
- As a curator, I can publish Fairway-authored content directly.
- As a moderator, I can review member submissions and reports through governed actions.
- As a member, I never see another member's private practice or performance facts in tip content or author metadata by default.

## Recommended V1 Taxonomy

Use controlled, versioned keys. Do not use free-form hashtags.

### Club context

- `driver`
- `iron`
- `wedge`

Putting is deferred until Fairway has a supported product context for it. Specific club labels such as 7 Iron or PW may map to a broader v1 club group without changing canonical performance data.

### Practice intent

- `warmup`
- `tempo`
- `alignment`
- `dispersion`
- `distance_control`
- `pre_shot_routine`

### Facility and preparation

- `simulator_setup`
- `session_preparation`
- `suite_etiquette`

Each tip must have at least one context and should have no more context than is needed for truthful placement. Challenge and competition contexts are reserved for a later version.

## Authoring Model

Recommended:

- Plain text title and body.
- One primary context, with optional secondary controlled contexts.
- Optional source/provenance note.
- Optional related practice intent from the controlled taxonomy.
- No arbitrary media or promotional links.
- Preview of public author treatment before submission.
- Immutable revision created on each content change.
- Member edits to published content return the new revision to review.

Staff with explicit community-curator authorization may publish Fairway-authored tips directly. Operator status alone should not grant content authority. Invited pilot members may submit drafts but should not publish directly in v1.

Recommended content limits are provisional and should be validated in UX refinement rather than treated as final policy. The interface should encourage one idea per tip.

## Reading Model

- Show one tip, not an infinite list, in a contextual placement.
- Allow deliberate access to a small related set only when it helps the current job.
- Display title, body, context, privacy-safe author identity, role badge when applicable, provenance note when present, and Helpful/report actions.
- Do not show public popularity rankings or public helpful counts in v1.
- Do not expose placement reasons based on private member facts.
- If no eligible tip is relevant, omit the module rather than displaying low-value filler.

## UX Placement Analysis

| Placement | Why it may help | Risk | Data required | Privacy | Recommendation |
|---|---|---|---|---|---|
| My Golf club context | High-intent link between a club and a practice idea. | Could look like personalized diagnosis. | Current visible club context and published tip taxonomy. | Do not use or reveal baseline values to rank in v1. | `V1 FIRST` |
| Session completion | Carries one idea into the next visit. | Could imply analysis of an uninstrumented session. | Completion state plus explicit member-selected context, if any. | Use generic/session-prep tips unless context was explicitly chosen. | `V1 SECOND` |
| Home contextual card | Supports discovery without new navigation. | Can compete with Play Now or become filler. | Published curated tip and safe member lifecycle context. | No private telemetry explanation. | `V1 LIMITED PILOT` |
| Play Now preparation | Useful immediately before practice. | Adds friction to Fairway's fastest flow. | Confirmed session context and curated prep tip. | Do not infer club from private data. | `LATER` |
| Future challenge detail | Strong strategy context. | Competition model does not exist yet. | Versioned challenge context. | Competition-visible facts only. | `DEFERRED` |
| Guest/session context | Possible etiquette or preparation value. | Guest PII and access flows are already sensitive. | Reservation/guest readiness context. | High minimization burden. | `EXCLUDED V1` |
| Future Community/Compete surface | Could support browsing if volume proves value. | Creates a feed and fourth-nav pressure. | Sufficient trusted inventory and measured demand. | Broader visibility review required. | `EVIDENCE REQUIRED` |

## Content Quality Standard

Tips should be short, concrete, golf-specific, practice-relevant, non-medical, non-dangerous, and honest about author authority. A member observation must not be presented as professional instruction.

### Good

**Driver:** "Set two alignment references before the first swing: one close to the ball and one downrange. Recheck them after every five shots instead of changing your swing to chase a misaligned target."

**Warmup:** "Start with three easy half-swings before adding speed. The goal is to find centered contact and a repeatable finish, not to set a carry number."

**Simulator setup:** "Confirm the hitting position and target line before starting a scored session. If the screen and launch area feel misaligned, pause and ask Fairway staff rather than compensating with your aim."

### Bad

**Generic motivation:** "Believe in yourself and hit bombs today." It is not concrete or practice-relevant.

**Private-data leak:** "Tom's Driver dispersion widened to 38 yards last week, so he should copy this drill." It discloses private performance telemetry.

**Unsupported coaching claim:** "This move will cure every slice in ten swings." It presents an unvalidated guarantee as instruction.

**Spam:** "Buy my swing course with code FAIRWAY20." It is promotional and unrelated to the membership product.

## Measurement Contract

### Primary KPI

`Qualified Helpful Rate`:

> Unique members with an active Helpful signal divided by unique members who meaningfully viewed an eligible tip.

The implementation must define a meaningful-view threshold without collecting unnecessary attention telemetry.

### Secondary indicators

- Tip exposure-to-view rate.
- Member-authored submission rate.
- Submission-to-publication rate.
- Play Now initiation after contextual tip exposure.
- Median interval to next completed session after exposure.
- New-member activation after tip exposure.
- Challenge participation after contextual tip exposure, only after an implemented challenge domain supplies truthful context.
- Staff support-question trend for covered topics.
- Repeat helpful behavior across sessions.

### Guardrails

- Report rate by reason.
- Hidden/removed rate.
- Moderator queue age and workload.
- Duplicate or spam submission rate.
- Privacy incident count.
- Member author abandonment rate.
- Irrelevant-placement dismissal rate.
- Accessibility failures.

### Required dimensions

- `tip_id`
- `tip_revision_id`
- `placement_id` or placement key
- `context_key`
- `viewer_member_profile_id`
- `author_member_profile_id` only where access is authorized
- `location_id` only for location-scoped tips
- `moderation_status`
- `report_reason`
- `surface`

Do not send tip bodies, display names, emails, handicap, raw shots, session details, or private performance values to product analytics.

### Event candidates

- `community.tip.viewed`
- `community.tip.helpful_marked`
- `community.tip.helpful_withdrawn`
- `community.tip.authoring_started`
- `community.tip.submitted`
- `community.tip.reported`

Domain events and analytics events must not be duplicated merely to satisfy reporting. Transactional state remains authoritative, and analytics failure must never block tip operations.

## Risks And Tradeoffs

| Risk | Consequence | Mitigation |
|---|---|---|
| Generic content volume | Product feels like a feed. | One contextual tip, controlled taxonomy, quality review. |
| Advice presented as authority | Member harm or trust loss. | Role disclosure, prohibited-claim policy, moderation. |
| Private telemetry leakage | Material privacy breach. | No telemetry personalization in v1; server-side policy boundary. |
| Moderator burden | Solo-founder operational drag. | Invited author cohort, review-before-publish, queue metrics. |
| Popularity dynamics | Vanity behavior and lower quality. | Helpful-only, hidden counts, no follows/comments. |
| Home hierarchy erosion | Play Now loses priority. | One optional card below primary golf action; omit when irrelevant. |
| Sparse content | Empty or repetitive experience. | Staff-curated launch inventory and omission rather than filler. |
| Local advice presented globally | Incorrect facility guidance. | Explicit network/location visibility policy. |

## Product Acceptance Recommendation

Community Tips should not proceed to implementation until founder decisions identify the author cohort, moderator, public author treatment, first placement, prohibited-content policy, and success threshold. A future implementation slice should be accepted independently for function, privacy, moderation, accessibility, DLS/UX, deterministic evidence, and negative cases.

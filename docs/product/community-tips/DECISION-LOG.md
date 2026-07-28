# Community Tips v1 Decision Log

Status: `DISCOVERY - RECOMMENDATIONS NOT YET PRODUCT POLICY`

Decisions in this document are discovery recommendations. They become authoritative only through founder approval and appropriate PRD status updates.

## Recommended Decisions

### CT-D-001 - Contextual product, not a destination

- Recommendation: Keep Home, Play, and My Golf as primary navigation. Place tips within existing intent surfaces.
- Rationale: Community Tips adds value at a moment of practice intent; a destination encourages feed behavior before demand and inventory exist.
- Rejected: Fourth Community tab in v1.
- Revisit when: Repeated contextual usage and explicit browse demand justify separate Product Acceptance.

### CT-D-002 - Curated-first authorship

- Recommendation: Staff with explicit community-curator privilege may publish Fairway-authored tips. Invited members submit drafts for review.
- Rationale: Protects quality and limits moderation burden during hypothesis testing.
- Rejected: All members publish directly; anonymous publication.
- Follow-up: Founder must define pilot eligibility and curator/moderator owners.

### CT-D-003 - One community bounded domain

- Recommendation: A single `community` domain owns tips, revisions, taxonomy, visibility, moderation, Helpful events, and reports.
- Rationale: Clear ownership without premature services or empty modules.
- Rejected: Independent content service, moderation service, or external community platform as source of truth.
- Follow-up: Extract shared golf context only when another implemented domain needs it.

### CT-D-004 - Immutable revisions

- Recommendation: Edits create revisions; published facts and moderation history are never overwritten.
- Rationale: Supports trust, review, audit, and reconstruction.
- Rejected: Mutable title/body on one row without history.

### CT-D-005 - Reported is not publication status

- Recommendation: Keep report lifecycle separate from tip publication status.
- Rationale: A report is an allegation requiring review, not an automatic publication decision.
- Rejected: A single enum combining `reported`, `published`, and `hidden`.

### CT-D-006 - Helpful-only, private count

- Recommendation: Let members mark or withdraw `Helpful`; do not display public counts in v1.
- Rationale: Produces a quality signal without vanity dynamics or social ranking.
- Rejected: Likes, reactions, public scoreboards, comments, downvotes.
- Follow-up: Founder approval remains required for count visibility.

### CT-D-007 - No private-telemetry personalization in v1

- Recommendation: Rank using explicit surface context, controlled taxonomy, visibility, curation, Helpful projection, and recency.
- Rationale: Tests contextual value while minimizing privacy and explanation risk.
- Rejected: Ranking from raw shots, dispersion, handicap, recent sessions, or practice frequency.
- Follow-up: Future private recommendation inputs may be evaluated, but they must remain server-side, never expose underlying telemetry, and require explicit privacy review and Product Acceptance.

### CT-D-008 - My Golf first

- Recommendation: Implement My Golf club context before Home or Play placements.
- Rationale: It supplies the clearest explicit golf context without interrupting Play Now.
- Rejected: Home-first content wall; pre-quote Play Now placement.
- Follow-up: Founder must approve the first production placement.

### CT-D-009 - Explicit community privileges

- Recommendation: Community curator, moderator, and administrator privileges are separate from operator and Facilities roles.
- Rationale: Operational facility authority does not imply content authority.
- Rejected: Generic operator/admin-can-do-anything pathway.

### CT-D-010 - Plain text and controlled taxonomy

- Recommendation: V1 supports plain text, optional provenance note, and controlled context keys.
- Rationale: Keeps authoring safe, accessible, reviewable, and inexpensive to operate.
- Rejected: Arbitrary media, rich embeds, free-form hashtags, promotional links.

### CT-D-011 - Separate deterministic overlay

- Recommendation: Demonstrate implementation through a versioned CT1 overlay referencing DU1 IDs.
- Rationale: DU1-v1 is immutable and Product Accepted.
- Rejected: Editing DU1-v1 fixtures or fingerprints in place.

### CT-D-012 - Human moderation before automation

- Recommendation: No report-count auto-hide rule in v1; authorized humans make publication-state decisions.
- Rationale: Low expected volume, material trust implications, and risk of coordinated abuse.
- Rejected: Unreviewed automated takedown thresholds.

### CT-D-013 - Business-model scope optionality

- Recommendation: Preserve network, future organization/tenant, location, challenge/context, authorship, visibility, and private-placement scope as explicit policy dimensions.
- Rationale: Supports Fairway-owned clubs, software-only third-party facilities, and hybrid network deployments without changing canonical ownership.
- Rejected: Hardcoding Community Tips to one owned location or prematurely implementing a multi-tenant platform.
- Follow-up: Organization/tenant configuration requires a later architecture and isolation decision.

### CT-D-014 - Logical separation from Competition

- Recommendation: Community Tips may reference a Competition-owned challenge context for placement but owns no challenge rules, scoring, eligibility, rankings, divisions/flights, or results.
- Rationale: Preserves clean bounded domains and allows either MVP to ship independently.
- Rejected: Making Community Tips dependent on a competition engine or copying competition facts into tip records.

## Open Questions

### CT-OQ-001 - Who may author?

Question: Which members are eligible to draft tips in v1?

Recommendation: An invited pilot cohort of active members in good standing.

Why it matters: Determines volume, abuse controls, fairness, and moderator burden.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Invite a bounded cohort of active members in good standing.

### CT-OQ-002 - Is pre-publication review universal?

Question: Must every member-authored revision receive staff review?

Recommendation: Yes for v1, including edits to published member tips.

Why it matters: Directly controls trust and operational workload.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Review every member-authored revision before publication.

### CT-OQ-003 - Is Helpful visible?

Question: Should members see aggregate Helpful counts?

Recommendation: No in v1; use the signal privately for quality and ranking.

Why it matters: Visible counts can create social comparison and popularity bias.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Keep aggregate Helpful counts private.

### CT-OQ-004 - What public author identity is shown?

Question: Display name, first name plus last initial, member-selected community name, or role-only identity?

Recommendation: Use one privacy-safe network identity previewed and explicitly accepted by the author before submission.

Why it matters: Required for informed authorship and privacy.

Classification: `A - REQUIRED BEFORE IMPLEMENTATION`

### CT-OQ-005 - When are instructors supported?

Question: Should verified instructor-authored tips appear in v1?

Recommendation: Later, after instructor identity, authorization, and claims policy exist.

Why it matters: Professional authority changes trust, legal, and commercial expectations.

Classification: `C - LATER / NOT REQUIRED FOR V1`

MVP default: Exclude instructor-authored tips.

### CT-OQ-006 - Which context dimensions launch?

Question: Clubs, session types, challenge contexts, or all three?

Recommendation: Launch club group, practice intent, and facility/preparation contexts only.

Why it matters: Taxonomy size drives authoring complexity and placement quality.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Launch club group, practice intent, and facility/preparation contexts; defer challenge contexts.

### CT-OQ-007 - What is the first placement?

Question: My Golf club context, session completion, or Home?

Recommendation: My Golf club context.

Why it matters: Determines the first hypothesis and UX acceptance surface.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: My Golf club context is first.

### CT-OQ-008 - Who moderates and how quickly?

Question: Who owns submission/report queues, and what response expectation is supportable?

Recommendation: Name one accountable community moderator and begin with an invited cohort sized to that person's capacity.

Why it matters: The solo-founder constraint makes unowned queues unsafe.

Classification: `A - REQUIRED BEFORE IMPLEMENTATION`

Required decision: Name the accountable moderator and define who may hide, remove, and restore. A numeric response SLA may remain a pilot operating default.

### CT-OQ-009 - What content is prohibited?

Question: Which policy categories and escalation paths apply?

Recommendation: Prohibit dangerous advice, harassment/discrimination, spam/promotion, private-data disclosure, impersonation, illegal content, and unsupported professional/medical claims.

Why it matters: Moderators need consistent reasons before launch.

Classification: `A - REQUIRED BEFORE IMPLEMENTATION`

### CT-OQ-010 - What proves the hypothesis?

Question: Which measured outcomes justify implementation continuation?

Recommendation: Founder should approve a pilot window and decision rubric using Qualified Helpful Rate, repeat usage, moderator burden, and report/privacy guardrails without inventing benchmark values.

Why it matters: Prevents Community Tips from continuing solely because it exists.

Classification: `C - LATER / NOT REQUIRED FOR V1`

MVP default: Instrument the agreed KPI/guardrails; set numeric continuation thresholds before evaluating the pilot, not before implementation begins.

### CT-OQ-011 - Network or location visibility?

Question: Which tips are network-wide versus location-specific?

Recommendation: Golf/practice tips default network-wide; simulator setup and suite etiquette require explicit location scope when local details differ.

Why it matters: Incorrect local guidance damages trust.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Golf/practice tips are network-scoped; local setup and etiquette require explicit location scope.

### CT-OQ-012 - What is the edit and restoration policy?

Question: Who may restore hidden, removed, or archived content, and what happens to a published tip while a new revision is reviewed?

Recommendation: Keep the current approved revision published during ordinary edits; require administrator authority and reason to restore removed content.

Why it matters: Defines moderation safety and author expectations.

Classification: `B - RECOMMENDED DEFAULT FOR MVP`

MVP default: Keep the current approved revision published during ordinary edits; only a community administrator may restore removed content, with a reason.

## Founder Decision Classification

### A. Required before implementation

True blockers:

- `CT-OQ-004`: Public author identity and consent treatment.
- `CT-OQ-008`: Accountable moderation owner and visibility authority.
- `CT-OQ-009`: Prohibited-content categories and moderation reason policy.

Count: `3`

### B. Recommended default for MVP

- `CT-OQ-001`: Invited active-member cohort.
- `CT-OQ-002`: Review every member-authored revision.
- `CT-OQ-003`: Helpful counts remain private.
- `CT-OQ-006`: Launch bounded club/practice/preparation taxonomy.
- `CT-OQ-007`: My Golf club context first.
- `CT-OQ-011`: Network default with explicit location scope for local guidance.
- `CT-OQ-012`: Preserve approved revision during edits; administrator-only removed-content restoration.

Count: `7`

These defaults should be carried into the future PRD unless the founder explicitly changes them. They do not prevent implementation refinement.

### C. Later / not required for v1

- `CT-OQ-005`: Instructor-authored tips.
- `CT-OQ-010`: Numeric pilot continuation thresholds.

Count: `2`

All twelve questions remain visible for traceability. Only category A blocks implementation.

# Community Tips v1 Discovery

Status: `DISCOVERY - FOUNDER REVIEW REQUIRED`

Community Tips v1 is a proposed, bounded capability for sharing short, structured, practice-relevant knowledge inside the existing Fairway member experience. It is not a generic social network and is not approved for implementation by this discovery package.

## Executive Recommendation

Test whether a small amount of trusted, contextual member knowledge makes golfers more confident about what to practice and more likely to return.

Recommended v1:

- Launch with Fairway/staff-authored published tips first.
- Place the first reading experience in My Golf club context.
- Fairway staff with explicit community privileges may author and publish curated tips.
- Invited pilot members may create drafts only and submit them for approval.
- Member-authored tips require moderator approval before publication.
- Tips use a controlled context taxonomy rather than free-form tags.
- A member may mark a tip `Helpful` or withdraw that signal.
- Helpful counts inform quality and ranking but are not shown publicly in v1.
- Private performance and session telemetry is not used for v1 ranking or author identity.
- Fairway owns canonical tips, revisions, visibility, moderation, usefulness events, and audit history.

This shape tests value without a feed, comments, fourth primary destination, telemetry-based public recommendation, private shot/session/performance exposure, direct messages, arbitrary media, or a noisy content wall.

## Product Hypothesis

Members often know that they want to practice but lack one concrete, credible idea for the session. Useful knowledge is scattered across staff conversations, member experience, videos, and generic golf content that is rarely tied to the immediate Fairway context.

If Fairway places short, trusted tips at the moment a golfer chooses a club or finishes a session, members will feel more prepared and derive more value from each visit. Fairway should observe whether that behavior correlates with helpfulness, shorter intervals between sessions, and higher repeat practice without implying causation before enough evidence exists.

## Smallest Useful V1

### Author

1. An eligible pilot member opens authoring from a contextual surface.
2. Fairway preselects a safe context such as Driver or Warmup.
3. The member writes a short title and body, optionally adding a provenance note.
4. The member previews the public author treatment and submits for review.
5. A moderator publishes, returns, hides, archives, or removes through governed actions.

### Read

1. A member encounters one relevant published tip in an existing surface.
2. The tip shows context, concise content, and privacy-safe authorship.
3. The member may mark it Helpful, report it, or move on.
4. No underlying private placement context is disclosed.

## Scope

Included in the v1 product definition:

- Structured plain-text tips.
- Controlled contexts for club, practice intent, and facility preparation.
- Fairway-curated and reviewed member-authored content.
- Immutable revision history.
- Server-authoritative publication, visibility, moderation, and placement.
- Helpful-only usefulness signal with withdrawal.
- Member reporting and staff moderation.
- Audit and proportional data/observability requirements.
- Contextual consumption through accepted member surfaces.

## Explicit Non-Goals

V1 does not include:

- A generic feed or fourth primary navigation destination.
- Comments, threaded discussion, direct messaging, or follower relationships.
- Arbitrary images, video, files, external-link promotion, or media posting.
- Anonymous publication.
- Public handicap, rank, or private performance data by default.
- AI coaching, automated swing diagnosis, or generated instruction.
- Instructor marketplace behavior or instructor-author privileges.
- Creator monetization, sponsorships, or paid promotion.
- Challenge or competition authoring beyond preserving future context boundaries.
- Private performance/session telemetry in v1 ranking or placement.
- Guest-facing community identity or Facilities community permissions.

## Product Principles

1. Practice relevance over content volume.
2. Context over navigation.
3. Trust over publishing speed.
4. Helpful quality over social validation.
5. Private context may place content; it never authorizes publication.
6. Human moderation remains accountable.
7. Empty space is preferable to irrelevant content.
8. Fairway owns canonical content and policy.

## Business Model Flexibility

Community Tips should support Fairway's current owned-location model without assuming that every future deployment is owned by Fairway.

Conceptual deployment models:

- **Fairway-owned locations:** Fairway operates the club, controls local staff permissions, and may combine network-wide golf knowledge with location-specific setup or etiquette tips.
- **Software-only third-party facilities:** A future organization/tenant may operate one or more facilities through Fairway software while Fairway preserves network identity, canonical policy boundaries, and approved cross-network content.
- **Hybrid network:** Fairway-owned clubs and third-party facilities may participate in one golfer network while retaining explicit organization and location scopes.

Potential future scopes:

| Scope | Candidate responsibility |
|---|---|
| Network | Shared taxonomy, Fairway-curated golf knowledge, network visibility rules, global trust/safety policy. |
| Organization/tenant | Authorized staff authorship, moderation responsibility, tenant-specific policy within Fairway guardrails. |
| Location | Simulator setup, Practice Suite etiquette, local preparation, local staff-curated guidance. |
| Challenge/context | Optional placement link to a versioned future challenge without moving challenge ownership into Community Tips. |
| Member-authored | Reviewed practice observations linked to canonical MemberProfile identity. |
| Staff-authored | Organization/location guidance from explicitly authorized staff. |
| Fairway-curated | Network-quality tips authored or approved by Fairway. |
| Privately personalized | Future server-side placement that may use private context only after explicit privacy review and Product Acceptance. |
| Community-visible | Approved content and privacy-safe authorship only; never the underlying private placement facts. |

This is product and packaging optionality, not approval to implement multi-tenant SaaS configuration, tenant provisioning, cross-tenant sharing, or policy inheritance in v1.

## Packaging Implications

Community Tips may eventually contribute to several Fairway packages without becoming separate services:

- **Location OS:** Location-scoped simulator setup, suite etiquette, and staff-curated preparation guidance.
- **Golfer Identity / My Golf:** Club-context practice knowledge and Helpful history around the golfer's existing identity surface.
- **Engagement Layer:** Session-completion continuity, usefulness signals, contribution, and return-practice hypotheses.
- **Network Layer:** Shared taxonomy, privacy-safe authorship, Fairway curation, cross-location trust policy, and future context placement.

These are commercial/product packaging lenses. V1 still has one Fairway-owned `community` domain and one bounded implementation slice.

## Logical Separation From Competition

- Competition owns challenges, rules, eligibility, scoring, rankings, divisions/flights, and competition results.
- Community Tips owns structured practice knowledge, authorship, revisions, moderation, helpfulness, visibility, and placement.
- A future placement may connect a tip to a versioned competition or challenge context.
- Neither domain depends on the other for MVP.
- Community Tips v1 does not require implementing the competition engine.

## Founder Decision Classification

### Required before implementation

Only three decisions currently prevent a trustworthy implementation:

1. The privacy-safe public author identity and consent treatment.
2. The accountable moderator role, visibility authority, and escalation owner.
3. The prohibited-content/reason policy moderators enforce.

### Recommended MVP defaults

- Invited active-member pilot for authoring.
- Review every member-authored revision before publication.
- Keep Helpful counts private.
- Launch Driver/Iron/Wedge, practice-intent, and preparation contexts.
- Put My Golf club context first.
- Default golf/practice tips to network scope; require explicit location scope for local guidance.
- Keep the approved revision published during ordinary edits; administrator reason required to restore removed content.

These defaults are implementation-ready recommendations unless the founder chooses otherwise.

### Later, not required for v1

- Instructor-authored tips.
- Numeric success thresholds and continuation criteria for a later pilot decision.

See [DECISION-LOG.md](DECISION-LOG.md) for the complete classification.

## Acceptance Recommendation

Approve this package for refinement, not implementation. A future implementation slice should begin only after the blocking policy questions are resolved, Product Requirements are added to the canonical PRD with statuses, and the privacy/moderation acceptance plan is approved.

## Package

- [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md)
- [DOMAIN-MODEL.md](DOMAIN-MODEL.md)
- [UX-IA-NOTES.md](UX-IA-NOTES.md)
- [DEMO-STRATEGY.md](DEMO-STRATEGY.md)
- [REFINEMENT-BACKLOG.md](REFINEMENT-BACKLOG.md)
- [DECISION-LOG.md](DECISION-LOG.md)

## Immutable DU1 Boundary

DU1-v1 remains Product Accepted at commit `41d0a0c67976e8f11402061348ea711ebfd5fe59`. Community Tips demo facts must be a separate versioned overlay or later Demo Universe version. This discovery does not revise DU1-v1, its seed, clock, fingerprints, population, personas, histories, ledgers, screenshots, or acceptance records.

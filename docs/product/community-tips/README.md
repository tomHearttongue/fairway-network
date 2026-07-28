# Community Tips v1 Discovery

Status: `DISCOVERY - FOUNDER REVIEW REQUIRED`

Community Tips v1 is a proposed, bounded capability for sharing short, structured, practice-relevant knowledge inside the existing Fairway member experience. It is not a generic social network and is not approved for implementation by this discovery package.

## Executive Recommendation

Test whether a small amount of trusted, contextual member knowledge makes golfers more confident about what to practice and more likely to return.

Recommended v1:

- Fairway staff with explicit community privileges may author and publish curated tips.
- Invited pilot members may create drafts and submit them for review.
- Member-authored tips require moderator approval before publication.
- Tips use a controlled context taxonomy rather than free-form tags.
- Tips appear contextually in existing Home, My Golf, and session-completion surfaces.
- My Golf club context is the recommended first reading placement.
- A member may mark a tip `Helpful` or withdraw that signal.
- Helpful counts inform quality and ranking but are not shown publicly in v1.
- Private performance and session telemetry is not used for v1 ranking or author identity.
- Fairway owns canonical tips, revisions, visibility, moderation, usefulness events, and audit history.

This shape tests value without adding a fourth primary destination, open comments, direct messages, arbitrary media, or a noisy content wall.

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
- Private-telemetry-driven ranking.
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

## Decisions Required Before Implementation

The recommendations in this package are not final policy. Founder decisions are required for:

- Pilot member author eligibility.
- The exact privacy-safe public author identity.
- Moderator ownership and response expectations.
- Whether every member submission requires pre-publication review.
- The first production placement.
- The minimum evidence threshold that justifies an implementation slice.

See [DECISION-LOG.md](DECISION-LOG.md) for all open questions.

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

# DU1-v1 Accepted Refinements

Status: `OPEN - ACCEPTED NON-BLOCKING REFINEMENTS`

These refinements were explicitly accepted outside the DU1-v1 Product Acceptance gate. They do not alter the `PRODUCT ACCEPTED - PASS WITH REFINEMENT` verdict. Their canonical backlog status is maintained in [`docs/product/QUALITY-BACKLOG.md`](../../product/QUALITY-BACKLOG.md).

None of these items may be silently marked complete during DU1 closeout. Closing an item requires a later implementation, its stated acceptance criterion, and an explicit backlog status update.

## DU1-R4-P2-001 - Completion Refresh Race

- Severity: `P2`
- Status: `OPEN - ACCEPTED NON-BLOCKING REFINEMENT`
- Why it was not an acceptance blocker: The accepted completion flow preserves transactional truth and reaches the correct refreshed activity state; the remaining issue is a short interaction-readiness race rather than lost or contradictory persisted data.
- Recommended future behavior: Commit refreshed profile state before enabling `View My Golf` and `Done`, or keep those actions disabled until refresh completion.
- Likely affected surface or module: Member session-completion presentation and post-completion profile refresh orchestration.
- Future acceptance criterion: Under delayed profile-refresh conditions, completion actions remain unavailable until the refreshed golfer activity is committed, then enable once without stale navigation or duplicate completion behavior.
- Closeout safeguard: This item must not be silently marked complete during DU1 closeout.

## DU1-R4-P2-002 - Home Future-Reservation Ordering

- Severity: `P2`
- Status: `OPEN - ACCEPTED NON-BLOCKING REFINEMENT`
- Why it was not an acceptance blocker: The accepted Golden Demo selects the correct future reservation and excludes completed reservations; the residual case requires an unusual manually selected future record rather than the canonical flow.
- Recommended future behavior: Preserve selected-record priority only for active or immediate lifecycle contexts; ordinary `Up next` should choose the earliest chronological future reservation.
- Likely affected surface or module: Member Home featured-reservation selector and selected-reservation client state.
- Future acceptance criterion: Given multiple eligible future reservations and any manually selected non-immediate future reservation, `Up next` consistently displays the earliest chronological reservation while active/immediate lifecycle contexts retain intentional priority.
- Closeout safeguard: This item must not be silently marked complete during DU1 closeout.

## DU1-R4-P2-003 - Evidence Taxonomy Precision

- Severity: `P2`
- Status: `OPEN - ACCEPTED NON-BLOCKING REFINEMENT`
- Why it was not an acceptance blocker: The underlying evidence and reconciliation paths remain reviewable and truthful; the issue is classification precision for a small number of assertions, not missing or false evidence.
- Recommended future behavior: Classify assertions involving presentation transformations as `derived-presentation` rather than `state-backed` where appropriate.
- Likely affected surface or module: DU1 evidence contract, Playwright assertion metadata, and review-bundle reporting.
- Future acceptance criterion: Every packaged assertion passes a taxonomy audit in which direct reconciliation facts are `state-backed`, transformed values identify their named derivation as `derived-presentation`, and interactions identify their real locator strategy.
- Closeout safeguard: This item must not be silently marked complete during DU1 closeout.

## DU1-R4-P2-004 - Legacy Transcript Sanitation

- Severity: `P2`
- Status: `OPEN - ACCEPTED NON-BLOCKING REFINEMENT`
- Why it was not an acceptance blocker: The transcript contains stale development diagnostics rather than credentials or accepted product defects, and the authoritative review evidence remained intact.
- Recommended future behavior: Omit the legacy transcript from future bundles or sanitize stale Clerk refresh warnings and private LAN development URLs before packaging.
- Likely affected surface or module: DU1 review-bundle transcript collection, sanitation, and secret/path verification.
- Future acceptance criterion: A newly generated review bundle contains no private LAN URL or stale Clerk refresh warning in packaged transcripts, while preserving unsuppressed actionable console and network failures.
- Closeout safeguard: This item must not be silently marked complete during DU1 closeout.

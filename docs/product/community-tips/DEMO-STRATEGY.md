# Community Tips v1 Future Demo Strategy

Status: `DISCOVERY - FUTURE OVERLAY ONLY`

## Immutable Baseline

DU1-v1 is Product Accepted and immutable:

- Version: `DU1-v1`
- Seed: `fairway-demo-universe-du1-v1`
- Canonical clock: `2026-07-23T20:00:00.000Z`
- Accepted product commit: `41d0a0c67976e8f11402061348ea711ebfd5fe59`

Community Tips must not add fields, records, histories, roles, authored content, or fingerprints to DU1-v1.

## Recommended Fixture Boundary

Use a separately versioned `CT1` fixture overlay if implementation is approved.

Conceptual identity:

```text
overlay_version: CT1-v1
overlay_seed: fairway-community-tips-ct1-v1
base_universe_version: DU1-v1
base_universe_fingerprint: scenario-specific accepted DU1 fingerprint
overlay_clock: explicitly declared
```

The overlay references stable DU1 IDs but owns every Community Tips fact. Resetting the overlay must not delete, update, or recalculate accepted DU1 facts.

Do not call the overlay `DU1-v1.1`; that would imply mutation of the accepted baseline. A later integrated universe may become a separately reviewed DU2 candidate.

## Overlay Contents

The minimum deterministic overlay should contain:

- Controlled context taxonomy version.
- Fairway-curated staff tips.
- Member-authored drafts and submitted revisions.
- Published, hidden, removed, and archived tips.
- Open and resolved reports.
- Helpful mark/withdrawal events.
- Community role grants for overlay purposes.
- Placement scenarios and rule version.
- Domain/audit events.
- Stable timestamps relative to the overlay clock.

No content should claim live GHIN, WHS, Uneekor, GSPro, Stripe, Kisi, or professional-instructor integration.

## Candidate Persona Use

| DU1 persona | CT1 role | Why |
|---|---|---|
| Tom | Primary reader | Proves My Golf Driver placement, Helpful state, and session-completion continuity. |
| Nora Bennett | New-member reader | Proves useful onboarding/warmup content without mature performance history. |
| Maya Torres | Approved pilot author | High-engagement member with credible practice habits; authored tips still require review. |
| Bogey Nelson | Approved pilot author | Grounded improvement-oriented observation without pretending elite expertise. |
| Priya Shah | Approved pilot author | Short-session and warmup knowledge aligned with a time-compressed member. |
| Grant Gimme | Submitted author | Demonstrates a social golfer whose tip may need tighter review for specificity or promotion. |
| Cameron Vale | Future-only context | May support challenge strategy after Competition exists; not used for v1 challenge content. |
| Fran Facilities | No community privileges | Proves Facilities least privilege and no tip/report/member identity leakage. |

Overlay authorship does not rewrite persona histories. It adds CT1-owned references to accepted `MemberProfile` IDs.

## Staff-Curated Examples

### Published: Driver alignment

Title: `Check alignment before changing the swing`

Context: `driver`, `alignment`

Body: `Set one close alignment reference and one downrange reference. Recheck both after five shots before changing your swing to chase the target.`

Author treatment: `Curated by Fairway`

### Published: Simulator setup

Title: `Confirm the target line first`

Context: `simulator_setup`

Body: `Confirm the hitting position and target line before a scored session. If the setup feels wrong, pause and ask Fairway staff rather than compensating with your aim.`

Author treatment: `Curated by Fairway`

## Member-Authored Examples

### Maya Torres: published after review

Title: `Build a wedge ladder`

Context: `wedge`, `distance_control`

Body: `Choose three carry windows and rotate through them instead of repeating one number. Keep the same setup routine before each swing.`

Proof goal: Approved member authorship, immutable revision, privacy-safe display identity.

### Bogey Nelson: published after review

Title: `Count starts before distance`

Context: `driver`, `dispersion`

Body: `For the first ten swings, track whether the ball starts inside your target window. Leave carry distance out of the decision until the start line settles.`

Proof goal: Useful grinder identity without exposing his handicap, shots, or trend.

### Priya Shah: pending review

Title: `Use the first five minutes to find contact`

Context: `warmup`

Body: `Begin with easy half-swings and a balanced finish. Add speed only after contact feels centered.`

Proof goal: Member submission queue and review-before-publish.

### Grant Gimme: returned to draft

Title: `My favorite quick fix`

Context: `tempo`

Body: A deterministic example that contains an unsupported universal coaching claim.

Proof goal: Return-with-reason workflow without public exposure.

## Moderation Examples

- One member draft.
- One pending member submission.
- One published member tip.
- One published Fairway-curated tip.
- One published tip with an open `unsupported_claim` report that remains visible pending review.
- One hidden tip under active privacy review.
- One removed promotional tip with complete moderation history.
- One archived outdated location-specific setup tip.

Reports and moderator reasons remain restricted. Screenshots must never show reporter identity or private report detail.

## Placement Scenarios

### My Golf Driver

Input:

- Surface explicitly identifies Driver.
- No private baseline values are ranking inputs.

Expected:

- Exact Driver/Alignment tip selected.
- Screenshot and reconciliation prove selection from taxonomy and status.
- No carry, dispersion, handicap, or shot facts appear in placement evidence.

### New member

Input:

- New-member surface state.
- No historical golf context.

Expected:

- Staff-curated Warmup or Session Preparation tip.
- No fabricated profile, activity, or recommendation explanation.

### Session completion

Input:

- Completed session.
- No recorded clubs used.

Expected:

- Generic session-preparation tip.
- No claim that Fairway analyzed the completed session.

### Facilities

Expected:

- No community authoring or moderation control.
- No tip reports, author PII, or Helpful-member identities.

## Determinism And Fingerprints

The future overlay generator should:

- Use stable IDs derived from the CT1 seed.
- Use timestamps relative to the CT1 clock.
- Sort canonical records before hashing.
- Calculate an overlay fingerprint separately from the DU1 fingerprint.
- Record base DU1 version and accepted scenario fingerprint as provenance.
- Fail if it attempts to update a DU1-owned record.
- Verify repeated reset produces the same CT1 fingerprint.
- Verify every displayed summary derives from overlay facts.

The combined demo receipt may report both fingerprints:

```text
base_du1_fingerprint: 25f3841ffb383c77
ct1_overlay_fingerprint: <future value>
```

This discovery does not assign a CT1 fingerprint.

## Privacy Proof Expectations

Automated evidence should prove:

- Tip responses exclude raw shots, detailed sessions, handicap, club baseline values, reservation/guest facts, and Helpful-member identities.
- Member-visible author projection matches the approved public identity policy.
- Context selection can be explained without private telemetry.
- Facilities and unauthorized operators cannot access drafts, reports, or moderation history.
- Removed and hidden tips are not returned to normal members.
- Analytics payloads contain stable IDs and context keys, not tip body or PII.

## Future Product Acceptance Evidence

### Functional

- Create draft, revise, submit, review, publish, read, mark Helpful, withdraw, report, hide, remove, archive, and permitted restore.
- Idempotent retry and concurrency checks.

### Privacy

- Network traces and response snapshots for member, moderator, operator, Facilities, and guest boundaries.
- Explicit negative searches for private telemetry and PII.

### Moderation

- Submission queue, report review, state-driven actions, reason capture, and audit reconstruction.

### UX/DLS

- Mobile Home, My Golf, completion, authoring, and moderator states.
- Evidence that Play Now hierarchy and three-destination navigation remain intact.

### Accessibility

- Keyboard journey, focus order, labels/errors, dialogs, status messaging, contrast, and axe evidence.

### Deterministic fixture

- CT1 reset, fingerprint repeatability, base DU1 immutability, source-fact reconciliation, and exact committed-source provenance.

### Negative cases

- Unauthorized author.
- Member edits another member's tip.
- Member attempts direct publication.
- Helpful self-mark.
- Duplicate Helpful/report request.
- Superseded revision publish.
- Removed-tip discovery.
- Private-data leakage attempt.
- Invalid context key.
- Concurrent moderator conflict.

## Review Package

A future package should include:

- Exact implementation commit.
- Base DU1 identity and unchanged fingerprints.
- CT1 overlay identity and fingerprint.
- Persona/scenario reconciliation.
- Tip/revision/moderation/helpfulness reports.
- Privacy query evidence.
- Contextual screenshots.
- Accessibility, console, and network results.
- Exact Git source snapshot.
- Secret-safe bundle self-verification.

Community Tips remains `PENDING HUMAN REVIEW` until an implementation package earns explicit founder acceptance.

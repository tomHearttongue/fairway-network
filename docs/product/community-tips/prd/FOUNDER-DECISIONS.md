# Community Tips v1 Founder Decisions

**Status:** `MVP DECISIONS LOCKED`
**Applies to:** Community Tips v1
**Product requirements:** [`PRD.md`](PRD.md)

The three discovery blockers are resolved for MVP. They are product policy, not open questions.

## Decision Summary

| ID | Decision | Status |
|---|---|---|
| `CT-FD-001` | Public member author identity is display name only and requires explicit publication consent. | `LOCKED` |
| `CT-FD-002` | Fairway admin/curator owns Community Tips moderation and visibility authority. | `LOCKED` |
| `CT-FD-003` | V1 uses an explicit prohibited-content and moderation-reason policy. | `LOCKED` |

## CT-FD-001: Public Author Identity And Consent

### Locked Policy

- Fairway/staff-authored tips publish with approved role identity.
- Invited pilot-member tips may publish with display name only after explicit consent.
- Consent is required before publication, not merely before submission.
- A member may submit a draft before consent is present, but publication must fail closed until valid consent exists.
- Pilot-member author identity is limited to display name.
- Public identity excludes handicap, rank, shot data, session data, practice frequency, performance history, and private telemetry.
- Anonymous publication is excluded from v1.
- Pseudonymous publication is excluded from v1 unless a later decision explicitly approves it.
- Consent withdrawal must stop continued public attribution.
- On withdrawal, the safe default is to hide the tip pending review.
- A curator may later convert the knowledge into a separately governed Fairway-curated/internal record, but must not silently preserve member attribution or rewrite historical consent evidence.

### Rationale

Display-name publication is understandable to members and provides enough accountability for a curated pilot. Requiring consent at publication allows members to submit useful drafts without accidentally making their identity public.

### Risks Mitigated

- Unexpected public attribution.
- Leakage of private golfer identity or performance facts.
- Confusing submission with publication consent.
- Silent continuation after consent withdrawal.
- Anonymous abuse and moderation ambiguity.

### Future Revisit Conditions

Revisit only if evidence supports:

- A privacy-safe pseudonymous model.
- Instructor identity and verification.
- Organization/tenant-specific staff identity.
- A broader public profile capability with separate Product Acceptance.

Any revisit requires a PRD update, privacy review, migration/retention analysis, and Human Product Acceptance.

## CT-FD-002: Moderator Role And Visibility Authority

### Locked Policy

- Fairway admin/curator owns publish, hide, remove, restore, and report review.
- Ordinary operators do not automatically receive Community Tips privileges.
- Facilities roles receive no Community Tips privileges by default.
- Staff authoring and curator/moderator authority are separate grants.
- Every moderation action requires a reason.
- Every moderation action creates reconstructable audit history.
- Moderation history is not visible to ordinary members.
- Report details are restricted to authorized curator/admin roles.
- Staff-authored content remains subject to moderation and audit.
- All authorization is enforced server-side.

### Rationale

Facility authority does not imply content authority. An explicit curator boundary preserves least privilege and gives a solo-founder operation one accountable moderation model without creating a generic admin bypass.

### Risks Mitigated

- Operators accidentally receiving broad content power.
- Facilities actors seeing member/report information.
- Unattributed or reasonless takedowns.
- Staff content bypassing trust policy.
- UI-only authorization.

### Future Revisit Conditions

Revisit only when:

- Multiple organizations or locations require delegated moderation.
- Moderator volume requires additional roles or queue assignment.
- An appeal process is approved.
- A legally governed escalation boundary is required.

Future delegation must preserve Fairway network policy, isolation, reasons, audit, and least privilege.

## CT-FD-003: Prohibited Content And Moderation Reasons

### Prohibited Content

V1 prohibits:

1. Abuse.
2. Harassment.
3. Discriminatory language.
4. Spam.
5. Promotions.
6. Solicitation.
7. Impersonation.
8. Private-data exposure.
9. Sharing or inferring another member's private practice or performance data.
10. Unsafe advice.
11. Medical claims.
12. Gambling or wagering prompts.
13. Illegal conduct.
14. Sexual content.
15. Political campaigning.
16. Unsupported professional-instruction claims.
17. Swing diagnosis presented as professional instruction unless a later approved instructor/staff policy authorizes it.
18. Facility-security or access-circumvention advice.
19. Content that undermines safe use of the facility or equipment.

### Required Moderation Reason Codes

| Code | Intended use |
|---|---|
| `abusive_or_harassing` | Abuse, harassment, threats, or targeted hostility. |
| `discriminatory` | Discriminatory or hateful language. |
| `spam_or_promotion` | Spam, promotion, solicitation, or commercial diversion. |
| `private_data_exposure` | Exposure or inference of private identity, practice, session, or performance facts. |
| `unsafe_or_medical_claim` | Unsafe guidance, medical claims, or dangerous equipment/facility behavior. |
| `unauthorized_instruction_claim` | Unsupported claims of professional instruction, diagnosis, or guaranteed outcome. |
| `impersonation` | False identity or authority representation. |
| `facility_safety_or_security` | Access circumvention, security disclosure, or unsafe facility/equipment advice. |
| `irrelevant_or_low_quality` | Content outside the product purpose or too vague to be useful. |
| `duplicate` | Material duplicate of existing content. |
| `other` | Exceptional case requiring additional restricted detail. |

`other` must not become a substitute for the specific categories. A curator choosing `other` must provide restricted reason detail.

### Rationale

Moderators require a shared policy before member content can launch. The policy protects members, the facility, Fairway's trust position, and the distinction between peer observation and professional instruction.

### Risks Mitigated

- Dangerous practice or equipment advice.
- Private telemetry leakage.
- Unsupported medical or professional claims.
- Spam and promotional pressure.
- Facility access/security exposure.
- Inconsistent or unreconstructable moderation.

### Future Revisit Conditions

Revisit when:

- Approved instructor roles exist.
- Legal or safety counsel requires new categories.
- Report volume shows ambiguous or missing categories.
- Multi-jurisdiction or organization policy requires bounded extensions.

Reason-code changes must be versioned and must not rewrite historical actions.

## Remaining Non-Blocking Decisions

These items are not blockers to implementation planning.

| ID | Decision | Recommended MVP default | Decision point |
|---|---|---|---|
| `CT-NBD-001` | Pilot cohort size and invitation mechanism | Manual, small cohort of active members in good standing. | Before Phase 2 pilot launch |
| `CT-NBD-002` | Moderation response expectation | No public SLA; monitor queue age and set an internal target. | Before Phase 2 pilot launch |
| `CT-NBD-003` | Title/body limits | Short plain text, one idea per tip; validate exact limits in UX implementation. | Before Phase 2 Product Acceptance |
| `CT-NBD-004` | Exact curated launch inventory | Small reviewed set covering enabled club/preparation contexts. | Before Phase 1 Product Acceptance |
| `CT-NBD-005` | Numeric continuation thresholds | Instrument KPI and guardrails first; approve thresholds before pilot evaluation. | Before pilot evaluation |
| `CT-NBD-006` | Retention periods | Preserve reconstructability; finalize periods with privacy/legal/security review. | Before production launch |
| `CT-NBD-007` | Staff role badge copy | Use `Curated by Fairway` for network content; validate any staff label in Product Acceptance. | Before Phase 1 Product Acceptance |

## Locked V1 Defaults Carried From Discovery

- Curated-first launch.
- My Golf club-context placement first.
- Fairway/staff-authored published tips first.
- Invited pilot-member drafts with approval.
- Every member-authored revision receives review.
- Helpful-only signal; aggregate and individual behavior remain private.
- Controlled club, practice-intent, and preparation taxonomy.
- Golf/practice tips default network-wide.
- Local setup and etiquette require explicit location scope.
- Current approved revision may remain visible while a new member edit is reviewed, unless separately hidden.
- Removed content restoration requires admin authority and reason.
- Reports do not automatically hide content.
- Human moderation precedes automation.

## Deferred Beyond V1

- Anonymous or pseudonymous publication.
- Instructor-authored tips and professional authority.
- Public Helpful counts or leaderboards.
- Comments, DMs, followers, and social graphs.
- Arbitrary media or promotional links.
- AI coaching, generated instruction, and Improvement Score.
- Private telemetry-based placement.
- Competition/challenge placement.
- Organization/tenant configuration and delegated third-party moderation.
- Automated report-count takedowns.
- Appeals workflow.
- Creator monetization.

Deferred items must not be silently introduced during implementation. Each requires a PRD status change and, where member-facing or privacy-sensitive, separate Product Acceptance.

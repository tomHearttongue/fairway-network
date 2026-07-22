# Fairway Product Acceptance

Fairway separates functional correctness from product acceptance. Passing tests proves the implemented behavior is connected and objective checks passed; it does not prove that the experience feels premium, clear, accessible, or ready for a member-facing demo.

## Acceptance Workflow

1. Functional Acceptance
   - Domain behavior, authorization, persistence, concurrency, and regression verifiers pass.
2. Automated Experience QA
   - Playwright exercises the implemented experience through deterministic personae, screenshots, accessibility checks, console/network capture, and responsive checks.
3. Human Product Acceptance
   - Tom reviews the generated UX review bundle against the PRD, DLS, Experience Brief, and slice objective.
4. Remediation
   - Issues are fixed in priority order without expanding product scope unless explicitly approved.
5. Re-run
   - Functional and Experience QA are rerun after remediation.
6. Acceptance
   - A lightweight acceptance record is created only after Tom explicitly approves the slice.

## Human Outcomes

- `PASS`: Experience is accepted for the reviewed slice and commit.
- `PASS WITH REFINEMENT`: Experience may proceed with documented P2/P3 follow-up items.
- `FAIL PRODUCT ACCEPTANCE`: Experience has P0/P1 issues that block acceptance.

## Issue Severity

- `P0 - Demo/Product blocker`: Breaks the demo, materially misrepresents product truth, creates security/privacy concern, or makes the core flow unusable.
- `P1 - Must fix before Product Acceptance`: Major clarity, accessibility, responsive, or interaction issue that undermines acceptance.
- `P2 - Polish / should improve`: Noticeable refinement that should be addressed but does not block MVP progress if consciously accepted.
- `P3 - Backlog / do not derail MVP`: Valid improvement that should not interrupt the current vertical-slice sequence.

## Evidence Artifacts

The generated review ZIP is evidence for review, not the historical acceptance record. Large screenshots, reports, and ZIPs should normally remain outside Git. Product acceptance history should be captured as lightweight Markdown/JSON metadata referencing the reviewed commit and bundle manifest.

## Security

Review artifacts must exclude secrets, cookies, storage state, session tokens, `.env*` files, dependency caches, and production/member PII. If a trace or artifact may contain authenticated state, keep it local and do not include it in the external bundle.
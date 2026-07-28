# DU1-v1 Product Acceptance

Status: `PRODUCT ACCEPTED - PASS WITH REFINEMENT`

## Acceptance Summary

- Slice: DU1 - Deterministic Demo Universe Foundation
- Version: `DU1-v1`
- Verdict: `PASS WITH REFINEMENT`
- Accepted product commit SHA: `41d0a0c67976e8f11402061348ea711ebfd5fe59`
- Candidate branch: `du1/acceptance-remediation-r4`
- Acceptance timestamp: `2026-07-27T19:31:33-05:00`
- Acceptance timezone: `America/Chicago`
- Functional Acceptance: `PASS`
- Automated Experience QA: `PASS`
- Human Product Acceptance: `PASS WITH REFINEMENT`
- Overall: `PRODUCT ACCEPTED`
- Acceptance tag: `du1-v1-product-accepted`

## Founder Acceptance Statement

> I accept DU1-v1 as the canonical Fairway Demo Universe at commit 41d0a0c67976e8f11402061348ea711ebfd5fe59, with review package SHA-256 d2ed69822b281ad0c36125a2ceeb554a2a079c90b683ab5d3e6fd9781f0095c2. The four Round 4 P2 findings are accepted as non-blocking refinements and will be tracked outside the DU1 acceptance gate.

## Deterministic Identity

- Seed: `fairway-demo-universe-du1-v1`
- Canonical clock: `2026-07-23T20:00:00.000Z`
- Population: 220 members
- Deep personas: 9
- Lightweight members: 211
- Scenarios: `normal`, `busy-prime`, `new-member`, `facility-incident`, `low-inventory`

Accepted deterministic scenario fingerprints:

| Scenario | Fingerprint |
|---|---|
| `normal` | `25f3841ffb383c77` |
| `busy-prime` | `79064e30cf98a6b1` |
| `new-member` | `81ef1184913358aa` |
| `facility-incident` | `47fd078cb50c1e28` |
| `low-inventory` | `d034c8c1f7ff295f` |

The accepted product commit and its remediation history are immutable acceptance evidence. The acceptance tag points to the accepted product commit, not to this governance record.

## Review Package

- Filename: `fairway-du1-remediation-r4-review.zip`
- Repository-relative artifact path: `artifacts/du1-remediation-r4-review/fairway-du1-remediation-r4-review.zip`
- SHA-256: `d2ed69822b281ad0c36125a2ceeb554a2a079c90b683ab5d3e6fd9781f0095c2`
- Size: `2,186,202` bytes
- Embedded product commit: `41d0a0c67976e8f11402061348ea711ebfd5fe59`

The generated review ZIP remains outside Git history. This record preserves its immutable identity without committing the binary artifact.

## Accepted Scope

Accepted scope: DU1-v1 deterministic Demo Universe foundation.

- Deterministic Demo Universe version, seed, and canonical clock
- 220-member population and curated naming distribution
- Authored deep personas and lightweight population
- Membership, entitlement, and append-only credit facts
- Reservation, session, access, and facility lifecycle facts
- Scenario definitions and deterministic fingerprints
- Golf performance facts, baselines, and provenance
- Golden Demo and exact-state review evidence
- Round 4 member activity, completion, and Home reconciliation

DU1 is deterministic demonstration infrastructure. It does not imply a live or authorized integration with GHIN, WHS, Uneekor, GSPro, Stripe, Kisi, or any other production provider.

Future product work must not silently rewrite the accepted DU1-v1 facts. Any extension or intentional change to the accepted version, seed, clock, population, personas, ledger facts, scenarios, fingerprints, performance facts, or provenance must be explicitly versioned and reviewed.

## Verification Summary

The accepted review package reconciled deterministic identity, membership, append-only credits, reservation/session/access lifecycles, facility and inventory state, golf-performance facts, provenance, scenario truth, and Golden Demo evidence. The final review verdict was `PASS WITH REFINEMENT`; no P0 or P1 finding remained open at acceptance.

## Accepted Non-Blocking Refinements

The following P2 items remain open and are not resolved by this acceptance record:

- `DU1-R4-P2-001` - Completion refresh race
- `DU1-R4-P2-002` - Home future-reservation ordering
- `DU1-R4-P2-003` - Evidence taxonomy precision
- `DU1-R4-P2-004` - Legacy transcript sanitation

These findings are explicitly non-blocking and remain open outside the DU1 acceptance gate. Canonical backlog status is maintained in [`docs/product/QUALITY-BACKLOG.md`](../../product/QUALITY-BACKLOG.md), with acceptance-scoped details in [`REFINEMENTS.md`](REFINEMENTS.md).

## Canonical References

- [DU1 deterministic Demo Universe](../../product/DEMO-UNIVERSE.md)
- [DU1-v1 accepted refinements](REFINEMENTS.md)
- [Fairway Product Acceptance process](../README.md)

## Decision

The founder explicitly accepted DU1-v1 as the canonical Fairway Demo Universe at the accepted product commit and review-package hash above. The four listed P2 refinements are consciously accepted as non-blocking follow-up work outside the DU1 acceptance gate.


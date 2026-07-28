# DU1 - Deterministic Demo Universe Foundation

- **Status:** `PRODUCT ACCEPTED - PASS WITH REFINEMENT`
- **Version:** `DU1-v1`
- **Seed:** `fairway-demo-universe-du1-v1`
- **Canonical clock:** `2026-07-23T20:00:00.000Z`
- **Accepted product commit:** `41d0a0c67976e8f11402061348ea711ebfd5fe59`
- **Accepted evidence:** `fairway-du1-remediation-r4-review.zip`, SHA-256 `d2ed69822b281ad0c36125a2ceeb554a2a079c90b683ab5d3e6fd9781f0095c2`, `2,186,202` bytes
- **Acceptance record:** [`docs/product-acceptance/du1/ACCEPTANCE.md`](../product-acceptance/du1/ACCEPTANCE.md)
- **Source:** `src/demo-universe/universe.ts`

## Purpose

DU1 creates a deterministic operating world for Fairway demos, QA, Product Acceptance, and future domain work. It is not a new user-facing vertical slice and does not reopen Product-Accepted VS1G behavior.

Principle:

> Seed facts. Derive summaries. Never allow demo story and underlying data to disagree.

## Architecture

DU1 uses three layers:

- Canonical Demo Universe: one versioned deterministic world definition in `src/demo-universe/universe.ts`.
- Domain seed adapters: `scripts/demo-reset.mjs` translates canonical universe facts into existing Fairway-owned tables for identity, memberships, credits, reservations, sessions, access, facility tasks, and roles.
- Personas and scenarios: deep personas and scenario overlays reference the same universe rather than fabricating unrelated miniature fixture worlds.

The current My Golf presentation uses canonical demo shot/session facts through `deriveDemoGolfProfile`. No live or authorized GHIN, WHS, Uneekor, GSPro, Stripe, Kisi, waiver, competition, social, or other production-provider integration is implied.

## Deterministic Model

The universe is deterministic from:

- `FAIRWAY_DEMO_UNIVERSE_VERSION`
- `FAIRWAY_DEMO_UNIVERSE_SEED`
- `FAIRWAY_DEMO_CLOCK_ISO`
- scenario key

Stable IDs are generated from the versioned seed. Dates are relative to the canonical demo clock. Do not use wall-clock time or uncontrolled random values in demo universe facts.

## Naming Strategy

The Demo Universe should feel like a real golf club with a mischievous data team.

Identity pools:

- `realistic`: majority ordinary believable member names.
- `subtleGolf`: curated golf-native names such as Bogey Nelson, Max Carry, Grant Gimme.
- `obviousGolf`: small hidden joke layer such as Ned Threeputt and Harry Hosel.
- `easterEgg`: tiny set of deeper references such as Lonnie Hawkins.
- `recognizableGolfCulture`: centrally replaceable optional fictional/cultural references. `DU1-v1` uses none on public or deep-persona surfaces.

Recognizable third-party names are not product dependencies. The pool remains centrally replaceable, and the current public demo uses original identities.

## Deep Personas

| Persona ID | Display Identity | Archetype | Purpose |
|---|---|---|---|
| `demo-tom` | Tom | Committed mid-handicap golfer | Primary Golden Demo protagonist. |
| `competitive-low` | Cameron Vale | Competitive low-handicap golfer | Future-compatible competition density without implementing competition. |
| `high-variance` | Cole Mercer | Talented high-variance golfer | Strong but inconsistent performance story. |
| `bogey-grinder` | Bogey Nelson | Improving higher-handicap golfer | Honest grinder profile with a discoverable golf joke. |
| `new-golfer` | Nora Bennett | New member | Empty-state and future ONB1 foundation. |
| `time-compressed-pro` | Priya Shah | Time-compressed professional | Convenience and short Play Now session archetype. |
| `champions-member` | Maya Torres | High-engagement member | Dense My Golf state and richer usage. |
| `night-owl-social` | Grant Gimme | Night Owl/social golfer | Guest-hosting and off-hours behavior where current domains support it. |
| `facilities-fran` | Fran Facilities | Restricted facilities actor | Cleaning Mode persona, distinct from golfers. |

## Scenarios

Implemented scenario presets:

- `normal`: healthy operating day.
- `busy-prime`: high demand with coherent active/future reservations.
- `new-member`: preserves early golfer empty-state truth.
- `facility-incident`: inspection task and unavailable suite state.
- `low-inventory`: inventory is the constraint while credits remain sufficient.

Accepted fingerprints:

| Scenario | Fingerprint |
|---|---|
| `normal` | `25f3841ffb383c77` |
| `busy-prime` | `79064e30cf98a6b1` |
| `new-member` | `81ef1184913358aa` |
| `facility-incident` | `47fd078cb50c1e28` |
| `low-inventory` | `d034c8c1f7ff295f` |

Do not conflate insufficient credits, no availability, and facility incident scenarios unless explicitly testing a combined edge case.

The accepted DU1-v1 facts must not be silently rewritten by future product work. Extensions or intentional changes require a new explicit version and Product Acceptance evidence.

## Demo Tom

Demo Tom is Fairway's primary Golden Demo protagonist.

Current DU1 shape:

- Fairway KC home club.
- Birdie-style test membership.
- Official-style demo Handicap Index around `8.4`.
- 36 completed historical sessions across roughly six months.
- 280 canonical demo shot observations.
- Explicit effective-dated bag with 12 clubs.
- 48 available credits reconciled from append-only half-credit ledger units.
- Visible My Golf summaries derive from canonical shot facts.

Driver story is intentionally plausible rather than perfectly linear. Recent visible baseline uses 43 demo swings and derives typical carry, ball speed, dispersion, and provenance from underlying facts.

## Reset

Command:

```text
pnpm demo:reset -- --yes
```

Optional scenario:

```text
pnpm demo:reset -- --yes --scenario=busy-prime
```

Safety:

- Requires `DATABASE_URL`.
- Requires `--yes` or `FAIRWAY_DEMO_RESET_CONFIRM=RESET_FAIRWAY_DEMO`.
- Refuses production-looking connection strings unless an explicit high-risk override is provided.
- Deletes and recreates demo-owned rows only: `fairway-demo-%@example.com`, `fairway-ux-%@example.com`, and `du1:%` idempotency keys.
- Projects canonical identity, membership, credit-ledger, reservation, session, access, facilities, guest, and agreement chronology without replacing it with reset-time timestamps.
- Emits a reset execution receipt and persisted count reconciliation beneath `artifacts/du1-remediation-review/runtime/<scenario>/`.

## Verify

Command:

```text
pnpm demo:verify
```

The verifier checks:

- deterministic fingerprints
- cross-process fingerprint repeatability
- stable unique IDs
- at least 209 unique display names across 220 synthetic people
- one canonical Demo Tom
- naming distribution
- identity, membership, and created-at chronology
- append-only half-credit ledger reconstruction and non-negative running balances
- reservation/session/suite/access lifecycle coherence
- facility-task source and chronology coherence
- shot timestamps inside their sessions and clubs inside effective bags
- scenario-specific truth
- all nine deep-persona evidence thresholds
- Demo Tom history depth and derived My Golf reconciliation

`pnpm demo:audit` independently reconstructs population, persona, ledger, lifecycle, scenario, and visible-metric evidence into a machine-readable report. Report values are derived from the universe rather than separately maintained constants.

## Future Domain Definition Of Done

Every future domain or slice should answer:

1. Does this improve the Golden Demo?
2. What deterministic data does it require?
3. Which deep personas exercise it?
4. Does the lightweight population need extension?
5. What integrity/reconciliation rules are required?
6. Can the state reset deterministically?
7. Is provenance explicit?
8. What Product Acceptance evidence should exist?

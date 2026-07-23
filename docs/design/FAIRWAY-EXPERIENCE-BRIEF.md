# Fairway Experience Brief

**Status:** Living product-experience brief  
**Slice:** Vertical Slice 1G

## Product Experience Objective

Fairway should feel like one intentional golf product: open the app, know whether you can golf now, act quickly, understand your session, and see the beginning of your golfer identity.

## Core Member Information Architecture

Primary member IA:

- Home: can I golf now, what is coming up, what needs attention, what is happening with my golf.
- Play: Play Now and booking actions.
- My Golf: Golfer Passport shell, official golf provenance, Fairway performance baselines, activity.

Secondary areas:

- Guests are contextual to reservations and sessions.
- Account/profile remains secondary and should not lead the experience.
- Community/Compete are future-capable product surfaces but not functional in 1G.

## Navigation Model

Use a compact member navigation model with no more than three primary destinations in 1G:

- Home
- Play
- My Golf

On mobile, navigation should be easy to reach and understand. On larger screens, the same destinations may appear in a rail or top section. Avoid exposing backend domain names such as ledger, access grants, or facility tasks to members.

## Golden Demo Journey

The Golden Demo should support this narrative:

1. Member opens Fairway and sees a premium personalized home.
2. Member sees Play Now availability and credit context.
3. Member books or starts a Play Now reservation through the real persisted flow.
4. Member sees assigned suite, access window, and session state in human language.
5. Member opens My Golf / Golfer Passport and sees simulated official-golf and Fairway performance baselines with provenance.
6. Member completes a session through the real persisted flow.
7. Reservation/session/access lifecycle completes correctly.
8. Turnover task is created.
9. Presenter switches to Facilities persona.
10. Cleaning Mode services the suite and restores inventory.

This demonstrates the member product, golf identity direction, transactional platform, and autonomous facility operations.

## Primary Member Home Hierarchy

Home should answer, in order:

1. Can I golf now?
2. What should I do next?
3. What is coming up?
4. What is happening with my golf?
5. What needs attention, such as guest waiver readiness?

Play Now receives dominant visual hierarchy. Administrative details are supportive, not primary.

## Play Now Expectations

Play Now should feel faster than booking:

- Immediate availability summary.
- Server-derived duration options in 15-minute increments.
- Clear demand-band credit cost before confirmation.
- Confirmation that revalidates availability, pricing, eligibility, and credits server-side.
- Clear assigned suite after confirmation.
- Clear access window state.
- Recoverable failure language when availability or pricing changes.

Server-side reservation, credit, suite assignment, and concurrency rules remain authoritative. The browser expresses member intent; it does not choose demand band, entitlement, inventory, maximum duration, or authoritative credit price.

## Booking Expectations

Advance booking is intentionally secondary in VS1G.3 Product Acceptance evidence. Do not present an automatic "book next slot" shortcut as a finished future-booking capability.

A future bounded advance-booking slice should add honest date/time, duration, server-derived price, availability, and confirmation behavior before future booking returns to primary member/demo hierarchy. Do not add complex calendar UX until product need justifies it.

## Session Experience

The session state should clearly show:

- Current suite.
- Session timing.
- Access status.
- Guest readiness.
- Finish session action.

Session completion should show a meaningful summary and the fact that turnover/readiness work is queued.

## Golfer Passport / My Golf

1G introduces a presentation shell only:

- Official Golf: simulated handicap state with provenance and verification/sync state.
- Fairway Performance: provider-agnostic demo club baselines, typical carry, dispersion/consistency, sample counts.
- Fairway Activity: recent/demo session history and future competition capacity.

Do not imply a live GHIN, WHS, Uneekor, or GSPro integration. Do not implement Improvement Score or AI coaching.

## Guest Workflow Integration

Guests remain contextual to the selected reservation or session. The member should understand:

- Guest added.
- Waiver pending.
- Guest ready.
- Guest blocked/ineligible.
- Limit reached.

Guest PII should not appear outside contexts where the host needs it.

## Error And Recovery Philosophy

Use human state language:

- Bad: `SUITE_NOT_AVAILABLE`
- Better: `That suite is no longer available. Your credits were not charged.`

Never invent guarantees. When the system cannot complete an action, tell the member what remains safe and what they can do next.

## Demo Persona And Data Requirements

Golden demo data is governed by DU1, the deterministic Demo Universe foundation.

Canonical Golden Demo persona:

- Tom, Demo Golfer.
- Birdie-style membership context.
- Handicap Index 8.4 from simulated official-golf demo source.
- Driver, 7 Iron, and PW baselines derived from canonical DU1 shot facts.
- Representative activity/session history derived from canonical DU1 reservation/session facts.

Demo external-provider states must be visibly simulated/non-production and reproducible across refresh/login/server restart. Demo data must stay separate from production business assumptions. DU1 is responsible for deterministic seed/version/clock/scenario behavior and for keeping visible summaries reconciled to underlying demo facts.

## UX Acceptance Standards

Functional acceptance:

- Business behavior correct.
- Authorization correct.
- Persistence correct.
- Tests/verifiers pass.

Product acceptance:

- Clear hierarchy.
- Mobile-first and responsive.
- DLS-consistent.
- Accessible.
- Loading, empty, error, success, disabled, blocked, and recovery states are intentional.
- Member language avoids internal implementation terminology.

Codex can verify objective checks. Final subjective product acceptance remains Tom's visual/product review.

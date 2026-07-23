# Fairway Design Language System v0.1

**Status:** Living design foundation  
**Slice:** Vertical Slice 1G  
**Aesthetic direction:** Neo-modern-Masters-chic

Fairway's digital product should feel like a premium golf practice network, not a generic SaaS dashboard wrapped in green. DLS v0.1 defines the minimum shared language needed for coherent member, operator, and facilities experiences without creating a large component bureaucracy.

## Design Intent

Fairway is a software-enabled golf practice and competition network that happens to own physical locations. Member-facing software is part of the club experience. It should feel calm, fast, confident, golf-forward, and materially easier than deciding to visit a traditional driving range.

## Color Token Philosophy

Core palette:

- Deep restrained greens for brand authority, primary action, and club continuity.
- Warm cream/off-white for backgrounds and breathable space.
- Charcoal and blackened-metal neutrals for high-contrast text, structure, and premium restraint.
- Warm natural tones for secondary surfaces and inactive states.
- Restrained brass/gold for accent, status, and small moments of polish.
- Clear semantic colors for success, warning, danger, and blocked states.

Avoid neon simulator colors, sports-bar saturation, excessive gradients, and decorative color without user meaning.

## Typography

Use strong hierarchy and restrained type scale.

- Product headlines should feel editorial and athletic, not oversized marketing hero copy inside the application.
- Member home and My Golf surfaces may use larger display type for golf-forward moments.
- Operational surfaces use tighter headings and denser labels for scanning.
- Body text should be plain, readable, and human.
- Internal enum strings should not be presented directly to members.

## Layout And Spacing

- Mobile-first layouts lead with the highest-frequency member intent.
- Use generous spacing around primary decisions, tighter spacing inside repeated operational lists.
- Prefer clear vertical story flow on mobile over compressed desktop grids.
- Desktop may use a two-column experience shell, but the primary action still leads.
- Fixed-format controls such as action bars, cards, and metric tiles need stable dimensions to prevent layout shift.

## Surfaces, Cards, Radius, Borders, Shadows

- Use cards for repeated items, focused panels, and state containers; do not nest cards inside cards.
- Page sections should feel like bands or clear regions, not stacks of unrelated dashboard widgets.
- Radius should remain restrained, generally 8px or less.
- Borders are preferred over heavy shadows.
- Shadows, when used, should be soft and structural rather than decorative.

## Iconography

- Use simple line icons from the existing icon library where available.
- Icons should clarify action or state, not decorate every label.
- Buttons with common actions should use recognizable icons: play, calendar, refresh, door/access, check, warning, guest.
- Unfamiliar icon-only controls require accessible labels or visible text.

## Motion

- Motion should be subtle and purposeful: state changes, loading affordances, focus, and action confirmation.
- Avoid confetti, arcade effects, or excessive animation.
- Respect reduced-motion preferences.

## Photography And Imagery Direction

- Use real or generated golf/facility imagery only when it helps communicate the product or place.
- Avoid generic blurred stock atmosphere as a substitute for product clarity.
- Until brand photography exists, prefer restrained visual texture and strong information design over placeholder images.

## Accessibility

Target WCAG 2.2 AA principles as the design intent:

- Semantic structure and headings.
- Keyboard-reachable controls.
- Visible focus states.
- Sufficient contrast.
- Clear form labels and errors.
- Touch targets appropriate for mobile.
- Accessible status messaging.
- No custom controls that reduce accessibility for visual novelty.

## Responsive Principles

- Member experience is designed for phone first.
- Bottom or compact navigation should prioritize intent: Home, Play, My Golf.
- Operator and Facilities experiences may be denser, but must remain usable on mobile.
- Do not compress a desktop dashboard onto a phone.

## Member Versus Operator/Facilities

One Fairway language, different jobs:

- Member: emotional, golf-forward, simple, premium, intent-driven.
- Operator: operational, exception-first, information-dense where useful.
- Facilities: task-first, privacy-limited, fast to decide what to service next.

Consistency should come from tokens, state language, and interaction quality, not identical layouts.
## VS1G.2 Product Acceptance Remediation Notes

DLS v0.1 retains the neo-modern-Masters-chic direction, with the following token refinements established during Product Acceptance remediation round 1:

- Accessible muted text should use `#4f5b53` or a validated darker equivalent on cream, blue, clay, and paper surfaces.
- Brass/gold has two roles: decorative accent may remain restrained, while readable brass text should use `#6f541d` or a validated darker equivalent.
- Authenticated member screens should use compact product context rather than repeating landing-page hero scale.
- Product review screenshots should use viewport captures as the primary acceptance evidence so fixed navigation and first-viewport hierarchy are judged accurately.
- Facilities task surfaces must make the acting suite unmistakable, especially when notes, inspection escalation, and lifecycle actions are near each other.

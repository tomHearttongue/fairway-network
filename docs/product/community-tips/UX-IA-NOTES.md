# Community Tips v1 UX And IA Notes

Status: `DISCOVERY - NO SCREEN IMPLEMENTATION`

## IA Decision

Preserve the accepted primary member navigation:

- Home
- Play
- My Golf

Community Tips v1 does not earn a fourth primary destination. The product value is contextual: a golfer should encounter a useful practice note while thinking about a club or finishing a session, not navigate to a content destination and browse a feed.

A future Community or Compete destination requires evidence of sufficient trusted inventory, repeated member intent to browse, manageable moderation, and separate Human Product Acceptance.

## Recommended Placement Order

### 1. My Golf club context - v1 first

Why:

- The member already has a golf-specific question in mind.
- The club label supplies a safe explicit context without inspecting private metrics.
- One practice note can sit beneath the meaningful club summary without competing with Play Now.

Data:

- Visible club group.
- Published-tip context.
- Server-authoritative visibility and ranking.

Privacy:

- Do not say or imply that a tip was selected because of carry, dispersion, handicap, trend, or shot history.

### 2. Session completion - v1 second

Why:

- The member is receptive to one next-time idea.
- It supports practice continuity.

Data:

- Completed session state.
- Explicit member-selected practice intent, if implementation later introduces one.

Privacy:

- Without an explicit practice intent, show only safe session-preparation or general warmup content.
- Do not imply Fairway observed clubs used or diagnosed the session.

### 3. Home contextual card - limited pilot

Why:

- Allows discovery without navigation.

Risk:

- Home must continue to answer "Can I golf now?" first.
- A low-value empty or irrelevant card would weaken accepted hierarchy.

Behavior:

- At most one tip below Play Now and immediate member context.
- Omit the module when no qualified tip exists.

### 4. Play Now preparation - later

A compact post-confirmation note may help after the reservation is safe. Do not interrupt quote, confirmation, access, or Start Session actions. This placement should follow evidence from My Golf/session completion.

### 5. Future challenge detail - deferred

Challenge strategy may be valuable once Competition has a versioned context model. Do not create placeholder challenge UI or generic context IDs.

### 6. Future Community/Compete surface - evidence required

Do not build until contextual usage proves members intentionally want to browse and enough reviewed content exists to avoid a sparse or repetitive experience.

## Member Reading Pattern

Use one focused practice note:

```text
Suggested for Driver

Check alignment before changing the swing
Set one close reference and one downrange reference...

Shared by Maya T.             Helpful
Report
```

The exact public author treatment is unresolved. The example demonstrates hierarchy, not approved identity policy.

Reading principles:

- Lead with the practice value, not social metadata.
- Keep author treatment supportive.
- Use `Helpful`, not a heart, like count, or popularity score.
- Keep Report available but visually secondary.
- Do not show implementation labels such as taxonomy, revision, moderation state, or ranking source.
- Do not create endless scroll.

## Member Authoring Pattern

Authoring should open from context, not global navigation.

Recommended flow:

1. `Share a practice note` from a supported context.
2. Show the preselected context and allow controlled changes.
3. Ask for one title and one short body.
4. Offer optional provenance/source note.
5. Preview public author identity.
6. Explain review in one sentence.
7. Submit.

Do not expose a rich text editor, media picker, public engagement controls, or arbitrary tags.

For a published tip edit:

- Preserve the currently published revision.
- Make clear that the update returns to review.
- Do not remove the published version until a moderator acts unless a separate hide action is chosen.

## Moderator Experience

Moderation is a distinct operational job. Do not put it in Facilities or grant it to every operator.

The queue should emphasize:

- Tip and revision.
- Author treatment and role.
- Contexts.
- Submission age.
- Prior moderation history.
- Reports and report reason.
- Clear Publish, Return, Hide, Remove, Archive, and Restore actions only when valid.
- Required reason for visibility-reducing, restoring, or exceptional actions.

No generic "admin can edit anything" control.

## State Completeness

### Loading

- Preserve stable card dimensions.
- Use a quiet skeleton or delayed reveal.
- Do not block primary Home, Play, My Golf, or completion actions while a tip loads.

### Empty

- Omit optional contextual placement when no qualified tip exists.
- In an intentional author workspace, use concise copy such as `No practice notes submitted yet.`
- Never fill space with an irrelevant tip.

### Published

- Show one clear tip, context, author treatment, Helpful state, and Report action.

### Helpful

- Confirm quietly with accessible status text.
- Allow withdrawal without making the action feel like a social score.

### Reported

- Confirm that Fairway received the report.
- Do not promise removal.
- Do not reveal moderator action or reporter identity to other members.

### Hidden or removed

- Normal contextual surfaces should stop returning the tip after canonical state changes.
- If a member is viewing when state changes, replace it with neutral unavailable copy or remove the module.
- The author workspace may show a plain status and available appeal/contact path only if that policy is later approved.

### Blocked author

- Explain that sharing is unavailable without exposing moderation internals.
- Do not render a disabled full form.

### Error

- Preserve the member's unsent draft locally where safe.
- Use human recovery language.
- Analytics failure must not become a visible authoring failure.

## Mobile-First Behavior

- Full-width tip surface at 360-390 CSS px.
- Title and body wrap normally without narrow side-by-side columns.
- Primary reading and Helpful actions have comfortable touch targets.
- Report stays secondary but keyboard and screen-reader accessible.
- Authoring fields stack vertically with persistent labels and inline errors.
- Moderator actions are state-driven; never show Publish, Hide, Remove, and Restore as simultaneous generic choices.
- Avoid nested cards and dense metric grids.

## DLS Application

Community Tips uses the accepted DLS v0.1:

- Warm, restrained surfaces.
- Deep green for primary actions.
- Accessible charcoal/muted text.
- Brass only for restrained provenance or curated status when contrast passes.
- Borders over heavy shadow.
- Radius no greater than the existing system norm.
- No confetti, reaction animation, avatar wall, or social-media visual grammar.

Member language:

- `Tip`
- `Practice note`
- `Suggested for your session`
- `From the Fairway community`
- `Shared by members`
- `Curated by Fairway`
- `Helpful`
- `Report`
- `Hidden`
- `Reviewed`

Avoid:

- Feed
- Post
- Followers
- Viral
- Engagement bait
- Influencer
- Creator
- Content economy

## Accessibility Acceptance Intent

- Semantic heading order within the host page.
- Tip content available without hover.
- Keyboard-operable Helpful, Report, authoring, and moderation controls.
- Visible focus on interactive controls.
- No persistent focus chrome on programmatically focused non-interactive headings.
- WCAG 2.2 AA contrast intent.
- Form labels, descriptions, and errors associated programmatically.
- Helpful and submission outcomes announced through accessible status messaging.
- Report dialog focus containment and return.
- Reduced-motion support.

Automated axe checks are evidence, not accessibility certification.

## UX Risks Requiring Human Review

- Whether one tip meaningfully helps or feels like promotional filler.
- Whether public author identity feels safe and credible.
- Whether My Golf placement implies diagnosis.
- Whether session-completion placement overwhelms the accepted completion state.
- Whether Home placement competes with Play Now.
- Whether moderation language feels fair to member authors.

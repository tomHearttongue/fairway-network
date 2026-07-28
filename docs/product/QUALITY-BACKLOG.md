# Fairway Product Quality Backlog

This backlog tracks accepted, non-blocking product and evidence refinements outside completed Product Acceptance gates. An open item here must not be described as resolved until a later implementation and verification explicitly closes it.

## Open P2 Items

### DU1-R4-P2-001 - Completion Refresh Race

- Status: `OPEN`
- Severity: `P2`
- Source: DU1-v1 Product Acceptance
- Accepted as non-blocking: `2026-07-27`
- Finding: Completion actions can become interactive immediately before refreshed golfer activity necessarily finishes loading.
- Future recommendation: Commit refreshed profile state before enabling `View My Golf` and `Done`, or keep those actions disabled until refresh completion.

### DU1-R4-P2-002 - Home Future-Reservation Ordering

- Status: `OPEN`
- Severity: `P2`
- Source: DU1-v1 Product Acceptance
- Accepted as non-blocking: `2026-07-27`
- Finding: A manually selected eligible future reservation can potentially be preferred over an earlier future reservation.
- Future recommendation: Preserve selected-record priority only for active or immediate lifecycle contexts; ordinary Up next should choose the earliest chronological future reservation.

### DU1-R4-P2-003 - Evidence Taxonomy Precision

- Status: `OPEN`
- Severity: `P2`
- Source: DU1-v1 Product Acceptance
- Accepted as non-blocking: `2026-07-27`
- Finding: A small number of assertions labeled state-backed include presentation transformations.
- Future recommendation: Classify those records as derived-presentation where appropriate.

### DU1-R4-P2-004 - Legacy Transcript Sanitation

- Status: `OPEN`
- Severity: `P2`
- Source: DU1-v1 Product Acceptance
- Accepted as non-blocking: `2026-07-27`
- Finding: A legacy server transcript contains stale Clerk refresh warnings and a private LAN development URL.
- Future recommendation: Omit or sanitize that transcript in future bundles.


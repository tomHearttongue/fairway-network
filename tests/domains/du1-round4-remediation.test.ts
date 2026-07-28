import { describe, expect, it } from "vitest";
import { buildDemoUniverse, deriveDemoGolfProfile } from "@/demo-universe/universe";
import {
  projectMemberGolfProfile,
  sessionCompletionPresentation,
  selectHomeFeaturedReservation,
  type CompletedSessionActivityFact,
} from "@/application/member-flow/member-activity";
import { validateEvidenceAssertion } from "../../scripts/du1-evidence-contract.mjs";

describe("DU1 Round 4 member activity remediation", () => {
  it("separates Demo Tom's completed-session total from three recent rows", () => {
    const universe = buildDemoUniverse({ scenario: "normal" });
    const tom = universe.members.find((member) => member.id === "demo-tom");
    const profile = deriveDemoGolfProfile(universe, tom!.memberProfileId);

    expect(profile.completedSessionCount).toBe(36);
    expect(profile.recentActivity).toHaveLength(3);
  });

  it("keeps the new golfer at zero completed sessions and zero recent rows", () => {
    const universe = buildDemoUniverse({ scenario: "new-member" });
    const nora = universe.members.find((member) => member.id === "new-golfer");
    const profile = deriveDemoGolfProfile(universe, nora!.memberProfileId);

    expect(profile.completedSessionCount).toBe(0);
    expect(profile.recentActivity).toHaveLength(0);
  });

  it("projects one persisted runtime completion without changing shot baselines", () => {
    const universe = buildDemoUniverse({ scenario: "normal" });
    const tom = universe.members.find((member) => member.id === "demo-tom")!;
    const base = deriveDemoGolfProfile(universe, tom.memberProfileId);
    const seeded = completedSessionFacts(universe, tom.memberProfileId);
    const runtime: CompletedSessionActivityFact = {
      sessionId: "runtime-session",
      reservationId: "runtime-reservation",
      bookingMode: "PLAY_NOW",
      suiteName: "Practice Suite 1",
      scheduledStartAt: "2026-07-23T20:00:00.000Z",
      scheduledEndAt: "2026-07-23T21:00:00.000Z",
      sessionStartedAt: "2026-07-23T20:00:00.000Z",
      sessionEndedAt: "2026-07-23T20:00:00.000Z",
    };

    const projected = projectMemberGolfProfile({
      baseProfile: base,
      completedSessions: [...seeded, runtime],
      seededSessionIds: new Set(seeded.map((session) => session.sessionId)),
    });

    expect(projected.completedSessionCount).toBe(37);
    expect(projected.recentActivity).toHaveLength(3);
    expect(projected.recentActivity[0]).toMatchObject({
      sessionId: "runtime-session",
      reservationId: "runtime-reservation",
      title: "Play Now session",
      scheduledDurationMinutes: 60,
      elapsedDurationMinutes: 0,
    });
    expect(projected.performance).toEqual(base.performance);
    expect(projectMemberGolfProfile({
      baseProfile: base,
      completedSessions: [...seeded, runtime, runtime],
      seededSessionIds: new Set(seeded.map((session) => session.sessionId)),
    }).completedSessionCount).toBe(37);
  });

  it("never features a completed selected reservation over the true future booking", () => {
    const completed = reservation("completed-play-now", "Practice Suite 1", "completed", "2026-07-23T20:00:00.000Z");
    const future = reservation("future-suite-10", "Practice Suite 10", "confirmed", "2026-07-23T21:30:00.000Z");

    const featured = selectHomeFeaturedReservation([completed, future], completed.id);

    expect(featured?.id).toBe(future.id);
    expect(featured?.suiteName).toBe("Practice Suite 10");
  });

  it("distinguishes a 60-minute booking from zero elapsed session minutes", () => {
    const presentation = sessionCompletionPresentation({
      scheduledStartAt: "2026-07-23T20:00:00.000Z",
      scheduledEndAt: "2026-07-23T21:00:00.000Z",
      sessionStartedAt: "2026-07-23T20:00:00.000Z",
      sessionEndedAt: "2026-07-23T20:00:00.000Z",
    });

    expect(presentation.scheduledDurationMinutes).toBe(60);
    expect(presentation.elapsedDurationMinutes).toBe(0);
    expect(presentation.bookingLabel).toBe("60-minute booking");
    expect(presentation.bookingLabel).not.toContain("played");
  });

  it("fails evidence assertions without an explicit source kind", () => {
    expect(() => validateEvidenceAssertion({
      id: "ui:member.completedSessionCount",
      evidenceType: "ui",
      sourcePath: "golfProfile.completedSessionCount",
      comparator: "contains",
      expected: "36 completed",
      actual: "36 completed",
      locator: { kind: "text", value: "36 completed" },
      stateEvidence: { reconciliationPath: "runtime/reconciliation.json", queryId: "snapshot:golfProfile.completedSessionCount" },
      passed: true,
    } as never, { reconciliationPath: "runtime/reconciliation.json" })).toThrow(/sourceKind/);
  });
});

function completedSessionFacts(universe: ReturnType<typeof buildDemoUniverse>, memberProfileId: string): CompletedSessionActivityFact[] {
  return universe.sessions
    .filter((session) => session.memberProfileId === memberProfileId && session.endedAt)
    .map((session) => {
      const reservation = universe.reservations.find((item) => item.id === session.reservationId)!;
      const suiteNumber = Number(session.suiteId.slice(-4)) - 1000;
      return {
        sessionId: session.id,
        reservationId: reservation.id,
        bookingMode: reservation.bookingMode,
        suiteName: `Practice Suite ${suiteNumber}`,
        scheduledStartAt: reservation.startAt,
        scheduledEndAt: reservation.endAt,
        sessionStartedAt: session.startedAt,
        sessionEndedAt: session.endedAt!,
      };
    });
}

function reservation(id: string, suiteName: string, status: "confirmed" | "completed", startAt: string) {
  return {
    id,
    suiteName,
    status,
    bookingMode: status === "completed" ? "PLAY_NOW" as const : "ADVANCE" as const,
    startAt,
    endAt: new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString(),
    sessionStartedAt: status === "completed" ? startAt : undefined,
    sessionEndedAt: status === "completed" ? startAt : undefined,
  };
}

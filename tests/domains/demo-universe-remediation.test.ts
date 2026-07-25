import { describe, expect, it } from "vitest";
import {
  buildDemoUniverse,
  FAIRWAY_DEMO_CLOCK_ISO,
  verifyDemoUniverse,
} from "@/demo-universe/universe";

const scenarios = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"] as const;

describe("DU1 Product Acceptance remediation invariants", () => {
  it("locks the population contract and keeps public names overwhelmingly unique", () => {
    const universe = buildDemoUniverse();
    const names = universe.members.map((member) => member.displayName);
    const counts = countBy(names);

    expect(universe.members).toHaveLength(220);
    expect(universe.personas).toHaveLength(9);
    expect(new Set(names).size).toBeGreaterThanOrEqual(209);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
    expect(names).not.toContain("Shooter McGavin");
    expect(names).not.toContain("Roy McAvoy");
  });

  it("models every scenario from explicit expectations that reconcile to safe ready-now inventory", () => {
    for (const scenario of scenarios) {
      const universe = buildDemoUniverse({ scenario }) as any;
      expect(universe.scenarioExpectation?.scenario).toBe(scenario);
      expect(universe.scenarioExpectation?.readyNowSuiteIds).toHaveLength(universe.scenarioExpectation?.readyNowCount);
      expect(universe.scenarioExpectation?.readyNowSuiteIds).toEqual(actualReadyNowSuiteIds(universe));
      expect(verifyDemoUniverse(universe).ok).toBe(true);
    }

    const lowInventory = buildDemoUniverse({ scenario: "low-inventory" }) as any;
    expect(lowInventory.scenarioExpectation.readyNowCount).toBe(2);
    expect(actualReadyNowSuiteIds(lowInventory)).toHaveLength(2);
  });

  it("keeps reservation, session, suite, task, and access lifecycles coherent", () => {
    for (const scenario of scenarios) {
      const universe = buildDemoUniverse({ scenario }) as any;
      const integrity = verifyDemoUniverse(universe);
      expect(integrity.errors, `${scenario} lifecycle errors`).toEqual([]);

      for (const session of universe.sessions.filter((item: any) => !item.endedAt)) {
        expect(universe.facilityState.find((state: any) => state.suiteId === session.suiteId)?.status).toBe("occupied");
      }
      for (const task of universe.facilityTasks.filter((item: any) => item.taskType === "turnover")) {
        const sourceSession = universe.sessions.find((session: any) => session.id === task.sourceSessionId);
        expect(sourceSession?.endedAt).toBeTruthy();
        expect(Date.parse(task.createdAt)).toBeGreaterThanOrEqual(Date.parse(sourceSession.endedAt));
      }
      for (const grant of universe.accessGrants) {
        const now = Date.parse(universe.metadata.clock);
        const expected = grant.status === "revoked"
          ? "revoked"
          : now < Date.parse(grant.startsAt)
            ? "scheduled"
            : now >= Date.parse(grant.expiresAt)
              ? "expired"
              : "active";
        expect(grant.windowStatus).toBe(expected);
      }
    }
  });

  it("places every shot inside its canonical session and inside the golfer's bag", () => {
    for (const scenario of scenarios) {
      const universe = buildDemoUniverse({ scenario }) as any;
      const bags = new Map<string, Set<string>>(universe.bags.map((bag: any) => [bag.memberProfileId, new Set<string>(bag.clubs.map((club: any) => club.code))]));
      for (const shot of universe.shots) {
        const session = universe.sessions.find((item: any) => item.id === shot.sessionId);
        expect(session, `${scenario} shot ${shot.id} session`).toBeDefined();
        expect(Date.parse(shot.occurredAt), `${scenario} shot ${shot.id} starts after session`).toBeGreaterThanOrEqual(Date.parse(session.startedAt));
        expect(Date.parse(shot.occurredAt), `${scenario} shot ${shot.id} ends before session`).toBeLessThanOrEqual(Date.parse(session.endedAt));
        expect(bags.get(shot.memberProfileId)?.has(shot.clubCode), `${scenario} shot ${shot.id} club ${shot.clubCode} is in bag`).toBe(true);
      }
    }
  });

  it("substantiates all nine deep personas and keeps Fran facilities-only", () => {
    const universe = buildDemoUniverse() as any;
    const evidence = new Map<string, any>(universe.personaEvidence?.map((item: any) => [item.personaId, item]));

    expect(evidence.get("demo-tom")?.completedSessions).toBeGreaterThanOrEqual(30);
    expect(evidence.get("competitive-low")?.completedSessions).toBeGreaterThanOrEqual(12);
    expect(evidence.get("competitive-low")?.shots).toBeGreaterThanOrEqual(120);
    expect(evidence.get("high-variance")?.completedSessions).toBeGreaterThanOrEqual(10);
    expect(evidence.get("high-variance")?.shots).toBeGreaterThanOrEqual(100);
    expect(evidence.get("bogey-grinder")?.completedSessions).toBeGreaterThanOrEqual(12);
    expect(evidence.get("bogey-grinder")?.shots).toBeGreaterThanOrEqual(120);
    expect(evidence.get("new-golfer")).toMatchObject({ completedSessions: 0, shots: 0, bagClubs: 0 });
    expect(evidence.get("time-compressed-pro")?.completedSessions).toBeGreaterThanOrEqual(8);
    expect(evidence.get("time-compressed-pro")?.shots).toBeGreaterThanOrEqual(60);
    expect(evidence.get("champions-member")).toMatchObject({ planCode: "TEST_CHAMPIONS", availableCredits: 80 });
    expect(evidence.get("night-owl-social")?.completedSessions).toBeGreaterThanOrEqual(12);
    expect(evidence.get("night-owl-social")?.shots).toBeGreaterThanOrEqual(90);
    expect(evidence.get("night-owl-social")?.guestStates).toEqual(expect.arrayContaining(["pending", "ready"]));
    expect(evidence.get("facilities-fran")).toMatchObject({
      planCode: null,
      availableCredits: 0,
      reservations: 0,
      completedSessions: 0,
      shots: 0,
      bagClubs: 0,
      role: "facilities",
    });
  });

  it("keeps identity, membership, funding, and usage chronology auditable", () => {
    const universe = buildDemoUniverse() as any;
    expect(universe.memberships?.length).toBeGreaterThan(0);
    expect(universe.creditLedgerEntries?.length).toBeGreaterThan(0);

    for (const member of universe.members) {
      expect(Date.parse(member.personCreatedAt)).toBeLessThanOrEqual(Date.parse(member.memberProfileCreatedAt));
      expect(Date.parse(member.memberProfileCreatedAt)).toBeLessThanOrEqual(Date.parse(FAIRWAY_DEMO_CLOCK_ISO));
    }

    for (const audit of universe.ledgerAudits ?? []) {
      expect(audit.negativeRunningBalanceCount, audit.memberProfileId).toBe(0);
      expect(audit.finalUnits, audit.memberProfileId).toBe(audit.targetAvailableUnits);
      expect(audit.idempotencyKeysUnique, audit.memberProfileId).toBe(true);
    }

    for (const reservation of universe.reservations) {
      expect(Date.parse(reservation.createdAt), reservation.id).toBeLessThan(Date.parse(reservation.startAt));
      expect(Date.parse(reservation.createdAt), reservation.id).toBeLessThanOrEqual(Date.parse(FAIRWAY_DEMO_CLOCK_ISO));
    }
    for (const grant of universe.accessGrants) {
      expect(Date.parse(grant.createdAt), grant.id).toBeLessThanOrEqual(Date.parse(FAIRWAY_DEMO_CLOCK_ISO));
    }
  });

  it("emits actionable verifier errors for cross-entity corruption", () => {
    const universe = buildDemoUniverse({ scenario: "normal" }) as any;
    const shot = universe.shots[0];
    const session = universe.sessions.find((item: any) => item.id === shot.sessionId);
    shot.occurredAt = new Date(Date.parse(session.endedAt) + 60_000).toISOString();

    const integrity = verifyDemoUniverse(universe);
    expect(integrity.ok).toBe(false);
    expect(integrity.errors.some((error) =>
      error.includes("scenario=normal")
      && error.includes(`shot=${shot.id}`)
      && error.includes(`session=${session.id}`)
      && error.includes("outside session"),
    )).toBe(true);
  });
});

function actualReadyNowSuiteIds(universe: any): string[] {
  const now = Date.parse(universe.metadata.clock);
  const minimumEnd = now + universe.locations[0].minimumSessionMinutes * 60_000;
  const turnoverMs = universe.locations[0].turnoverBufferMinutes * 60_000;
  return universe.facilityState
    .filter((state: any) => state.status === "available")
    .filter((state: any) => !universe.reservations.some((reservation: any) =>
      reservation.suiteId === state.suiteId
      && ["confirmed", "checked_in"].includes(reservation.status)
      && Date.parse(reservation.startAt) < minimumEnd + turnoverMs
      && Date.parse(reservation.endAt) > now,
    ))
    .map((state: any) => state.suiteId)
    .sort();
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

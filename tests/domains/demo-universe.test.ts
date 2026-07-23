import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { buildDemoUniverse, deriveDemoGolfProfile, FAIRWAY_DEMO_CLOCK_ISO, FAIRWAY_DEMO_UNIVERSE_VERSION, verifyDemoUniverse } from "@/demo-universe/universe";

describe("DU1 deterministic Demo Universe", () => {
  it("generates a stable versioned universe with one canonical Demo Tom", () => {
    const universe = buildDemoUniverse();
    const repeated = buildDemoUniverse();
    const integrity = verifyDemoUniverse(universe);

    expect(universe.metadata.version).toBe(FAIRWAY_DEMO_UNIVERSE_VERSION);
    expect(universe.metadata.clock).toBe(FAIRWAY_DEMO_CLOCK_ISO);
    expect(integrity.ok).toBe(true);
    expect(integrity.fingerprint).toBe(verifyDemoUniverse(repeated).fingerprint);
    expect(universe.members.filter((member) => member.id === "demo-tom")).toHaveLength(1);
    expect(universe.members.find((member) => member.id === "demo-tom")?.displayName).toBe("Tom");
  });

  it("uses a believable naming mix with golf personality as a minority layer", () => {
    const universe = buildDemoUniverse();
    const counts = universe.members.reduce<Record<string, number>>((summary, member) => {
      summary[member.identityPool] = (summary[member.identityPool] ?? 0) + 1;
      return summary;
    }, {});

    expect(universe.members.length).toBeGreaterThanOrEqual(150);
    expect(universe.members.length).toBeLessThanOrEqual(300);
    expect((counts.realistic ?? 0) / universe.members.length).toBeGreaterThanOrEqual(0.75);
    expect(counts.subtleGolf).toBeGreaterThan(10);
    expect(counts.obviousGolf).toBeLessThanOrEqual(8);
    expect(counts.recognizableGolfCulture).toBeLessThanOrEqual(3);
    expect(universe.members.some((member) => member.displayName === "Bogey Nelson")).toBe(true);
    expect(universe.members.some((member) => member.displayName === "Ned Threeputt")).toBe(true);
  });

  it("derives Demo Tom's visible My Golf profile from canonical sessions and shot facts", () => {
    const universe = buildDemoUniverse();
    const tom = universe.members.find((member) => member.id === "demo-tom");
    expect(tom).toBeDefined();
    const profile = deriveDemoGolfProfile(universe, tom!.memberProfileId);
    const tomSessions = universe.sessions.filter((session) => session.memberProfileId === tom!.memberProfileId && session.endedAt);
    const tomShots = universe.shots.filter((shot) => shot.memberProfileId === tom!.memberProfileId);
    const driver = profile.performance.find((item) => item.clubCode === "driver");

    expect(profile.displayName).toBe("Tom");
    expect(tomSessions.length).toBeGreaterThanOrEqual(30);
    expect(tomSessions.length).toBeLessThanOrEqual(50);
    expect(tomShots.length).toBeGreaterThanOrEqual(200);
    expect(tomShots.length).toBeLessThanOrEqual(400);
    expect(profile.activity).toHaveLength(3);
    expect(driver?.sampleCount).toBe(43);
    expect(driver?.provenance).toContain("43 demo swings");
  });

  it("keeps scenario presets coherent and distinct", () => {
    for (const scenario of ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"] as const) {
      const universe = buildDemoUniverse({ scenario });
      expect(verifyDemoUniverse(universe).ok).toBe(true);
    }

    const lowInventory = buildDemoUniverse({ scenario: "low-inventory" });
    expect(lowInventory.facilityState.filter((state) => state.status === "available")).toHaveLength(3);
    expect(lowInventory.members.find((member) => member.id === "demo-tom")?.targetAvailableCreditUnits).toBeGreaterThanOrEqual(8);

    const incident = buildDemoUniverse({ scenario: "facility-incident" });
    expect(incident.facilityTasks.some((task) => task.taskType === "inspection")).toBe(true);
  });

  it("preserves new golfer empty-state truth without fake baselines", () => {
    const universe = buildDemoUniverse({ scenario: "new-member" });
    const newGolfer = universe.members.find((member) => member.id === "new-golfer");
    expect(newGolfer).toBeDefined();
    const profile = deriveDemoGolfProfile(universe, newGolfer!.memberProfileId);
    expect(profile.officialGolf.handicapIndex).toBeNull();
    expect(profile.performance).toHaveLength(0);
    expect(profile.activity).toHaveLength(0);
  });

  it("fails verification loudly when canonical identity data is corrupted", () => {
    const universe = buildDemoUniverse();
    universe.members[1] = { ...universe.members[1], email: universe.members[0].email };
    const integrity = verifyDemoUniverse(universe);
    expect(integrity.ok).toBe(false);
    expect(integrity.errors.some((error) => error.includes("Duplicate member email"))).toBe(true);
  });

  it("guards demo reset from running without explicit confirmation", () => {
    const result = spawnSync(process.execPath, ["scripts/demo-reset.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, FAIRWAY_DEMO_RESET_CONFIRM: "", DATABASE_URL: "" },
      encoding: "utf8",
      windowsHide: true,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicit confirmation");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoUniverse } from "@/demo-universe/universe";
import { authorizeSessionStart } from "@/domains/sessions/start-authorization";

describe("DU1 acceptance remediation round 2", () => {
  it("keeps realistic lightweight identities credible and non-procedural", () => {
    const realistic = buildDemoUniverse().members.filter(
      (member) => member.id.startsWith("lightweight-") && member.identityPool === "realistic",
    );
    const firstNames = realistic.map((member) => member.displayName.split(" ")[0]);
    const surnames = realistic.map((member) => member.displayName.split(" ").at(-1)!);
    const firstFrequency = frequency(firstNames);
    const surnameFrequency = frequency(surnames);
    const longestSurnameBlock = longestContiguousBlock(surnames);

    expect(realistic).toHaveLength(203);
    expect(new Set(realistic.map((member) => member.displayName)).size).toBe(203);
    expect(new Set(surnames).size).toBeGreaterThanOrEqual(120);
    expect(Math.max(...surnameFrequency.values())).toBeLessThanOrEqual(3);
    expect(Math.max(...firstFrequency.values())).toBeLessThanOrEqual(4);
    expect(longestSurnameBlock).toBeLessThanOrEqual(2);
  });

  it("does not derive funding events from target or final-balance deltas", () => {
    const source = readFileSync("src/demo-universe/universe.ts", "utf8");

    expect(source).not.toMatch(/targetAvailableCreditUnits\s*-\s*finalWithoutOpening/);
    expect(source).not.toMatch(/openingUnits\s*=\s*Math\.max/);
    expect(source).not.toContain("opening-development-grant");
  });

  it("requires database session start to authorize the access window at an injected clock", () => {
    const migrations = readdirSync("supabase/migrations")
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
      .join("\n");
    const functionSource = migrations.slice(migrations.lastIndexOf("create or replace function fairway_start_session"));

    expect(functionSource).toContain("p_now timestamptz");
    expect(functionSource).toContain("access_grants");
    expect(functionSource).toContain("SESSION_ACCESS_WINDOW_NOT_OPEN");
    expect(functionSource).toContain("SESSION_ACCESS_WINDOW_EXPIRED");
  });

  it("does not render Start Session from confirmed status alone", () => {
    const source = readFileSync("src-page/member-experience.tsx", "utf8");

    expect(source).not.toContain('const canStart = reservation.status === "confirmed";');
    expect(source).toContain("canStartSession");
    expect(source).toContain("Access opens at");
  });

  it("authorizes session start only inside the mapped access window", () => {
    const base = {
      requestingMemberProfileId: "member-a",
      reservation: { memberProfileId: "member-a", suiteId: "suite-10", status: "confirmed" as const },
      accessGrant: {
        memberProfileId: "member-a",
        suiteId: "suite-10",
        status: "active" as const,
        startsAt: new Date("2026-07-23T21:15:00.000Z"),
        expiresAt: new Date("2026-07-23T22:45:00.000Z"),
      },
    };

    expect(authorizeSessionStart({ ...base, now: new Date("2026-07-23T21:14:59.000Z") })).toEqual({
      allowed: false,
      reason: "SESSION_ACCESS_WINDOW_NOT_OPEN",
    });
    expect(authorizeSessionStart({ ...base, now: new Date("2026-07-23T21:15:00.000Z") })).toEqual({
      allowed: true,
      idempotent: false,
    });
    expect(authorizeSessionStart({ ...base, now: new Date("2026-07-23T22:44:59.000Z") })).toEqual({
      allowed: true,
      idempotent: false,
    });
    expect(authorizeSessionStart({ ...base, now: new Date("2026-07-23T22:45:00.000Z") })).toEqual({
      allowed: false,
      reason: "SESSION_ACCESS_WINDOW_EXPIRED",
    });
  });

  it("rejects ownership, lifecycle, and suite/access mapping conflicts", () => {
    const now = new Date("2026-07-23T20:00:00.000Z");
    const accessGrant = {
      memberProfileId: "member-a",
      suiteId: "suite-10",
      status: "active" as const,
      startsAt: new Date("2026-07-23T19:45:00.000Z"),
      expiresAt: new Date("2026-07-23T21:15:00.000Z"),
    };
    const reservation = { memberProfileId: "member-a", suiteId: "suite-10", status: "confirmed" as const };

    expect(authorizeSessionStart({ now, requestingMemberProfileId: "member-b", reservation, accessGrant })).toEqual({
      allowed: false,
      reason: "RESERVATION_NOT_OWNED",
    });
    expect(authorizeSessionStart({ now, requestingMemberProfileId: "member-a", reservation: { ...reservation, status: "cancelled" }, accessGrant })).toEqual({
      allowed: false,
      reason: "RESERVATION_NOT_STARTABLE",
    });
    expect(authorizeSessionStart({ now, requestingMemberProfileId: "member-a", reservation, accessGrant: { ...accessGrant, suiteId: "suite-9" } })).toEqual({
      allowed: false,
      reason: "SESSION_ACCESS_MAPPING_INVALID",
    });
  });
});

function frequency(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function longestContiguousBlock(values: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: string | undefined;
  for (const value of values) {
    current = value === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  }
  return longest;
}

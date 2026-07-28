import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { facilitiesEmptyTaskCopy, facilitiesHeaderCopy } from "@/application/facilities-flow/facilities-presentation";
import { memberAccessMessage } from "@/application/member-flow/member-presentation";
import { formatLocationDateTime, formatLocationTime } from "@/shared/location-time";
import { summarizeCaptureIdentity, validateEvidenceAssertion } from "../../scripts/du1-evidence-contract.mjs";

function source(file: string): string {
  return readFileSync(file, "utf8");
}

function migrations(): string {
  return readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => source(`supabase/migrations/${file}`))
    .join("\n");
}

describe("DU1 acceptance remediation round 3", () => {
  it("does not derive member access authority from the browser wall clock", () => {
    const member = source("src-page/member-experience.tsx");

    expect(member).not.toMatch(/accessGrantCopy[\s\S]*?Date\.now\(\)/);
    expect(member).not.toContain("const now = Date.now()");
    expect(memberAccessMessage({ accessWindowStatus: "active" }, "America/Chicago")).toBe("Access is open now.");
    expect(memberAccessMessage({
      accessWindowStatus: "scheduled",
      accessGrant: { startsAt: "2026-07-23T21:15:00.000Z" },
    }, "America/Chicago")).toBe("Access opens at 4:15 PM.");
    expect(memberAccessMessage({ accessWindowStatus: "expired" }, "America/Chicago")).toBe("Access is closed.");
  });

  it("writes completion and turnover timestamps from the authoritative transaction instant", () => {
    const completion = migrations().slice(migrations().lastIndexOf("create or replace function fairway_complete_session"));

    expect(completion).toContain("created_at, updated_at");
    expect(completion).toContain("p_now + make_interval(mins => v_location.turnover_buffer_minutes)");
    expect(completion).not.toMatch(/select min\(r\.start_at\)[\s\S]*?into v_due_at/);
  });

  it("does not equate an empty task queue with every suite being ready", () => {
    const facilities = source("src-page/facilities-experience.tsx");

    expect(facilities).not.toContain('state.tasks.length === 0 ? "All suites are ready."');
    expect(facilitiesHeaderCopy({ openTaskCount: 0, readySuiteCount: 11, totalSuiteCount: 12 })).toBe(
      "No service tasks are open. 11 suites ready.",
    );
    expect(facilitiesEmptyTaskCopy({ openTaskCount: 0, readySuiteCount: 11, totalSuiteCount: 12 })).toEqual({
      title: "No service tasks are open",
      detail: "11 of 12 suites are ready.",
    });
    expect(facilitiesHeaderCopy({ openTaskCount: 0, readySuiteCount: 12, totalSuiteCount: 12 })).toBe(
      "All suites are ready.",
    );
  });

  it("formats member and facilities timestamps using the configured location timezone", () => {
    const member = source("src-page/member-experience.tsx");
    const facilities = source("src-page/facilities-experience.tsx");

    expect(member).toContain("timeZone");
    expect(facilities).toContain("timeZone");
    expect(member).not.toMatch(/function formatTime\([^)]*\): string \{ return new Intl\.DateTimeFormat\("en-US", \{ hour: "numeric", minute: "2-digit" \}\)/);
    expect(facilities).not.toMatch(/function formatTime\([^)]*\): string \{ return new Intl\.DateTimeFormat\("en-US", \{ hour: "numeric", minute: "2-digit" \}\)/);
    expect(formatLocationTime("2026-07-23T20:00:00.000Z", "America/Chicago")).toBe("3:00 PM");
    expect(formatLocationDateTime("2026-07-23T21:15:00.000Z", "America/Chicago")).toBe("Jul 23, 4:15 PM");
  });

  it("requires stable capture identity and locator/state provenance", () => {
    const evidence = source("tests/experience-du1/support/du1-evidence.ts");
    const review = source("tests/experience-du1/du1-review.spec.ts");

    for (const field of ["captureId", "logicalStateId", "stepId", "evidenceType", "locator", "stateEvidence"]) {
      expect(evidence).toContain(field);
    }
    expect(review).not.toMatch(/id:\s*`assert:\$\{sourcePath\}:\$\{randomUUID\(\)\}`/);
  });

  it("counts logical states independently from viewports", () => {
    const bundler = source("scripts/du1-review-bundle.mjs");

    expect(bundler).toContain("summarizeCaptureIdentity(input.screenshots)");
    expect(bundler).not.toContain("`${item.viewport}:${item.scenario}:${item.persona}:${item.state}`");
    expect(summarizeCaptureIdentity([
      { captureId: "home:mobile", logicalStateId: "home", stepId: "home", viewport: "mobile" },
      { captureId: "home:desktop", logicalStateId: "home", stepId: "home", viewport: "desktop" },
      { captureId: "play:mobile", logicalStateId: "play", stepId: "play", viewport: "mobile" },
    ])).toEqual({
      totalCaptures: 3,
      uniqueLogicalStates: 2,
      viewportCounts: { desktop: 1, mobile: 2 },
    });
  });

  it("fails closed on missing step identity and assertion provenance", () => {
    expect(() => summarizeCaptureIdentity([{ captureId: "capture", logicalStateId: "state", viewport: "mobile" } as any])).toThrow("stepId");
    const capture = { reconciliationPath: "runtime/normal/step.json" };
    expect(() => validateEvidenceAssertion({
      id: "ui:test",
      evidenceType: "ui",
      sourceKind: "state-backed",
      sourcePath: "test",
      comparator: "contains",
      expected: "Tom",
      actual: "Tom",
      passed: true,
    }, capture)).toThrow("locator");
    expect(() => validateEvidenceAssertion({
      id: "state:test",
      evidenceType: "state",
      sourceKind: "state-backed",
      sourcePath: "test",
      comparator: "equals",
      expected: true,
      actual: true,
      locator: { kind: "text", value: "test" },
      passed: true,
    }, capture)).toThrow("reconciliation");
  });

  it("keeps the insufficient-credit fixture deterministic and retry-safe", () => {
    const personas = source("tests/experience/support/personas.ts");
    const fixture = personas.slice(personas.indexOf("export async function setCreditTarget"), personas.indexOf("export async function ensureTourPlanForProfile"));

    expect(fixture).not.toContain("Date.now()");
    expect(fixture).toContain("on conflict");
  });
});

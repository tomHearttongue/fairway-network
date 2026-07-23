import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UX review bundle provenance safeguards", () => {
  const source = readFileSync("scripts/ux-review-bundle.mjs", "utf8");

  it("requires a clean product tree and snapshots committed HEAD source", () => {
    expect(source).toContain("assertCleanProductTree()");
    expect(source).toContain("Cannot generate Product Acceptance bundle: working tree contains uncommitted product/source changes.");
    expect(source).toContain("ls-tree");
    expect(source).toContain("git show <commit>:<path>");
    expect(source).toContain("source/src/domains/reservations/pricing.ts");
    expect(source).toContain("source/supabase/migrations/202607230001_reservation_pricing_authority.sql");
  });

  it("self-verifies the generated zip provenance and secret exclusion", () => {
    expect(source).toContain("verifyGeneratedBundle");
    expect(source).toContain("Expand-Archive");
    expect(source).toContain("manifestCommitSha");
    expect(source).toContain("sourceSnapshotCommitSha");
    expect(source).toContain("assertNoSecrets(verifyRoot)");
  });
});

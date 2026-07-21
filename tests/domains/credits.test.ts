import { describe, expect, it } from "vitest";
import { CreditLedger } from "@/domains/credits/ledger";

const memberProfileId = "mp_test";
const createdAt = new Date("2026-07-20T17:00:00.000Z");

describe("CreditLedger", () => {
  it("records idempotent grants only once", () => {
    const ledger = new CreditLedger();
    ledger.grant({ memberProfileId, amount: 24, idempotencyKey: "grant-1", reason: "seed", createdAt });
    ledger.grant({ memberProfileId, amount: 24, idempotencyKey: "grant-1", reason: "seed retry", createdAt });

    expect(ledger.availableBalance(memberProfileId)).toBe(24);
    expect(ledger.all()).toHaveLength(1);
  });

  it("holds and commits credits without losing audit entries", () => {
    const ledger = new CreditLedger();
    ledger.grant({ memberProfileId, amount: 10, idempotencyKey: "grant", reason: "seed", createdAt });
    const hold = ledger.hold({ memberProfileId, amount: 2, idempotencyKey: "hold", reason: "reservation", createdAt });

    expect(ledger.availableBalance(memberProfileId)).toBe(8);

    ledger.commit({ memberProfileId, amount: 2, relatedEntryId: hold.id, idempotencyKey: "commit", reason: "confirmed", createdAt });

    expect(ledger.availableBalance(memberProfileId)).toBe(8);
    expect(ledger.all().map((entry) => entry.type)).toEqual(["grant", "hold", "commit"]);
  });
});

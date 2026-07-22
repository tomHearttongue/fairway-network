import { describe, expect, it } from "vitest";
import { canAddGuest, guestReadinessState } from "@/domains/guests/guest-policy";

describe("guest allowance policy", () => {
  it("allows a guest when the active count is within allowance", () => {
    expect(canAddGuest({ activeGuestCount: 0, guestAllowance: 1 })).toBe(true);
  });

  it("rejects a guest when the active count reaches allowance", () => {
    expect(canAddGuest({ activeGuestCount: 1, guestAllowance: 1 })).toBe(false);
  });
});

describe("guest readiness policy", () => {
  it("distinguishes waiver pending, ready, removed, and blocked states", () => {
    expect(guestReadinessState({ associationActive: true, waiverVerified: false, reservationEligible: true })).toBe("waiver_pending");
    expect(guestReadinessState({ associationActive: true, waiverVerified: true, reservationEligible: true })).toBe("ready");
    expect(guestReadinessState({ associationActive: false, waiverVerified: true, reservationEligible: true })).toBe("removed");
    expect(guestReadinessState({ associationActive: true, waiverVerified: true, reservationEligible: false })).toBe("blocked");
  });
});

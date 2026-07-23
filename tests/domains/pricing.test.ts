import { describe, expect, it } from "vitest";
import { locationOneConfig } from "@/domains/locations/types";
import { formatCredits, priceReservation } from "@/domains/reservations/pricing";

describe("reservation pricing policy", () => {
  it("prices 15-minute increments at the locked 0.5-credit granularity", () => {
    const offPeak = new Date("2026-07-20T10:00:00.000Z");
    const standard = new Date("2026-07-20T16:00:00.000Z");
    const prime = new Date("2026-07-20T23:00:00.000Z");

    expect(priceReservation({ location: locationOneConfig, startAt: offPeak, durationMinutes: 45 })).toMatchObject({ demandBand: "OFF_PEAK", creditUnits: 6, creditCost: 3 });
    expect(priceReservation({ location: locationOneConfig, startAt: standard, durationMinutes: 45 })).toMatchObject({ demandBand: "STANDARD", creditUnits: 9, creditCost: 4.5 });
    expect(priceReservation({ location: locationOneConfig, startAt: prime, durationMinutes: 45 })).toMatchObject({ demandBand: "PRIME", creditUnits: 12, creditCost: 6 });
  });

  it("formats half credits without binary floating-point display noise", () => {
    expect(formatCredits(4.5)).toBe("4.5");
    expect(formatCredits(6)).toBe("6");
  });
});

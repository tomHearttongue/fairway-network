import { describe, expect, it } from "vitest";
import { CreditLedger } from "@/domains/credits/ledger";
import { createSeedSuites, locationOneConfig } from "@/domains/locations/types";
import { TEST_BIRDIE } from "@/domains/membership/test-birdie";
import { addMinutes, calculateAvailability } from "@/domains/reservations/availability";
import { InMemoryReservationRepository } from "@/domains/reservations/in-memory-reservation-repository";
import { ReservationService } from "@/domains/reservations/reservation-service";
import type { Reservation } from "@/domains/reservations/types";
import { FixedClock } from "@/shared/clock";

const memberProfileId = "mp_test";

function createService(input?: { suites?: ReturnType<typeof createSeedSuites>; reservations?: Reservation[]; now?: Date }) {
  const ledger = new CreditLedger();
  const now = input?.now ?? new Date("2026-07-20T22:15:00.000Z");
  ledger.grant({ memberProfileId, amount: 100, idempotencyKey: "dev-grant", reason: "test", createdAt: now });

  return new ReservationService({
    clock: new FixedClock(now),
    location: locationOneConfig,
    suites: input?.suites ?? createSeedSuites(locationOneConfig),
    repository: new InMemoryReservationRepository(input?.reservations),
    ledger,
    membershipPlan: TEST_BIRDIE,
  });
}

describe("reservation availability", () => {
  it("calculates Play Now maximum duration while preserving turnover", () => {
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    const now = new Date("2026-07-20T22:15:00.000Z");
    const reservations: Reservation[] = [{ id: "res_next", locationId: locationOneConfig.id, suiteId: suites[0].id, memberProfileId: "mp_other", bookingMode: "ADVANCE", status: "confirmed", startAt: new Date("2026-07-20T23:15:00.000Z"), endAt: new Date("2026-07-21T00:15:00.000Z"), creditHoldEntryId: "hold_other", idempotencyKey: "reservation-next", createdAt: now }];

    const availability = calculateAvailability({ location: locationOneConfig, suites, reservations, at: now });

    expect(availability[0].maxPlayNowMinutes).toBe(45);
  });
});

describe("ReservationService", () => {
  it("enforces active future reservation limits", async () => {
    const now = new Date("2026-07-20T22:15:00.000Z");
    const suites = createSeedSuites(locationOneConfig);
    const reservations: Reservation[] = [0, 1].map((index) => ({ id: `res_${index}`, locationId: locationOneConfig.id, suiteId: suites[index].id, memberProfileId, bookingMode: "ADVANCE", status: "confirmed", startAt: addMinutes(now, 60 + index * 60), endAt: addMinutes(now, 90 + index * 60), creditHoldEntryId: `hold_${index}`, idempotencyKey: `existing-${index}`, createdAt: now }));
    const service = createService({ suites, reservations, now });

    await expect(service.createAdvanceReservation({ memberProfileId, suiteId: suites[2].id, startAt: addMinutes(now, 240), endAt: addMinutes(now, 270), creditCost: 1, idempotencyKey: "limit-test" })).rejects.toThrow("ACTIVE_RESERVATION_LIMIT_REACHED");
  });

  it("allows exactly one concurrent Play Now claim for the final suite", async () => {
    const now = new Date("2026-07-20T22:15:00.000Z");
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    const service = createService({ suites, now });

    const attempts = await Promise.allSettled([
      service.createPlayNowReservation({ memberProfileId, requestedMinutes: 30, creditCost: 1, idempotencyKey: "claim-a" }),
      service.createPlayNowReservation({ memberProfileId, requestedMinutes: 30, creditCost: 1, idempotencyKey: "claim-b" }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
  });
});


import { describe, expect, it } from "vitest";
import { createSeedSuites, locationOneConfig } from "@/domains/locations/types";
import { TEST_BIRDIE } from "@/domains/membership/test-birdie";
import { addMinutes, calculateAvailability } from "@/domains/reservations/availability";
import { InMemoryReservationRepository } from "@/domains/reservations/in-memory-reservation-repository";
import { ReservationService } from "@/domains/reservations/reservation-service";
import { CreditLedger } from "@/domains/credits/ledger";
import { FixedClock } from "@/shared/clock";

const memberProfileId = "mp_facility";
const now = new Date("2026-07-20T22:15:00.000Z");

describe("suite operational inventory behavior", () => {
  it("excludes maintenance suites from availability and Play Now assignment", async () => {
    const suites = createSeedSuites(locationOneConfig).slice(0, 2);
    suites[0] = { ...suites[0], status: "maintenance" };
    const ledger = new CreditLedger();
    ledger.grant({ memberProfileId, amount: 10, idempotencyKey: "grant-maintenance", reason: "test", createdAt: now });
    const service = new ReservationService({ clock: new FixedClock(now), location: locationOneConfig, suites, repository: new InMemoryReservationRepository(), ledger, membershipPlan: TEST_BIRDIE });

    const availability = calculateAvailability({ location: locationOneConfig, suites, reservations: [], at: now });
    expect(availability[0]).toMatchObject({ suiteId: suites[0].id, status: "unavailable", maxPlayNowMinutes: 0 });

    const reservation = await service.createPlayNowReservation({ memberProfileId, requestedMinutes: 30, idempotencyKey: "play-now-maintenance" });
    expect(reservation.suiteId).toBe(suites[1].id);
  });

  it("excludes administrative holds from advance reservations", async () => {
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    suites[0] = { ...suites[0], status: "administrative_hold" };
    const ledger = new CreditLedger();
    ledger.grant({ memberProfileId, amount: 10, idempotencyKey: "grant-hold", reason: "test", createdAt: now });
    const service = new ReservationService({ clock: new FixedClock(now), location: locationOneConfig, suites, repository: new InMemoryReservationRepository(), ledger, membershipPlan: TEST_BIRDIE });

    await expect(service.createAdvanceReservation({ memberProfileId, suiteId: suites[0].id, startAt: addMinutes(now, 60), endAt: addMinutes(now, 90), idempotencyKey: "advance-admin-hold" })).rejects.toThrow("SUITE_NOT_AVAILABLE");
  });

  it("restored suites return to eligible inventory without bypassing reservation protection", async () => {
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    const blocked = [{ ...suites[0], status: "maintenance" as const }];
    const restored = [{ ...suites[0], status: "available" as const }];

    expect(calculateAvailability({ location: locationOneConfig, suites: blocked, reservations: [], at: now })[0].status).toBe("unavailable");
    expect(calculateAvailability({ location: locationOneConfig, suites: restored, reservations: [], at: now })[0].status).toBe("available");

    const reservation = { id: "res_future", locationId: locationOneConfig.id, suiteId: suites[0].id, memberProfileId: "mp_other", bookingMode: "ADVANCE" as const, status: "confirmed" as const, startAt: addMinutes(now, 20), endAt: addMinutes(now, 60), creditHoldEntryId: "hold", idempotencyKey: "future", createdAt: now };
    const protectedAvailability = calculateAvailability({ location: locationOneConfig, suites: restored, reservations: [reservation], at: now });
    expect(protectedAvailability[0].status).toBe("reserved");
    expect(protectedAvailability[0].maxPlayNowMinutes).toBeLessThan(locationOneConfig.minimumSessionMinutes);
  });
});


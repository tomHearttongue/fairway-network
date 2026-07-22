import { describe, expect, it } from "vitest";
import { CreditLedger } from "@/domains/credits/ledger";
import { createSeedSuites, locationOneConfig } from "@/domains/locations/types";
import { TEST_BIRDIE } from "@/domains/membership/test-birdie";
import { addMinutes } from "@/domains/reservations/availability";
import { InMemoryReservationRepository } from "@/domains/reservations/in-memory-reservation-repository";
import { ReservationService } from "@/domains/reservations/reservation-service";
import type { CancelReservationRecord, CancelReservationResult, CreateReservationRecord, Reservation, ReservationRepository } from "@/domains/reservations/types";
import { FixedClock } from "@/shared/clock";

const memberProfileId = "mp_integration";
const now = new Date("2026-07-20T22:15:00.000Z");

function createHarness(initialReservations: Reservation[] = [], repository: ReservationRepository = new InMemoryReservationRepository(initialReservations)) {
  const ledger = new CreditLedger();
  ledger.grant({ memberProfileId, amount: 100, idempotencyKey: "grant", reason: "test grant", createdAt: now });

  const service = new ReservationService({
    clock: new FixedClock(now),
    location: locationOneConfig,
    suites: createSeedSuites(locationOneConfig),
    repository,
    ledger,
    membershipPlan: TEST_BIRDIE,
  });

  return { ledger, repository, service, suites: createSeedSuites(locationOneConfig) };
}

class FailingReservationRepository implements ReservationRepository {
  async listReservations(): Promise<Reservation[]> {
    return [];
  }

  async createReservationAtomically(_input: CreateReservationRecord): Promise<Reservation> {
    throw new Error("RESERVATION_WRITE_FAILED");
  }

  async cancelReservationAtomically(_input: CancelReservationRecord): Promise<CancelReservationResult> {
    throw new Error("RESERVATION_CANCEL_WRITE_FAILED");
  }
}

describe("member reservation and credit integration", () => {
  it("returns the original reservation and does not double-commit credits for a repeated idempotency key", async () => {
    const { ledger, service, suites } = createHarness();

    const input = {
      memberProfileId,
      suiteId: suites[0].id,
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 90),
      creditCost: 1,
      idempotencyKey: "repeatable-reservation",
    };

    const first = await service.createAdvanceReservation(input);
    const second = await service.createAdvanceReservation(input);

    expect(second.id).toBe(first.id);
    expect(ledger.availableBalance(memberProfileId)).toBe(99);
    expect(ledger.all().filter((entry) => entry.type === "commit")).toHaveLength(1);
  });

  it("does not create a credit hold when a reservation conflict is detected before persistence", async () => {
    const suites = createSeedSuites(locationOneConfig);
    const conflictingReservation: Reservation = {
      id: "res_conflict",
      locationId: locationOneConfig.id,
      suiteId: suites[0].id,
      memberProfileId: "mp_other",
      bookingMode: "ADVANCE",
      status: "confirmed",
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 90),
      creditHoldEntryId: "hold_conflict",
      idempotencyKey: "conflict-existing",
      createdAt: now,
    };
    const { ledger, service } = createHarness([conflictingReservation]);

    await expect(service.createAdvanceReservation({
      memberProfileId,
      suiteId: suites[0].id,
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 90),
      creditCost: 1,
      idempotencyKey: "conflicting-reservation",
    })).rejects.toThrow("RESERVATION_CONFLICT");

    expect(ledger.availableBalance(memberProfileId)).toBe(100);
    expect(ledger.all().map((entry) => entry.type)).toEqual(["grant"]);
  });

  it("releases a credit hold when persistence fails after credit validation", async () => {
    const { ledger, service, suites } = createHarness([], new FailingReservationRepository());

    await expect(service.createAdvanceReservation({
      memberProfileId,
      suiteId: suites[0].id,
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 90),
      creditCost: 1,
      idempotencyKey: "write-failure-reservation",
    })).rejects.toThrow("RESERVATION_WRITE_FAILED");

    expect(ledger.availableBalance(memberProfileId)).toBe(100);
    expect(ledger.all().map((entry) => entry.type)).toEqual(["grant", "hold", "release"]);
  });
});

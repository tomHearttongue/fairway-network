import { describe, expect, it } from "vitest";
import { CreditLedger } from "@/domains/credits/ledger";
import { canUseAccessGrant, revokeAccessGrant, type ManagedAccessGrant } from "@/domains/access/access-lifecycle";
import { createSeedSuites, locationOneConfig } from "@/domains/locations/types";
import { TEST_BIRDIE } from "@/domains/membership/test-birdie";
import { addMinutes, calculateAvailability } from "@/domains/reservations/availability";
import { InMemoryReservationRepository } from "@/domains/reservations/in-memory-reservation-repository";
import { ReservationService } from "@/domains/reservations/reservation-service";
import type { CancelReservationRecord, CancelReservationResult, CreateReservationRecord, Reservation, ReservationRepository } from "@/domains/reservations/types";
import { FixedClock } from "@/shared/clock";

const memberProfileId = "mp_test";

function createHarness(input?: { suites?: ReturnType<typeof createSeedSuites>; reservations?: Reservation[]; now?: Date; repository?: ReservationRepository }) {
  const ledger = new CreditLedger();
  const now = input?.now ?? new Date("2026-07-20T22:15:00.000Z");
  ledger.grant({ memberProfileId, amount: 100, idempotencyKey: "dev-grant", reason: "test", createdAt: now });

  const repository = input?.repository ?? new InMemoryReservationRepository(input?.reservations);
  const service = new ReservationService({
    clock: new FixedClock(now),
    location: locationOneConfig,
    suites: input?.suites ?? createSeedSuites(locationOneConfig),
    repository,
    ledger,
    membershipPlan: TEST_BIRDIE,
  });

  return { ledger, repository, service, suites: input?.suites ?? createSeedSuites(locationOneConfig), now };
}

async function createFutureReservation(harness = createHarness()) {
  const reservation = await harness.service.createAdvanceReservation({
    memberProfileId,
    suiteId: harness.suites[0].id,
    startAt: addMinutes(harness.now, 60),
    endAt: addMinutes(harness.now, 90),
    idempotencyKey: "future-reservation",
  });
  return { ...harness, reservation };
}

class FailingCancellationRepository extends InMemoryReservationRepository {
  async cancelReservationAtomically(_input: CancelReservationRecord): Promise<CancelReservationResult> {
    throw new Error("RESERVATION_CANCEL_WRITE_FAILED");
  }
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
    const { service } = createHarness({ suites, reservations, now });

    await expect(service.createAdvanceReservation({ memberProfileId, suiteId: suites[2].id, startAt: addMinutes(now, 240), endAt: addMinutes(now, 270), idempotencyKey: "limit-test" })).rejects.toThrow("ACTIVE_RESERVATION_LIMIT_REACHED");
  });


  it("uses server-derived demand-band pricing even if a caller includes an understated credit cost", async () => {
    const now = new Date("2026-07-20T17:00:00.000Z");
    const harness = createHarness({ now });

    await harness.service.createAdvanceReservation({
      memberProfileId,
      suiteId: harness.suites[0].id,
      startAt: addMinutes(now, 60),
      endAt: addMinutes(now, 105),
      idempotencyKey: "authoritative-price",
      creditCost: 0,
    } as any);

    expect(harness.ledger.availableBalance(memberProfileId)).toBe(95.5);
    const commit = harness.ledger.all().find((entry) => entry.type === "commit");
    expect(commit?.amount).toBe(4.5);
  });

  it("rejects stale Play Now confirmations when the requested duration no longer fits", async () => {
    const now = new Date("2026-07-20T22:15:00.000Z");
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    const reservations: Reservation[] = [{ id: "res_next", locationId: locationOneConfig.id, suiteId: suites[0].id, memberProfileId: "mp_other", bookingMode: "ADVANCE", status: "confirmed", startAt: addMinutes(now, 60), endAt: addMinutes(now, 90), creditHoldEntryId: "hold_other", idempotencyKey: "existing-next", createdAt: now }];
    const harness = createHarness({ suites, reservations, now });

    await expect(harness.service.createPlayNowReservation({ memberProfileId, requestedMinutes: 60, idempotencyKey: "stale-play-now-duration" })).rejects.toThrow("PLAY_NOW_DURATION_UNAVAILABLE");
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(100);
  });

  it("allows exactly one concurrent Play Now claim for the final suite", async () => {
    const now = new Date("2026-07-20T22:15:00.000Z");
    const suites = createSeedSuites(locationOneConfig).slice(0, 1);
    const { service } = createHarness({ suites, now });

    const attempts = await Promise.allSettled([
      service.createPlayNowReservation({ memberProfileId, requestedMinutes: 30, idempotencyKey: "claim-a" }),
      service.createPlayNowReservation({ memberProfileId, requestedMinutes: 30, idempotencyKey: "claim-b" }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
  });

  it("retrieves upcoming and historical member reservations", async () => {
    const harness = createHarness();
    const { service, reservation } = await createFutureReservation(harness);
    await service.cancelReservation({ memberProfileId, reservationId: reservation.id, idempotencyKey: "cancel-retrieval" });
    const lists = await service.listMemberReservations(memberProfileId, harness.now);

    expect(lists.upcoming).toHaveLength(0);
    expect(lists.history).toHaveLength(1);
    expect(lists.history[0].status).toBe("cancelled");
  });

  it("cancels a future reservation and restores credits exactly once", async () => {
    const harness = await createFutureReservation();
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(96);

    const result = await harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-once" });

    expect(result.reservation.status).toBe("cancelled");
    expect(result.refundedCredits).toBe(4);
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(100);
    expect(harness.ledger.all().map((entry) => entry.type)).toEqual(["grant", "hold", "commit", "refund"]);
  });

  it("does not double-credit repeated cancellation", async () => {
    const harness = await createFutureReservation();

    await harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-repeat" });
    const retry = await harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-repeat" });

    expect(retry.idempotent).toBe(true);
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(100);
    expect(harness.ledger.all().filter((entry) => entry.type === "refund")).toHaveLength(1);
  });

  it("does not corrupt the ledger when cancellation persistence fails", async () => {
    const seedRepository = new InMemoryReservationRepository();
    const seeded = createHarness({ repository: seedRepository });
    const reservation = await seeded.service.createAdvanceReservation({ memberProfileId, suiteId: seeded.suites[0].id, startAt: addMinutes(seeded.now, 60), endAt: addMinutes(seeded.now, 90), idempotencyKey: "seed-before-failure" });
    const failingRepository = new FailingCancellationRepository(await seedRepository.listReservations(locationOneConfig.id));
    const harness = createHarness({ repository: failingRepository, now: seeded.now });
    harness.ledger.hold({ memberProfileId, amount: 1, idempotencyKey: "seed-before-failure:credit-hold", reason: "seed", createdAt: seeded.now });
    harness.ledger.commit({ memberProfileId, amount: 1, relatedEntryId: "cred_2", idempotencyKey: "seed-before-failure:credit-commit", reason: "seed", createdAt: seeded.now });

    await expect(harness.service.cancelReservation({ memberProfileId, reservationId: reservation.id, idempotencyKey: "cancel-fails" })).rejects.toThrow("RESERVATION_CANCEL_WRITE_FAILED");

    expect(harness.ledger.availableBalance(memberProfileId)).toBe(99);
    expect(harness.ledger.all().filter((entry) => entry.type === "refund")).toHaveLength(0);
  });

  it("allows only one effective refund for concurrent cancellation requests", async () => {
    const harness = await createFutureReservation();

    const attempts = await Promise.allSettled([
      harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-concurrent-a" }),
      harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-concurrent-b" }),
    ]);

    expect(attempts.every((attempt) => attempt.status === "fulfilled")).toBe(true);
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(100);
    expect(harness.ledger.all().filter((entry) => entry.type === "refund")).toHaveLength(1);
  });

  it("invalidates simulated access grants on cancellation", async () => {
    const now = new Date("2026-07-20T22:15:00.000Z");
    const grant: ManagedAccessGrant = { id: "access_1", reservationId: "res_1", memberProfileId, locationId: locationOneConfig.id, suiteId: "suite_1", startsAt: addMinutes(now, -15), expiresAt: addMinutes(now, 45), provider: "fake", credentialLabel: "Simulated mobile unlock", status: "active" };

    expect(canUseAccessGrant(grant, now)).toBe(true);
    const revoked = revokeAccessGrant(grant, now);

    expect(revoked.status).toBe("revoked");
    expect(canUseAccessGrant(revoked, now)).toBe(false);
  });

  it("rejects member cancellation after a session has started", async () => {
    const harness = await createFutureReservation();

    await expect(harness.service.cancelReservation({ memberProfileId, reservationId: harness.reservation.id, idempotencyKey: "cancel-after-session", hasStartedSession: true })).rejects.toThrow("SESSION_ALREADY_STARTED");
    expect(harness.ledger.availableBalance(memberProfileId)).toBe(96);
  });
});






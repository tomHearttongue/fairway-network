import { CreditLedger } from "@/domains/credits/ledger";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { MembershipPlanSeed } from "@/domains/membership/test-birdie";
import { addMinutes, calculateAvailability, overlaps } from "@/domains/reservations/availability";
import type { BookingMode, Reservation, ReservationRepository } from "@/domains/reservations/types";
import type { Clock } from "@/shared/clock";

export class ReservationService {
  constructor(private readonly dependencies: { clock: Clock; location: LocationConfig; suites: PracticeSuite[]; repository: ReservationRepository; ledger: CreditLedger; membershipPlan: MembershipPlanSeed }) {}

  async getAvailability(at = this.dependencies.clock.now()) {
    return calculateAvailability({ location: this.dependencies.location, suites: this.dependencies.suites, reservations: await this.dependencies.repository.listReservations(this.dependencies.location.id), at });
  }

  async createAdvanceReservation(input: CreateReservationInput): Promise<Reservation> {
    return this.createReservation({ ...input, bookingMode: "ADVANCE" });
  }

  async createPlayNowReservation(input: CreatePlayNowInput): Promise<Reservation> {
    if (!this.dependencies.location.playNowEnabled || !this.dependencies.membershipPlan.playNowEnabled) throw new Error("PLAY_NOW_DISABLED");
    const now = this.dependencies.clock.now();
    const availability = await this.getAvailability(now);
    const candidate = availability.find((slot) => slot.status === "available" && slot.maxPlayNowMinutes >= this.dependencies.location.minimumSessionMinutes);
    if (!candidate) throw new Error("NO_SUITE_AVAILABLE");
    const requestedMinutes = input.requestedMinutes ?? candidate.maxPlayNowMinutes;
    const durationMinutes = Math.min(requestedMinutes, candidate.maxPlayNowMinutes);
    if (durationMinutes < this.dependencies.location.minimumSessionMinutes) throw new Error("PLAY_NOW_TOO_SHORT");

    return this.createReservation({ memberProfileId: input.memberProfileId, suiteId: candidate.suiteId, bookingMode: "PLAY_NOW", startAt: now, endAt: addMinutes(now, durationMinutes), creditCost: input.creditCost, idempotencyKey: input.idempotencyKey });
  }

  private async createReservation(input: CreateReservationInput & { bookingMode: BookingMode }): Promise<Reservation> {
    const now = this.dependencies.clock.now();
    const activeFutureCount = (await this.dependencies.repository.listReservations(this.dependencies.location.id)).filter(
      (reservation) => reservation.memberProfileId === input.memberProfileId && reservation.startAt > now && reservation.status === "confirmed",
    ).length;

    if (input.bookingMode === "ADVANCE" && activeFutureCount >= this.dependencies.membershipPlan.maxActiveFutureReservations) throw new Error("ACTIVE_RESERVATION_LIMIT_REACHED");
    if (input.bookingMode === "ADVANCE" && input.startAt > addMinutes(now, this.dependencies.membershipPlan.bookingWindowDays * 24 * 60)) throw new Error("BOOKING_WINDOW_EXCEEDED");

    const suite = this.dependencies.suites.find((item) => item.id === input.suiteId);
    if (!suite || suite.status !== "available") throw new Error("SUITE_NOT_AVAILABLE");

    const existingReservations = await this.dependencies.repository.listReservations(this.dependencies.location.id);
    if (existingReservations.some((reservation) => reservation.suiteId === input.suiteId && reservation.status === "confirmed" && overlaps(input.startAt, input.endAt, reservation.startAt, reservation.endAt))) throw new Error("RESERVATION_CONFLICT");

    const hold = this.dependencies.ledger.hold({ memberProfileId: input.memberProfileId, amount: input.creditCost, idempotencyKey: `${input.idempotencyKey}:credit-hold`, reason: `${input.bookingMode} reservation credit hold`, createdAt: now });

    try {
      const reservation = await this.dependencies.repository.createReservationAtomically({ locationId: this.dependencies.location.id, suiteId: input.suiteId, memberProfileId: input.memberProfileId, bookingMode: input.bookingMode, startAt: input.startAt, endAt: input.endAt, creditHoldEntryId: hold.id, createdAt: now });
      this.dependencies.ledger.commit({ memberProfileId: input.memberProfileId, amount: input.creditCost, relatedEntryId: hold.id, idempotencyKey: `${input.idempotencyKey}:credit-commit`, reason: `${input.bookingMode} reservation credit commit`, createdAt: now });
      return reservation;
    } catch (error) {
      this.dependencies.ledger.release({ memberProfileId: input.memberProfileId, amount: input.creditCost, relatedEntryId: hold.id, idempotencyKey: `${input.idempotencyKey}:credit-release`, reason: `${input.bookingMode} reservation conflict release`, createdAt: now });
      throw error;
    }
  }
}

export interface CreateReservationInput {
  memberProfileId: string;
  suiteId: string;
  startAt: Date;
  endAt: Date;
  creditCost: number;
  idempotencyKey: string;
}

export interface CreatePlayNowInput {
  memberProfileId: string;
  requestedMinutes?: number;
  creditCost: number;
  idempotencyKey: string;
}

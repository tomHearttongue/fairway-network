import { CreditLedger } from "@/domains/credits/ledger";
import type { CreditLedgerEntry } from "@/domains/credits/ledger";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { MembershipPlanSeed } from "@/domains/membership/test-birdie";
import { addMinutes, calculateAvailability, overlaps } from "@/domains/reservations/availability";
import { assertMemberCancellationAllowed } from "@/domains/reservations/lifecycle";
import type { BookingMode, Reservation, ReservationRepository } from "@/domains/reservations/types";
import type { Clock } from "@/shared/clock";

const DEVELOPMENT_CANCELLATION_REASON = "Development cancellation policy: member cancelled before reservation start time";

export class ReservationService {
  constructor(private readonly dependencies: { clock: Clock; location: LocationConfig; suites: PracticeSuite[]; repository: ReservationRepository; ledger: CreditLedger; membershipPlan: MembershipPlanSeed }) {}

  async getAvailability(at = this.dependencies.clock.now()) {
    return calculateAvailability({ location: this.dependencies.location, suites: this.dependencies.suites, reservations: await this.dependencies.repository.listReservations(this.dependencies.location.id), at });
  }

  async listMemberReservations(memberProfileId: string, at = this.dependencies.clock.now()): Promise<MemberReservationLists> {
    const reservations = (await this.dependencies.repository.listReservations(this.dependencies.location.id))
      .filter((reservation) => reservation.memberProfileId === memberProfileId)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return {
      upcoming: reservations.filter((reservation) => reservation.startAt >= at && reservation.status !== "cancelled" && reservation.status !== "completed"),
      history: reservations.filter((reservation) => reservation.startAt < at || reservation.status === "cancelled" || reservation.status === "completed"),
    };
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

  async cancelReservation(input: CancelReservationInput): Promise<CancelReservationOutput> {
    const now = this.dependencies.clock.now();
    const reservations = await this.dependencies.repository.listReservations(this.dependencies.location.id);
    const reservation = reservations.find((item) => item.id === input.reservationId && item.memberProfileId === input.memberProfileId);
    if (!reservation) throw new Error("RESERVATION_NOT_FOUND");

    assertMemberCancellationAllowed({ reservation, now, hasStartedSession: input.hasStartedSession });
    if (reservation.status === "cancelled") return { reservation, refundedCredits: 0, idempotent: true };

    const commit = this.dependencies.ledger.committedEntryForHold(reservation.creditHoldEntryId, input.memberProfileId);
    if (!commit) throw new Error("CREDIT_COMMIT_NOT_FOUND");

    const cancellation = await this.dependencies.repository.cancelReservationAtomically({
      reservationId: input.reservationId,
      memberProfileId: input.memberProfileId,
      cancelledAt: now,
      reason: DEVELOPMENT_CANCELLATION_REASON,
      idempotencyKey: input.idempotencyKey,
    });

    if (!cancellation.transitioned) return { reservation: cancellation.reservation, refundedCredits: 0, idempotent: true };

    const refund = this.dependencies.ledger.refund({
      memberProfileId: input.memberProfileId,
      amount: commit.amount,
      relatedEntryId: commit.id,
      idempotencyKey: `${input.reservationId}:credit-refund`,
      reason: DEVELOPMENT_CANCELLATION_REASON,
      createdAt: now,
    });

    return { reservation: cancellation.reservation, refundedCredits: refund.amount, refundEntry: refund, idempotent: false };
  }

  private async createReservation(input: CreateReservationInput & { bookingMode: BookingMode }): Promise<Reservation> {
    const now = this.dependencies.clock.now();
    const existingReservations = await this.dependencies.repository.listReservations(this.dependencies.location.id);
    const idempotentReservation = existingReservations.find((reservation) => reservation.idempotencyKey === input.idempotencyKey);
    if (idempotentReservation) return idempotentReservation;

    const activeFutureCount = existingReservations.filter(
      (reservation) => reservation.memberProfileId === input.memberProfileId && reservation.startAt > now && reservation.status === "confirmed",
    ).length;

    if (input.bookingMode === "ADVANCE" && activeFutureCount >= this.dependencies.membershipPlan.maxActiveFutureReservations) throw new Error("ACTIVE_RESERVATION_LIMIT_REACHED");
    if (input.bookingMode === "ADVANCE" && input.startAt > addMinutes(now, this.dependencies.membershipPlan.bookingWindowDays * 24 * 60)) throw new Error("BOOKING_WINDOW_EXCEEDED");

    const suite = this.dependencies.suites.find((item) => item.id === input.suiteId);
    if (!suite || suite.status !== "available") throw new Error("SUITE_NOT_AVAILABLE");

    if (existingReservations.some((reservation) => reservation.suiteId === input.suiteId && reservation.status === "confirmed" && overlaps(input.startAt, input.endAt, reservation.startAt, reservation.endAt))) throw new Error("RESERVATION_CONFLICT");

    const hold = this.dependencies.ledger.hold({ memberProfileId: input.memberProfileId, amount: input.creditCost, idempotencyKey: `${input.idempotencyKey}:credit-hold`, reason: `${input.bookingMode} reservation credit hold`, createdAt: now });

    try {
      const reservation = await this.dependencies.repository.createReservationAtomically({ locationId: this.dependencies.location.id, suiteId: input.suiteId, memberProfileId: input.memberProfileId, bookingMode: input.bookingMode, startAt: input.startAt, endAt: input.endAt, creditHoldEntryId: hold.id, createdAt: now, idempotencyKey: input.idempotencyKey });
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

export interface CancelReservationInput {
  memberProfileId: string;
  reservationId: string;
  idempotencyKey: string;
  hasStartedSession?: boolean;
}

export interface CancelReservationOutput {
  reservation: Reservation;
  refundedCredits: number;
  idempotent: boolean;
  refundEntry?: CreditLedgerEntry;
}

export interface MemberReservationLists {
  upcoming: Reservation[];
  history: Reservation[];
}

import { overlaps } from "@/domains/reservations/availability";
import { assertReservationTransition } from "@/domains/reservations/lifecycle";
import type { CancelReservationRecord, CancelReservationResult, CreateReservationRecord, Reservation, ReservationRepository } from "@/domains/reservations/types";

const ACTIVE_STATUSES = new Set(["held", "confirmed", "checked_in"]);

export class InMemoryReservationRepository implements ReservationRepository {
  private reservations: Reservation[] = [];
  private transaction = Promise.resolve();

  constructor(initialReservations: Reservation[] = []) {
    this.reservations = [...initialReservations];
  }

  async listReservations(locationId: string): Promise<Reservation[]> {
    return this.reservations.filter((reservation) => reservation.locationId === locationId).map(cloneReservation);
  }

  async createReservationAtomically(input: CreateReservationRecord): Promise<Reservation> {
    const operation = this.transaction.then(() => {
      const existing = this.reservations.find((reservation) => reservation.idempotencyKey === input.idempotencyKey);
      if (existing) return cloneReservation(existing);

      const conflict = this.reservations.some((reservation) =>
        reservation.locationId === input.locationId &&
        reservation.suiteId === input.suiteId &&
        ACTIVE_STATUSES.has(reservation.status) &&
        overlaps(input.startAt, input.endAt, reservation.startAt, reservation.endAt),
      );

      if (conflict) throw new Error("RESERVATION_CONFLICT");

      const reservation: Reservation = { id: `res_${this.reservations.length + 1}`, ...input, status: "confirmed" };
      this.reservations.push(reservation);
      return cloneReservation(reservation);
    });

    this.transaction = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async cancelReservationAtomically(input: CancelReservationRecord): Promise<CancelReservationResult> {
    const operation = this.transaction.then(() => {
      const index = this.reservations.findIndex((reservation) => reservation.id === input.reservationId && reservation.memberProfileId === input.memberProfileId);
      if (index === -1) throw new Error("RESERVATION_NOT_FOUND");

      const reservation = this.reservations[index];
      if (reservation.status === "cancelled") return { reservation: cloneReservation(reservation), transitioned: false };

      assertReservationTransition(reservation.status, "cancelled");
      const cancelled: Reservation = { ...reservation, status: "cancelled", cancelledAt: new Date(input.cancelledAt), cancellationReason: input.reason };
      this.reservations[index] = cancelled;
      return { reservation: cloneReservation(cancelled), transitioned: true };
    });

    this.transaction = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

function cloneReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    startAt: new Date(reservation.startAt),
    endAt: new Date(reservation.endAt),
    createdAt: new Date(reservation.createdAt),
    cancelledAt: reservation.cancelledAt ? new Date(reservation.cancelledAt) : undefined,
  };
}

import { overlaps } from "@/domains/reservations/availability";
import type { CreateReservationRecord, Reservation, ReservationRepository } from "@/domains/reservations/types";

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
}

function cloneReservation(reservation: Reservation): Reservation {
  return { ...reservation, startAt: new Date(reservation.startAt), endAt: new Date(reservation.endAt), createdAt: new Date(reservation.createdAt) };
}

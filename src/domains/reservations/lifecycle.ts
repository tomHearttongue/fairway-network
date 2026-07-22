import type { Reservation, ReservationStatus } from "@/domains/reservations/types";

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  held: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "completed"],
  checked_in: ["completed"],
  cancelled: [],
  completed: [],
};

export function assertReservationTransition(current: ReservationStatus, next: ReservationStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) throw new Error(`INVALID_RESERVATION_TRANSITION:${current}->${next}`);
}

export function assertMemberCancellationAllowed(input: { reservation: Reservation; now: Date; hasStartedSession?: boolean }): void {
  if (input.reservation.status === "cancelled") return;
  if (input.hasStartedSession || input.reservation.status === "checked_in") throw new Error("SESSION_ALREADY_STARTED");
  if (input.reservation.status !== "confirmed") throw new Error("RESERVATION_NOT_CANCELLABLE");
  if (input.reservation.startAt <= input.now) throw new Error("RESERVATION_CANCELLATION_CUTOFF_PASSED");
  assertReservationTransition(input.reservation.status, "cancelled");
}

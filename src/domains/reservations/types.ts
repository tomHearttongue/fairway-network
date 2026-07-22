export type BookingMode = "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
export type ReservationStatus = "held" | "confirmed" | "checked_in" | "cancelled" | "completed";

export interface Reservation {
  id: string;
  locationId: string;
  suiteId: string;
  memberProfileId: string;
  bookingMode: BookingMode;
  status: ReservationStatus;
  startAt: Date;
  endAt: Date;
  creditHoldEntryId: string;
  idempotencyKey: string;
  createdAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface AvailabilitySlot {
  suiteId: string;
  suiteName: string;
  status: "available" | "reserved" | "unavailable";
  availableUntil?: Date;
  nextReservationStartAt?: Date;
  maxPlayNowMinutes: number;
}

export interface CancelReservationResult {
  reservation: Reservation;
  transitioned: boolean;
}

export interface ReservationRepository {
  listReservations(locationId: string): Promise<Reservation[]>;
  createReservationAtomically(input: CreateReservationRecord): Promise<Reservation>;
  cancelReservationAtomically(input: CancelReservationRecord): Promise<CancelReservationResult>;
}

export interface CreateReservationRecord {
  locationId: string;
  suiteId: string;
  memberProfileId: string;
  bookingMode: BookingMode;
  startAt: Date;
  endAt: Date;
  creditHoldEntryId: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface CancelReservationRecord {
  reservationId: string;
  memberProfileId: string;
  cancelledAt: Date;
  reason: string;
  idempotencyKey: string;
}

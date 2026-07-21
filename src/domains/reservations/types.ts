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
}

export interface AvailabilitySlot {
  suiteId: string;
  suiteName: string;
  status: "available" | "reserved" | "unavailable";
  availableUntil?: Date;
  nextReservationStartAt?: Date;
  maxPlayNowMinutes: number;
}

export interface ReservationRepository {
  listReservations(locationId: string): Promise<Reservation[]>;
  createReservationAtomically(input: CreateReservationRecord): Promise<Reservation>;
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

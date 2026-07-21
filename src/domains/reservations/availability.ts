import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { AvailabilitySlot, Reservation } from "@/domains/reservations/types";

const ACTIVE_STATUSES = new Set(["held", "confirmed", "checked_in"]);

export function calculateAvailability(input: { location: LocationConfig; suites: PracticeSuite[]; reservations: Reservation[]; at: Date }): AvailabilitySlot[] {
  const activeReservations = input.reservations.filter((reservation) => ACTIVE_STATUSES.has(reservation.status));

  return input.suites.map((suite) => {
    if (suite.status !== "available") {
      return { suiteId: suite.id, suiteName: suite.name, status: "unavailable", maxPlayNowMinutes: 0 };
    }

    const currentReservation = activeReservations.find((reservation) =>
      reservation.suiteId === suite.id && overlaps(input.at, addMinutes(input.at, input.location.minimumSessionMinutes), reservation.startAt, reservation.endAt),
    );

    if (currentReservation) {
      return { suiteId: suite.id, suiteName: suite.name, status: "reserved", nextReservationStartAt: currentReservation.startAt, maxPlayNowMinutes: 0 };
    }

    const nextReservation = activeReservations
      .filter((reservation) => reservation.suiteId === suite.id && reservation.startAt > input.at)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
    const availableUntil = nextReservation ? addMinutes(nextReservation.startAt, -input.location.turnoverBufferMinutes) : undefined;
    const rawMinutes = availableUntil ? minutesBetween(input.at, availableUntil) : input.location.minimumSessionMinutes * 4;
    const maxPlayNowMinutes = floorToIncrement(Math.max(0, rawMinutes), input.location.bookingIncrementMinutes);

    return {
      suiteId: suite.id,
      suiteName: suite.name,
      status: maxPlayNowMinutes >= input.location.minimumSessionMinutes ? "available" : "reserved",
      availableUntil,
      nextReservationStartAt: nextReservation?.startAt,
      maxPlayNowMinutes,
    };
  });
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function floorToIncrement(minutes: number, increment: number): number {
  return Math.floor(minutes / increment) * increment;
}

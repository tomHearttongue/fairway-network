import type { LocationConfig } from "@/domains/locations/types";

export type DemandBand = "OFF_PEAK" | "STANDARD" | "PRIME";

export interface DemandBandWindow {
  band: DemandBand;
  startsAtMinute: number;
  endsAtMinute: number;
  creditUnitsPerHour: number;
}

export interface ReservationPrice {
  demandBand: DemandBand;
  creditUnits: number;
  creditCost: number;
}

export const CREDIT_UNITS_PER_CREDIT = 2;

export const LOCATION_ONE_DEMO_DEMAND_BANDS: DemandBandWindow[] = [
  { band: "OFF_PEAK", startsAtMinute: 0, endsAtMinute: 6 * 60, creditUnitsPerHour: 8 },
  { band: "STANDARD", startsAtMinute: 6 * 60, endsAtMinute: 16 * 60, creditUnitsPerHour: 12 },
  { band: "PRIME", startsAtMinute: 16 * 60, endsAtMinute: 21 * 60, creditUnitsPerHour: 16 },
  { band: "OFF_PEAK", startsAtMinute: 21 * 60, endsAtMinute: 0, creditUnitsPerHour: 8 },
];

export function priceReservation(input: { location: LocationConfig; startAt: Date; durationMinutes: number; windows?: DemandBandWindow[] }): ReservationPrice {
  const increment = input.location.bookingIncrementMinutes;
  if (input.durationMinutes <= 0 || input.durationMinutes % increment !== 0) throw new Error("INVALID_BOOKING_INCREMENT");

  const window = demandBandForTime(input.startAt, input.location.timezone, input.windows ?? LOCATION_ONE_DEMO_DEMAND_BANDS);
  const units = (window.creditUnitsPerHour * input.durationMinutes) / 60;
  if (!Number.isInteger(units)) throw new Error("INVALID_CREDIT_PRECISION");

  return { demandBand: window.band, creditUnits: units, creditCost: units / CREDIT_UNITS_PER_CREDIT };
}

export function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function demandBandForTime(startAt: Date, timezone: string, windows: DemandBandWindow[]): DemandBandWindow {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(startAt);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  const window = windows.find((candidate) => {
    if (candidate.startsAtMinute < candidate.endsAtMinute) return minutes >= candidate.startsAtMinute && minutes < candidate.endsAtMinute;
    return minutes >= candidate.startsAtMinute || minutes < candidate.endsAtMinute;
  });
  if (!window) throw new Error("DEMAND_BAND_NOT_CONFIGURED");
  return window;
}




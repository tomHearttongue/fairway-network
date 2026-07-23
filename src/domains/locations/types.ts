export interface LocationConfig {
  id: string;
  name: string;
  timezone: string;
  suiteCount: number;
  minimumSessionMinutes: number;
  bookingIncrementMinutes: number;
  turnoverBufferMinutes: number;
  accessBeforeMinutes: number;
  accessAfterMinutes: number;
  playNowEnabled: boolean;
}

export interface PracticeSuite {
  id: string;
  locationId: string;
  name: string;
  status: SuiteStatus;
}

export type SuiteStatus = "available" | "occupied" | "turnover" | "inspection_required" | "maintenance" | "out_of_service" | "administrative_hold";

export const locationOneConfig: LocationConfig = {
  id: "loc_kc_001",
  name: "Fairway KC",
  timezone: "America/Chicago",
  suiteCount: 12,
  minimumSessionMinutes: 30,
  bookingIncrementMinutes: 15,
  turnoverBufferMinutes: 15,
  accessBeforeMinutes: 15,
  accessAfterMinutes: 15,
  playNowEnabled: true,
};

export function createSeedSuites(location: LocationConfig): PracticeSuite[] {
  return Array.from({ length: location.suiteCount }, (_, index) => ({
    id: `${location.id}_suite_${String(index + 1).padStart(2, "0")}`,
    locationId: location.id,
    name: `Practice Suite ${index + 1}`,
    status: "available",
  }));
}


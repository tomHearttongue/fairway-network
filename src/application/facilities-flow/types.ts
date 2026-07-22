import type { LocationConfig, SuiteStatus } from "@/domains/locations/types";

export interface FacilitiesState {
  actor: { memberProfileId: string };
  location: LocationConfig;
  suites: FacilitiesSuite[];
  tasks: FacilityTask[];
  auditEvents: FacilityAuditEvent[];
}

export interface FacilitiesSuite {
  id: string;
  locationId: string;
  name: string;
  status: SuiteStatus;
  occupiedUntil?: Date | null;
  nextReservationAt?: Date | null;
  minutesUntilNextReservation?: number | null;
  openTaskCount: number;
}

export interface FacilityTask {
  id: string;
  locationId: string;
  suiteId: string;
  suiteName: string;
  taskType: "turnover" | "inspection";
  priority: number;
  status: "open" | "claimed" | "in_progress" | "completed" | "cancelled";
  dueAt?: Date | null;
  createdAt: Date;
  claimedBySelf: boolean;
  claimedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  nextReservationAt?: Date | null;
  minutesUntilNextReservation?: number | null;
  occupiedUntil?: Date | null;
}

export interface FacilityAuditEvent {
  id: string;
  type: string;
  actorId: string;
  resourceId: string;
  reason: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface FacilityTaskMutationResult {
  task: FacilityTask;
  idempotent: boolean;
  suite?: FacilitiesSuite;
}
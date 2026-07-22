import type { LocationConfig, PracticeSuite, SuiteStatus } from "@/domains/locations/types";

export interface OperatorFacilityState {
  operator: { memberProfileId: string };
  location: LocationConfig;
  suites: OperatorSuite[];
  reservations: OperatorReservation[];
  auditEvents: OperatorAuditEvent[];
}

export interface OperatorSuite extends PracticeSuite {
  currentReservationId?: string | null;
  currentReservationStatus?: string | null;
  currentBookingMode?: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR" | null;
  currentMemberEmail?: string | null;
  activeSessionId?: string | null;
}

export interface OperatorReservation {
  id: string;
  locationId: string;
  suiteId: string;
  suiteName: string;
  memberProfileId: string;
  memberEmail: string;
  memberDisplayName: string;
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  sessionStartedAt?: Date;
  accessGrantStatus?: "active" | "revoked" | "expired" | null;
}

export interface OperatorAuditEvent {
  id: string;
  type: string;
  actorId: string;
  resourceId: string;
  reason: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface SuiteStatusChangeResult {
  suite: PracticeSuite;
  idempotent: boolean;
}

export interface OperatorCancellationResult {
  reservation: OperatorReservation;
  availableCredits: number;
  refundedCredits: number;
  idempotent: boolean;
  accessGrant?: { id: string; status: "active" | "revoked" | "expired" } | null;
}

export type { SuiteStatus };
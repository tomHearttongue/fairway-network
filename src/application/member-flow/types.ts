import type { AccessGrant } from "@/domains/access/fake-access-provider";
import type { AuditEvent } from "@/domains/audit/audit-log";
import type { MemberProfile, Person } from "@/domains/identity/types";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { MembershipPlanSeed } from "@/domains/membership/test-birdie";
import type { AvailabilitySlot } from "@/domains/reservations/types";
import type { PracticeSession } from "@/domains/sessions/fake-session-provider";

export interface PersistentMemberState {
  person: Person;
  profile: MemberProfile;
  membershipPlan: MembershipPlanSeed;
  availableCredits: number;
  location: LocationConfig;
  suites: PracticeSuite[];
  availability: AvailabilitySlot[];
  memberReservations: PersistentReservationSummary[];
  auditEvents: AuditEvent[];
}

export interface ReservationResult {
  reservation: PersistentReservation;
  accessGrant: AccessGrant;
  availableCredits: number;
  idempotent: boolean;
}

export interface CancellationResult {
  reservation: PersistentReservation;
  accessGrant?: PersistentAccessGrant | null;
  availableCredits: number;
  refundedCredits: number;
  idempotent: boolean;
}

export interface PersistentReservation {
  id: string;
  locationId: string;
  suiteId: string;
  memberProfileId: string;
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  creditHoldEntryId: string;
  idempotencyKey: string;
  createdAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface PersistentReservationSummary extends PersistentReservation {
  locationName: string;
  suiteName: string;
  creditsCommitted: number;
  canCancel: boolean;
  accessWindowStatus: "none" | "scheduled" | "active" | "expired" | "revoked";
  accessGrant?: PersistentAccessGrant | null;
  sessionStartedAt?: Date;
}

export interface PersistentAccessGrant {
  id: string;
  status: "active" | "revoked" | "expired";
  startsAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface StartSessionResult {
  session: PracticeSession;
}

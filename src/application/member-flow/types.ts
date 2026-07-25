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
  playNowQuote?: PlayNowQuote;
  memberReservations: PersistentReservationSummary[];
  auditEvents: AuditEvent[];
}


export interface PlayNowQuote {
  available: boolean;
  blockedReason?: string;
  suiteId?: string;
  suiteName?: string;
  availableUntil?: Date;
  maxDurationMinutes?: number;
  durationMinutes?: number;
  demandBand?: "OFF_PEAK" | "STANDARD" | "PRIME";
  creditUnits?: number;
  creditCost?: number;
  memberAvailableCredits: number;
  sufficientCredits?: boolean;
  options: PlayNowQuoteOption[];
}

export interface PlayNowQuoteOption {
  durationMinutes: number;
  demandBand: "OFF_PEAK" | "STANDARD" | "PRIME";
  creditUnits: number;
  creditCost: number;
  sufficientCredits: boolean;
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
  creditsCommitted?: number;
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
  canStartSession?: boolean;
  startBlockedReason?: "access_scheduled" | "access_expired" | "access_revoked" | "not_startable";
  canCompleteSession?: boolean;
  accessWindowStatus: "none" | "scheduled" | "active" | "expired" | "revoked";
  accessGrant?: PersistentAccessGrant | null;
  sessionStartedAt?: Date;
  sessionEndedAt?: Date;
  guests: PersistentReservationGuest[];
}

export interface PersistentReservationGuest {
  id: string;
  guestId: string;
  displayName: string;
  status: "active" | "removed";
  waiverStatus: "not_requested" | "requested" | "completed" | "verified" | "revoked";
  verificationState: "pending" | "verified" | "rejected";
  agreementVersion?: string;
  ready: boolean;
  accessEligible: boolean;
  createdAt: Date;
  removedAt?: Date;
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

export interface GuestMutationResult {
  reservationGuest: PersistentReservationGuest;
  idempotent?: boolean;
}

export interface WaiverMutationResult {
  reservationGuest: { id: string; guestId: string };
  acceptance: { id: string; status: string; verificationState: string; evidenceReference?: string; completedAt?: Date };
  agreementVersion: { id: string; code: string; version: string; provider: string };
  ready: boolean;
  accessEligible?: boolean;
}

export interface SessionCompletionResult {
  session: PracticeSession & { endedAt: Date };
  reservation: PersistentReservation;
  accessGrant?: PersistentAccessGrant | null;
  facilityTask?: { id: string; suiteId: string; taskType: "turnover" | "inspection"; status: "open" | "claimed" | "in_progress" | "completed" | "cancelled"; dueAt?: Date } | null;
  idempotent: boolean;
}




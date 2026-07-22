import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeAccessProvider } from "@/domains/access/fake-access-provider";
import { calculateAvailability } from "@/domains/reservations/availability";
import { FakeSessionProvider } from "@/domains/sessions/fake-session-provider";
import type { AuthPrincipal } from "@/domains/identity/types";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { CancellationResult, PersistentAccessGrant, PersistentMemberState, PersistentReservation, PersistentReservationSummary, ReservationResult, SessionCompletionResult, StartSessionResult } from "@/application/member-flow/types";
import type { BookingMode } from "@/domains/reservations/types";
import type { Clock } from "@/shared/clock";

export class SupabaseMemberStore {
  private readonly accessProvider = new FakeAccessProvider();
  private readonly sessionProvider = new FakeSessionProvider();

  constructor(private readonly supabase: SupabaseClient, private readonly clock: Clock) {}

  async bootstrapMember(principal: AuthPrincipal): Promise<string> {
    const { data, error } = await this.supabase.rpc("fairway_bootstrap_clerk_member", {
      p_clerk_user_id: principal.externalId,
      p_email: principal.email,
      p_display_name: principal.email,
    });

    if (error) throw new Error(error.message);
    return String((data as { memberProfileId: string }).memberProfileId);
  }

  async getMemberState(memberProfileId: string): Promise<PersistentMemberState> {
    const state = await this.getStoredMemberState(memberProfileId);
    const location = state.location;
    const suites = state.suites;
    const reservations = state.reservations.map(mapReservation);

    return {
      person: state.person,
      profile: state.profile,
      membershipPlan: state.membershipPlan,
      availableCredits: state.availableCredits,
      location,
      suites,
      availability: calculateAvailability({ location, suites, reservations, at: this.clock.now() }),
      memberReservations: (state.memberReservations ?? []).map(mapReservationSummary),
      auditEvents: state.auditEvents.map((event) => ({ ...event, createdAt: new Date(event.createdAt) })),
    };
  }

  async createReservation(input: CreatePersistentReservationInput): Promise<ReservationResult> {
    const now = this.clock.now();
    const { data, error } = await this.supabase.rpc("fairway_create_reservation", {
      p_member_profile_id: input.memberProfileId,
      p_booking_mode: input.bookingMode,
      p_suite_id: input.suiteId ?? null,
      p_start_at: input.startAt?.toISOString() ?? null,
      p_end_at: input.endAt?.toISOString() ?? null,
      p_requested_minutes: input.requestedMinutes ?? null,
      p_credit_cost: input.creditCost,
      p_idempotency_key: input.idempotencyKey,
      p_now: now.toISOString(),
    });

    if (error) throw new Error(error.message);
    const payload = data as { reservation: StoredReservation; idempotent: boolean };
    const reservation = mapReservation(payload.reservation);
    const transientGrant = await this.accessProvider.createGrant({ reservation, location: input.location });

    const { data: storedAccessGrant, error: accessError } = await this.supabase.rpc("fairway_record_access_grant", {
      p_reservation_id: reservation.id,
      p_provider: transientGrant.provider,
      p_external_grant_id: transientGrant.id,
      p_starts_at: transientGrant.startsAt.toISOString(),
      p_expires_at: transientGrant.expiresAt.toISOString(),
      p_idempotency_key: `${input.idempotencyKey}:access-grant`,
    });

    if (accessError) throw new Error(accessError.message);

    const state = await this.getMemberState(input.memberProfileId);
    return {
      reservation,
      accessGrant: mapAccessGrant(storedAccessGrant as StoredAccessGrant, transientGrant.credentialLabel),
      availableCredits: state.availableCredits,
      idempotent: payload.idempotent,
    };
  }

  async cancelReservation(input: { memberProfileId: string; reservationId: string; idempotencyKey: string }): Promise<CancellationResult> {
    const { data, error } = await this.supabase.rpc("fairway_cancel_reservation", {
      p_member_profile_id: input.memberProfileId,
      p_reservation_id: input.reservationId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    const payload = data as { reservation: StoredReservation; accessGrant?: StoredAccessGrant | null; availableCredits: number; refundedCredits: number; idempotent: boolean };
    return {
      reservation: mapReservation(payload.reservation),
      accessGrant: payload.accessGrant ? mapPersistentAccessGrant(payload.accessGrant) : null,
      availableCredits: payload.availableCredits,
      refundedCredits: payload.refundedCredits,
      idempotent: payload.idempotent,
    };
  }

  async startSession(input: { memberProfileId: string; reservationId: string; idempotencyKey: string }): Promise<StartSessionResult> {
    const state = await this.getStoredMemberState(input.memberProfileId);
    const reservations = state.reservations.map(mapReservation).concat((state.memberReservations ?? []).map(mapReservationSummary));
    const reservation = reservations.find((item) => item.id === input.reservationId);
    if (!reservation) throw new Error("RESERVATION_NOT_FOUND");

    const transientSession = await this.sessionProvider.startSession({ reservation, startedAt: this.clock.now() });
    const { data, error } = await this.supabase.rpc("fairway_start_session", {
      p_member_profile_id: input.memberProfileId,
      p_reservation_id: input.reservationId,
      p_provider: transientSession.provider,
      p_external_session_id: transientSession.id,
      p_started_at: transientSession.startedAt.toISOString(),
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) throw new Error(error.message);
    const stored = data as StoredSession;

    return {
      session: {
        id: stored.id,
        reservationId: stored.reservation_id,
        memberProfileId: stored.member_profile_id,
        suiteId: stored.suite_id,
        startedAt: new Date(stored.started_at),
        provider: "fake",
      },
    };
  }


  async completeSession(input: { memberProfileId: string; reservationId: string; idempotencyKey: string }): Promise<SessionCompletionResult> {
    const { data, error } = await this.supabase.rpc("fairway_complete_session", {
      p_member_profile_id: input.memberProfileId,
      p_reservation_id: input.reservationId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    const payload = data as { session: StoredSession; reservation: StoredReservation; accessGrant?: StoredAccessGrant | null; facilityTask?: StoredFacilityTask | null; idempotent: boolean };
    return {
      session: {
        id: payload.session.id,
        reservationId: payload.session.reservation_id,
        memberProfileId: payload.session.member_profile_id,
        suiteId: payload.session.suite_id,
        startedAt: new Date(payload.session.started_at),
        endedAt: new Date(payload.session.ended_at ?? this.clock.now()),
        provider: "fake",
      },
      reservation: mapReservation(payload.reservation),
      accessGrant: payload.accessGrant ? mapPersistentAccessGrant(payload.accessGrant) : null,
      facilityTask: payload.facilityTask ? mapFacilityTask(payload.facilityTask) : null,
      idempotent: payload.idempotent,
    };
  }
  private async getStoredMemberState(memberProfileId: string): Promise<StoredMemberState> {
    const { data, error } = await this.supabase.rpc("fairway_member_state", { p_member_profile_id: memberProfileId });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("MEMBER_STATE_NOT_FOUND");
    return data as StoredMemberState;
  }
}

export interface CreatePersistentReservationInput {
  memberProfileId: string;
  bookingMode: BookingMode;
  location: LocationConfig;
  suiteId?: string;
  startAt?: Date;
  endAt?: Date;
  requestedMinutes?: number;
  creditCost: number;
  idempotencyKey: string;
}

function mapReservation(reservation: StoredReservation): PersistentReservation {
  return {
    id: reservation.id,
    locationId: reservation.location_id ?? reservation.locationId,
    suiteId: reservation.suite_id ?? reservation.suiteId,
    memberProfileId: reservation.member_profile_id ?? reservation.memberProfileId,
    bookingMode: reservation.booking_mode ?? reservation.bookingMode,
    status: reservation.status,
    startAt: new Date(reservation.start_at ?? reservation.startAt),
    endAt: new Date(reservation.end_at ?? reservation.endAt),
    creditHoldEntryId: reservation.credit_hold_entry_id ?? reservation.creditHoldEntryId,
    idempotencyKey: reservation.idempotency_key ?? reservation.idempotencyKey ?? reservation.id,
    createdAt: new Date(reservation.created_at ?? reservation.createdAt),
    cancelledAt: toOptionalDate(reservation.cancelled_at ?? reservation.cancelledAt),
    cancellationReason: reservation.cancellation_reason ?? reservation.cancellationReason ?? undefined,
  };
}

function mapReservationSummary(reservation: StoredReservationSummary): PersistentReservationSummary {
  return {
    ...mapReservation(reservation),
    locationName: reservation.location_name ?? reservation.locationName,
    suiteName: reservation.suite_name ?? reservation.suiteName,
    creditsCommitted: reservation.credits_committed ?? reservation.creditsCommitted ?? 0,
    canCancel: reservation.can_cancel ?? reservation.canCancel ?? false,
    canCompleteSession: reservation.can_complete_session ?? reservation.canCompleteSession ?? false,
    accessWindowStatus: reservation.access_window_status ?? reservation.accessWindowStatus ?? "none",
    accessGrant: (reservation.access_grant ?? reservation.accessGrant) ? mapPersistentAccessGrant((reservation.access_grant ?? reservation.accessGrant) as StoredAccessGrant) : null,
    sessionStartedAt: toOptionalDate(reservation.session_started_at ?? reservation.sessionStartedAt),
    sessionEndedAt: toOptionalDate(reservation.session_ended_at ?? reservation.sessionEndedAt),
  };
}

function mapAccessGrant(accessGrant: StoredAccessGrant, credentialLabel: string) {
  return {
    id: accessGrant.id,
    reservationId: accessGrant.reservation_id,
    memberProfileId: accessGrant.member_profile_id,
    locationId: accessGrant.location_id,
    suiteId: accessGrant.suite_id,
    startsAt: new Date(accessGrant.starts_at ?? accessGrant.startsAt),
    expiresAt: new Date(accessGrant.expires_at ?? accessGrant.expiresAt),
    provider: "fake" as const,
    credentialLabel,
  };
}

function mapPersistentAccessGrant(accessGrant: StoredAccessGrant): PersistentAccessGrant {
  return {
    id: accessGrant.id,
    status: accessGrant.status ?? "active",
    startsAt: new Date(accessGrant.starts_at ?? accessGrant.startsAt),
    expiresAt: new Date(accessGrant.expires_at ?? accessGrant.expiresAt),
    revokedAt: toOptionalDate(accessGrant.revoked_at ?? accessGrant.revokedAt),
  };
}


function mapFacilityTask(task: StoredFacilityTask) {
  return {
    id: task.id,
    suiteId: task.suite_id ?? task.suiteId,
    taskType: task.task_type ?? task.taskType,
    status: task.status,
    dueAt: toOptionalDate(task.due_at ?? task.dueAt),
  };
}
function toOptionalDate(value: string | Date | null | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

interface StoredMemberState {
  person: PersistentMemberState["person"];
  profile: PersistentMemberState["profile"];
  membershipPlan: PersistentMemberState["membershipPlan"];
  availableCredits: number;
  location: LocationConfig;
  suites: PracticeSuite[];
  reservations: StoredReservation[];
  memberReservations?: StoredReservationSummary[];
  auditEvents: Array<{ id: string; type: string; actorId: string; resourceId: string; reason: string; createdAt: string }>;
}

interface StoredReservation {
  id: string;
  location_id?: string;
  locationId: string;
  suite_id?: string;
  suiteId: string;
  member_profile_id?: string;
  memberProfileId: string;
  booking_mode?: PersistentReservation["bookingMode"];
  bookingMode: PersistentReservation["bookingMode"];
  status: PersistentReservation["status"];
  start_at?: string;
  startAt: string;
  end_at?: string;
  endAt: string;
  credit_hold_entry_id?: string;
  creditHoldEntryId: string;
  idempotency_key?: string;
  idempotencyKey?: string;
  created_at?: string;
  createdAt: string;
  cancelled_at?: string | null;
  cancelledAt?: string | null;
  cancellation_reason?: string | null;
  cancellationReason?: string | null;
}

interface StoredReservationSummary extends StoredReservation {
  location_name?: string;
  locationName: string;
  suite_name?: string;
  suiteName: string;
  credits_committed?: number;
  creditsCommitted?: number;
  can_cancel?: boolean;
  canCancel?: boolean;
  access_window_status?: PersistentReservationSummary["accessWindowStatus"];
  accessWindowStatus?: PersistentReservationSummary["accessWindowStatus"];
  access_grant?: StoredAccessGrant | null;
  accessGrant?: StoredAccessGrant | null;
  session_started_at?: string | null;
  sessionStartedAt?: string | null;
  session_ended_at?: string | null;
  sessionEndedAt?: string | null;
  can_complete_session?: boolean;
  canCompleteSession?: boolean;
}

interface StoredAccessGrant {
  id: string;
  reservation_id: string;
  member_profile_id: string;
  location_id: string;
  suite_id: string;
  starts_at?: string;
  startsAt: string;
  expires_at?: string;
  expiresAt: string;
  status?: PersistentAccessGrant["status"];
  revoked_at?: string | null;
  revokedAt?: string | null;
}

interface StoredSession {
  id: string;
  reservation_id: string;
  member_profile_id: string;
  suite_id: string;
  started_at: string;
  ended_at?: string | null;
}

interface StoredFacilityTask {
  id: string;
  suite_id?: string;
  suiteId: string;
  task_type?: "turnover" | "inspection";
  taskType: "turnover" | "inspection";
  status: "open" | "claimed" | "in_progress" | "completed" | "cancelled";
  due_at?: string | null;
  dueAt?: string | null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperatorCancellationResult, OperatorFacilityState, OperatorReservation, OperatorSuite, SuiteStatus, SuiteStatusChangeResult } from "@/application/operator-flow/types";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { Clock } from "@/shared/clock";

export class SupabaseOperatorStore {
  constructor(private readonly supabase: SupabaseClient, private readonly clock: Clock) {}

  async getFacilityState(operatorMemberProfileId: string): Promise<OperatorFacilityState> {
    const { data, error } = await this.supabase.rpc("fairway_operator_state", {
      p_operator_member_profile_id: operatorMemberProfileId,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    return mapFacilityState(data as StoredOperatorFacilityState);
  }

  async grantDevelopmentOperator(input: { memberProfileId: string; locationId: string; reason: string }): Promise<void> {
    const { error } = await this.supabase.rpc("fairway_grant_development_operator", {
      p_member_profile_id: input.memberProfileId,
      p_location_id: input.locationId,
      p_reason: input.reason,
    });
    if (error) throw new Error(error.message);
  }

  async setSuiteStatus(input: { operatorMemberProfileId: string; suiteId: string; status: SuiteStatus; reason: string; idempotencyKey: string }): Promise<SuiteStatusChangeResult> {
    const { data, error } = await this.supabase.rpc("fairway_set_suite_status", {
      p_operator_member_profile_id: input.operatorMemberProfileId,
      p_suite_id: input.suiteId,
      p_status: input.status,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const payload = data as { suite: StoredSuite; idempotent: boolean };
    return { suite: mapSuite(payload.suite), idempotent: payload.idempotent };
  }

  async cancelReservation(input: { operatorMemberProfileId: string; reservationId: string; reason: string; idempotencyKey: string }): Promise<OperatorCancellationResult> {
    const { data, error } = await this.supabase.rpc("fairway_operator_cancel_reservation", {
      p_operator_member_profile_id: input.operatorMemberProfileId,
      p_reservation_id: input.reservationId,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    const payload = data as { reservation: StoredOperatorReservation; accessGrant?: { id: string; status?: "active" | "revoked" | "expired" } | null; availableCredits: number; refundedCredits: number; idempotent: boolean };
    return {
      reservation: mapReservation(payload.reservation),
      accessGrant: payload.accessGrant ? { id: payload.accessGrant.id, status: payload.accessGrant.status ?? "active" } : null,
      availableCredits: payload.availableCredits,
      refundedCredits: payload.refundedCredits,
      idempotent: payload.idempotent,
    };
  }
}

function mapFacilityState(state: StoredOperatorFacilityState): OperatorFacilityState {
  return {
    operator: state.operator,
    location: mapLocation(state.location),
    suites: state.suites.map(mapOperatorSuite),
    reservations: state.reservations.map(mapReservation),
    auditEvents: state.auditEvents.map((event) => ({ ...event, createdAt: new Date(event.createdAt), metadata: event.metadata ?? {} })),
  };
}

function mapLocation(location: StoredLocation): LocationConfig {
  return {
    id: location.id,
    name: location.name,
    timezone: location.timezone,
    suiteCount: location.suiteCount,
    minimumSessionMinutes: location.minimumSessionMinutes,
    bookingIncrementMinutes: location.bookingIncrementMinutes,
    turnoverBufferMinutes: location.turnoverBufferMinutes,
    accessBeforeMinutes: location.accessBeforeMinutes,
    accessAfterMinutes: location.accessAfterMinutes,
    playNowEnabled: location.playNowEnabled,
  };
}

function mapSuite(suite: StoredSuite): PracticeSuite {
  return { id: suite.id, locationId: suite.location_id ?? suite.locationId, name: suite.name, status: suite.status };
}

function mapOperatorSuite(suite: StoredOperatorSuite): OperatorSuite {
  return {
    ...mapSuite(suite),
    currentReservationId: suite.currentReservationId ?? null,
    currentReservationStatus: suite.currentReservationStatus ?? null,
    currentBookingMode: suite.currentBookingMode ?? null,
    currentMemberEmail: suite.currentMemberEmail ?? null,
    activeSessionId: suite.activeSessionId ?? null,
  };
}

function mapReservation(reservation: StoredOperatorReservation): OperatorReservation {
  return {
    id: reservation.id,
    locationId: reservation.location_id ?? reservation.locationId,
    suiteId: reservation.suite_id ?? reservation.suiteId,
    suiteName: reservation.suiteName,
    memberProfileId: reservation.member_profile_id ?? reservation.memberProfileId,
    memberEmail: reservation.memberEmail ?? "",
    memberDisplayName: reservation.memberDisplayName ?? reservation.memberEmail ?? "Member",
    bookingMode: reservation.booking_mode ?? reservation.bookingMode,
    status: reservation.status,
    startAt: new Date(reservation.start_at ?? reservation.startAt),
    endAt: new Date(reservation.end_at ?? reservation.endAt),
    cancelledAt: optionalDate(reservation.cancelled_at ?? reservation.cancelledAt),
    cancellationReason: reservation.cancellation_reason ?? reservation.cancellationReason ?? undefined,
    sessionStartedAt: optionalDate(reservation.session_started_at ?? reservation.sessionStartedAt),
    accessGrantStatus: reservation.accessGrantStatus ?? null,
  };
}

function optionalDate(value: string | Date | null | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

interface StoredOperatorFacilityState {
  operator: { memberProfileId: string };
  location: StoredLocation;
  suites: StoredOperatorSuite[];
  reservations: StoredOperatorReservation[];
  auditEvents: Array<{ id: string; type: string; actorId: string; resourceId: string; reason: string; createdAt: string; metadata?: Record<string, unknown> }>;
}

interface StoredLocation {
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

interface StoredSuite {
  id: string;
  location_id?: string;
  locationId: string;
  name: string;
  status: SuiteStatus;
}

interface StoredOperatorSuite extends StoredSuite {
  currentReservationId?: string | null;
  currentReservationStatus?: string | null;
  currentBookingMode?: OperatorSuite["currentBookingMode"];
  currentMemberEmail?: string | null;
  activeSessionId?: string | null;
}

interface StoredOperatorReservation {
  id: string;
  location_id?: string;
  locationId: string;
  suite_id?: string;
  suiteId: string;
  suiteName: string;
  member_profile_id?: string;
  memberProfileId: string;
  memberEmail?: string;
  memberDisplayName?: string;
  booking_mode?: OperatorReservation["bookingMode"];
  bookingMode: OperatorReservation["bookingMode"];
  status: OperatorReservation["status"];
  start_at?: string;
  startAt: string;
  end_at?: string;
  endAt: string;
  cancelled_at?: string | null;
  cancelledAt?: string | null;
  cancellation_reason?: string | null;
  cancellationReason?: string | null;
  session_started_at?: string | null;
  sessionStartedAt?: string | null;
  accessGrantStatus?: OperatorReservation["accessGrantStatus"];
}
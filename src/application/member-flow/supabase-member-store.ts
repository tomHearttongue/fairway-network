import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeAccessProvider } from "@/domains/access/fake-access-provider";
import { calculateAvailability } from "@/domains/reservations/availability";
import { FakeSessionProvider } from "@/domains/sessions/fake-session-provider";
import type { AuthPrincipal } from "@/domains/identity/types";
import type { LocationConfig, PracticeSuite } from "@/domains/locations/types";
import type { CancellationResult, GuestMutationResult, PersistentAccessGrant, PersistentMemberState, PersistentReservation, PersistentReservationGuest, PersistentReservationSummary, PlayNowQuote, ReservationResult, SessionCompletionResult, StartSessionResult, WaiverMutationResult } from "@/application/member-flow/types";
import type { BookingMode } from "@/domains/reservations/types";
import type { Clock } from "@/shared/clock";

export class SupabaseMemberStore {
  private readonly accessProvider = new FakeAccessProvider();
  private readonly sessionProvider = new FakeSessionProvider();

  constructor(private readonly supabase: SupabaseClient, private readonly clock: Clock) {}

  async bootstrapMember(principal: AuthPrincipal): Promise<string> {
    const existing = await this.findExistingFairwayProfile(principal);
    if (existing) return existing;

    const { data, error } = await this.supabase.rpc("fairway_bootstrap_clerk_member", {
      p_clerk_user_id: principal.externalId,
      p_email: principal.email,
      p_display_name: principal.displayName ?? principal.email,
    });

    if (error) throw new Error(error.message);
    return String((data as { memberProfileId: string }).memberProfileId);
  }

  private async findExistingFairwayProfile(principal: AuthPrincipal): Promise<string | null> {
    const { data: linked, error: linkedError } = await this.supabase
      .from("auth_principals")
      .select("person_id")
      .eq("provider", "clerk")
      .eq("external_id", principal.externalId)
      .maybeSingle();
    if (linkedError) throw new Error(linkedError.message);

    let personId = linked?.person_id as string | undefined;
    if (!personId) {
      const { data: person, error: personError } = await this.supabase.from("people").select("id").ilike("email", principal.email).maybeSingle();
      if (personError) throw new Error(personError.message);
      personId = person?.id as string | undefined;
      if (!personId) return null;
      const { error: linkError } = await this.supabase
        .from("auth_principals")
        .upsert({ provider: "clerk", external_id: principal.externalId, person_id: personId }, { onConflict: "provider,external_id" });
      if (linkError) throw new Error(linkError.message);
    }

    const { data: profile, error: profileError } = await this.supabase.from("member_profiles").select("id").eq("person_id", personId).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    return profile?.id ? String(profile.id) : null;
  }

  async getMemberState(memberProfileId: string): Promise<PersistentMemberState> {
    const state = await this.getStoredMemberState(memberProfileId);
    const location = state.location;
    const suites = state.suites;
    const reservations = state.reservations.map(mapReservation);

    const { data: quote, error: quoteError } = await this.supabase.rpc("fairway_quote_play_now", {
      p_member_profile_id: memberProfileId,
      p_requested_minutes: null,
      p_now: this.clock.now().toISOString(),
    });
    if (quoteError) throw new Error(quoteError.message);

    return {
      person: state.person,
      profile: state.profile,
      membershipPlan: state.membershipPlan,
      availableCredits: state.availableCredits,
      location,
      suites,
      availability: calculateAvailability({ location, suites, reservations, at: this.clock.now() }),
      playNowQuote: quote ? mapPlayNowQuote(quote as StoredPlayNowQuote) : undefined,
      memberReservations: (state.memberReservations ?? []).map((item) => mapReservationSummaryAt(item, this.clock.now())),
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
      p_credit_cost: null,
      p_idempotency_key: input.idempotencyKey,
      p_now: now.toISOString(),
    });

    if (error) throw new Error(error.message);
    const payload = data as { reservation: StoredReservation; idempotent: boolean; price?: { creditCost?: number | string; creditUnits?: number | string } };
    const reservation = {
      ...mapReservation(payload.reservation),
      creditsCommitted: toOptionalNumber(payload.price?.creditCost),
    };
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


  async addReservationGuest(input: { memberProfileId: string; reservationId: string; guestName: string; guestEmail?: string; idempotencyKey: string }): Promise<GuestMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_add_reservation_guest", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_id: input.reservationId,
      p_guest_name: input.guestName,
      p_guest_email: input.guestEmail ?? null,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    return mapGuestMutationResult(data as StoredGuestMutationResult);
  }

  async recordGuestAllowanceRejected(input: { memberProfileId: string; reservationId: string; idempotencyKey: string }): Promise<void> {
    const { error } = await this.supabase.rpc("fairway_record_guest_allowance_rejection", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_id: input.reservationId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async requestGuestWaiver(input: { memberProfileId: string; reservationGuestId: string; idempotencyKey: string }): Promise<WaiverMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_request_guest_waiver", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_guest_id: input.reservationGuestId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    return mapWaiverMutationResult(data as StoredWaiverMutationResult);
  }

  async completeGuestWaiver(input: { memberProfileId: string; reservationGuestId: string; idempotencyKey: string }): Promise<WaiverMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_complete_guest_waiver", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_guest_id: input.reservationGuestId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    return mapWaiverMutationResult(data as StoredWaiverMutationResult);
  }

  async checkGuestAccessEligibility(input: { memberProfileId: string; reservationGuestId: string; idempotencyKey: string }): Promise<{ ready: boolean; accessEligible: boolean; blockedReason?: string }> {
    const { data, error } = await this.supabase.rpc("fairway_check_guest_access_eligibility", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_guest_id: input.reservationGuestId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    const payload = data as { ready: boolean; accessEligible: boolean; blockedReason?: string };
    return { ready: Boolean(payload.ready), accessEligible: Boolean(payload.accessEligible), blockedReason: payload.blockedReason };
  }

  async removeReservationGuest(input: { memberProfileId: string; reservationGuestId: string; idempotencyKey: string }): Promise<GuestMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_remove_reservation_guest", {
      p_host_member_profile_id: input.memberProfileId,
      p_reservation_guest_id: input.reservationGuestId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });

    if (error) throw new Error(error.message);
    return mapGuestMutationResult(data as StoredGuestMutationResult);
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
  idempotencyKey: string;
}


function mapPlayNowQuote(quote: StoredPlayNowQuote): PlayNowQuote {
  return {
    available: Boolean(quote.available),
    blockedReason: quote.blockedReason ?? quote.blocked_reason ?? undefined,
    suiteId: quote.suiteId ?? quote.suite_id ?? undefined,
    suiteName: quote.suiteName ?? quote.suite_name ?? undefined,
    availableUntil: toOptionalDate(quote.availableUntil ?? quote.available_until),
    maxDurationMinutes: toOptionalNumber(quote.maxDurationMinutes ?? quote.max_duration_minutes),
    durationMinutes: toOptionalNumber(quote.durationMinutes ?? quote.duration_minutes),
    demandBand: ((quote.demandBand ?? quote.demand_band) as PlayNowQuote["demandBand"]),
    creditUnits: toOptionalNumber(quote.creditUnits ?? quote.credit_units),
    creditCost: toOptionalNumber(quote.creditCost ?? quote.credit_cost),
    memberAvailableCredits: Number(quote.memberAvailableCredits ?? quote.member_available_credits ?? 0),
    sufficientCredits: quote.sufficientCredits ?? quote.sufficient_credits,
    options: ((quote.options ?? []) as StoredPlayNowQuoteOption[]).map((option) => ({
      durationMinutes: Number(option.durationMinutes ?? option.duration_minutes),
      demandBand: ((option.demandBand ?? option.demand_band ?? "STANDARD") as PlayNowQuoteOptionBand),
      creditUnits: Number(option.creditUnits ?? option.credit_units),
      creditCost: Number(option.creditCost ?? option.credit_cost),
      sufficientCredits: Boolean(option.sufficientCredits ?? option.sufficient_credits),
    })),
  };
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
    guests: ((reservation.guests ?? reservation.guests) ?? []).map(mapReservationGuest),
  };
}

function mapReservationSummaryAt(reservation: StoredReservationSummary, now: Date): PersistentReservationSummary {
  const mapped = mapReservationSummary(reservation);
  const access = mapped.accessGrant;
  const accessWindowStatus = !access
    ? "none"
    : access.status === "revoked"
      ? "revoked"
      : now < access.startsAt
        ? "scheduled"
        : now >= access.expiresAt
          ? "expired"
          : "active";
  return {
    ...mapped,
    canCancel: mapped.status === "confirmed" && mapped.startAt > now && !mapped.sessionStartedAt,
    canCompleteSession: mapped.status === "checked_in" && Boolean(mapped.sessionStartedAt) && !mapped.sessionEndedAt,
    accessWindowStatus,
    guests: mapped.guests.map((guest) => ({
      ...guest,
      accessEligible: guest.ready && accessWindowStatus === "active" && mapped.status !== "cancelled" && mapped.status !== "completed",
    })),
  };
}

function mapReservationGuest(guest: StoredReservationGuest): PersistentReservationGuest {
  return {
    id: guest.id,
    guestId: guest.guest_id ?? guest.guestId,
    displayName: guest.display_name ?? guest.displayName,
    status: guest.status,
    waiverStatus: guest.waiver_status ?? guest.waiverStatus ?? "not_requested",
    verificationState: guest.verification_state ?? guest.verificationState ?? "pending",
    agreementVersion: guest.agreement_version ?? guest.agreementVersion ?? undefined,
    ready: Boolean(guest.ready),
    accessEligible: Boolean(guest.access_eligible ?? guest.accessEligible),
    createdAt: new Date(guest.created_at ?? guest.createdAt),
    removedAt: toOptionalDate(guest.removed_at ?? guest.removedAt),
  };
}

function mapGuestMutationResult(payload: StoredGuestMutationResult): GuestMutationResult {
  const reservationGuest = payload.reservationGuest ?? payload.reservation_guest;
  if (!reservationGuest) throw new Error("RESERVATION_GUEST_PAYLOAD_MISSING");
  const guest = payload.guest;
  return {
    reservationGuest: mapReservationGuest({
      id: reservationGuest.id,
      guestId: reservationGuest.guest_id ?? reservationGuest.guestId ?? "",
      displayName: guest?.full_name ?? guest?.fullName ?? "Guest",
      status: reservationGuest.status,
      waiverStatus: "not_requested",
      verificationState: "pending",
      ready: Boolean(payload.ready),
      accessEligible: Boolean(payload.accessEligible ?? payload.access_eligible),
      createdAt: reservationGuest.created_at ?? reservationGuest.createdAt ?? new Date().toISOString(),
      removedAt: reservationGuest.removed_at ?? reservationGuest.removedAt,
    }),
    idempotent: Boolean(payload.idempotent),
  };
}

function mapWaiverMutationResult(payload: StoredWaiverMutationResult): WaiverMutationResult {
  const reservationGuest = payload.reservationGuest ?? payload.reservation_guest;
  const agreementVersion = payload.agreementVersion ?? payload.agreement_version;
  if (!reservationGuest) throw new Error("RESERVATION_GUEST_PAYLOAD_MISSING");
  if (!agreementVersion) throw new Error("AGREEMENT_VERSION_PAYLOAD_MISSING");
  const acceptance = payload.acceptance;
  return {
    reservationGuest: { id: reservationGuest.id, guestId: reservationGuest.guest_id ?? reservationGuest.guestId ?? "" },
    acceptance: {
      id: acceptance.id,
      status: acceptance.status,
      verificationState: acceptance.verification_state ?? acceptance.verificationState ?? "pending",
      evidenceReference: acceptance.evidence_reference ?? acceptance.evidenceReference ?? undefined,
      completedAt: toOptionalDate(acceptance.completed_at ?? acceptance.completedAt),
    },
    agreementVersion: { id: agreementVersion.id, code: agreementVersion.code, version: agreementVersion.version, provider: agreementVersion.provider },
    ready: Boolean(payload.ready),
    accessEligible: Boolean(payload.accessEligible ?? payload.access_eligible),
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

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

type PlayNowQuoteOptionBand = "OFF_PEAK" | "STANDARD" | "PRIME";

interface StoredMemberState {
  person: PersistentMemberState["person"];
  profile: PersistentMemberState["profile"];
  membershipPlan: PersistentMemberState["membershipPlan"];
  availableCredits: number;
  playNowQuote?: StoredPlayNowQuote;
  location: LocationConfig;
  suites: PracticeSuite[];
  reservations: StoredReservation[];
  memberReservations?: StoredReservationSummary[];
  auditEvents: Array<{ id: string; type: string; actorId: string; resourceId: string; reason: string; createdAt: string }>;
}


interface StoredPlayNowQuote {
  available: boolean;
  blockedReason?: string;
  blocked_reason?: string;
  suiteId?: string;
  suite_id?: string;
  suiteName?: string;
  suite_name?: string;
  availableUntil?: string;
  available_until?: string;
  maxDurationMinutes?: number;
  max_duration_minutes?: number;
  durationMinutes?: number;
  duration_minutes?: number;
  demandBand?: string;
  demand_band?: string;
  creditUnits?: number;
  credit_units?: number;
  creditCost?: number;
  credit_cost?: number;
  memberAvailableCredits?: number;
  member_available_credits?: number;
  sufficientCredits?: boolean;
  sufficient_credits?: boolean;
  options?: StoredPlayNowQuoteOption[];
}

interface StoredPlayNowQuoteOption {
  durationMinutes?: number;
  duration_minutes?: number;
  demandBand?: string;
  demand_band?: string;
  creditUnits?: number;
  credit_units?: number;
  creditCost?: number;
  credit_cost?: number;
  sufficientCredits?: boolean;
  sufficient_credits?: boolean;
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
  guests?: StoredReservationGuest[];
}

interface StoredReservationGuest {
  id: string;
  guest_id?: string;
  guestId: string;
  display_name?: string;
  displayName: string;
  status: PersistentReservationGuest["status"];
  waiver_status?: PersistentReservationGuest["waiverStatus"];
  waiverStatus?: PersistentReservationGuest["waiverStatus"];
  verification_state?: PersistentReservationGuest["verificationState"];
  verificationState?: PersistentReservationGuest["verificationState"];
  agreement_version?: string | null;
  agreementVersion?: string | null;
  ready: boolean;
  access_eligible?: boolean;
  accessEligible?: boolean;
  created_at?: string;
  createdAt: string;
  removed_at?: string | null;
  removedAt?: string | null;
}

interface StoredGuestMutationResult {
  reservationGuest?: StoredReservationGuestRow;
  reservation_guest?: StoredReservationGuestRow;
  guest?: { id: string; full_name?: string; fullName?: string };
  ready?: boolean;
  accessEligible?: boolean;
  access_eligible?: boolean;
  idempotent?: boolean;
}

interface StoredWaiverMutationResult {
  reservationGuest?: StoredReservationGuestRow;
  reservation_guest?: StoredReservationGuestRow;
  acceptance: StoredAgreementAcceptance;
  agreementVersion?: StoredAgreementVersion;
  agreement_version?: StoredAgreementVersion;
  ready?: boolean;
  accessEligible?: boolean;
  access_eligible?: boolean;
}

interface StoredReservationGuestRow {
  id: string;
  guest_id?: string;
  guestId?: string;
  status: PersistentReservationGuest["status"];
  created_at?: string;
  createdAt?: string;
  removed_at?: string | null;
  removedAt?: string | null;
}

interface StoredAgreementAcceptance {
  id: string;
  status: string;
  verification_state?: string;
  verificationState?: string;
  evidence_reference?: string | null;
  evidenceReference?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
}

interface StoredAgreementVersion {
  id: string;
  code: string;
  version: string;
  provider: string;
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








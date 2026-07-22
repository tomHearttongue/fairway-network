import type { SupabaseClient } from "@supabase/supabase-js";
import type { FacilitiesState, FacilitiesSuite, FacilityTask, FacilityTaskMutationResult } from "@/application/facilities-flow/types";
import type { LocationConfig } from "@/domains/locations/types";
import type { Clock } from "@/shared/clock";

export class SupabaseFacilitiesStore {
  constructor(private readonly supabase: SupabaseClient, private readonly clock: Clock) {}

  async grantDevelopmentFacilities(input: { memberProfileId: string; locationId: string; reason: string }): Promise<void> {
    const { error } = await this.supabase.rpc("fairway_grant_development_facilities", {
      p_member_profile_id: input.memberProfileId,
      p_location_id: input.locationId,
      p_reason: input.reason,
    });
    if (error) throw new Error(error.message);
  }

  async getFacilitiesState(actorMemberProfileId: string): Promise<FacilitiesState> {
    const { data, error } = await this.supabase.rpc("fairway_facilities_state", {
      p_actor_member_profile_id: actorMemberProfileId,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    return mapState(data as StoredFacilitiesState);
  }

  async claimTask(input: { actorMemberProfileId: string; taskId: string; idempotencyKey: string }): Promise<FacilityTaskMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_claim_facility_task", {
      p_actor_member_profile_id: input.actorMemberProfileId,
      p_task_id: input.taskId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    const payload = data as { task: StoredFacilityTask; idempotent: boolean };
    return { task: mapTask(payload.task), idempotent: payload.idempotent };
  }

  async startTask(input: { actorMemberProfileId: string; taskId: string; idempotencyKey: string }): Promise<FacilityTaskMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_start_facility_task", {
      p_actor_member_profile_id: input.actorMemberProfileId,
      p_task_id: input.taskId,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    const payload = data as { task: StoredFacilityTask; idempotent: boolean };
    return { task: mapTask(payload.task), idempotent: payload.idempotent };
  }

  async completeTask(input: { actorMemberProfileId: string; taskId: string; completionNotes?: string; idempotencyKey: string }): Promise<FacilityTaskMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_complete_facility_task", {
      p_actor_member_profile_id: input.actorMemberProfileId,
      p_task_id: input.taskId,
      p_completion_notes: input.completionNotes ?? null,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    const payload = data as { task: StoredFacilityTask; suite?: StoredFacilitiesSuite; idempotent: boolean };
    return { task: mapTask(payload.task), suite: payload.suite ? mapSuite(payload.suite) : undefined, idempotent: payload.idempotent };
  }

  async flagInspection(input: { actorMemberProfileId: string; suiteId: string; reason: string; idempotencyKey: string }): Promise<FacilityTaskMutationResult> {
    const { data, error } = await this.supabase.rpc("fairway_flag_suite_inspection", {
      p_actor_member_profile_id: input.actorMemberProfileId,
      p_suite_id: input.suiteId,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_now: this.clock.now().toISOString(),
    });
    if (error) throw new Error(error.message);
    const payload = data as { task: StoredFacilityTask; suite?: StoredFacilitiesSuite; idempotent: boolean };
    return { task: mapTask(payload.task), suite: payload.suite ? mapSuite(payload.suite) : undefined, idempotent: payload.idempotent };
  }
}

function mapState(state: StoredFacilitiesState): FacilitiesState {
  return {
    actor: state.actor,
    location: mapLocation(state.location),
    suites: state.suites.map(mapSuite),
    tasks: state.tasks.map(mapTask),
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

function mapSuite(suite: StoredFacilitiesSuite): FacilitiesSuite {
  return {
    id: suite.id,
    locationId: suite.location_id ?? suite.locationId,
    name: suite.name,
    status: suite.status,
    occupiedUntil: optionalDate(suite.occupiedUntil),
    nextReservationAt: optionalDate(suite.nextReservationAt),
    minutesUntilNextReservation: suite.minutesUntilNextReservation ?? null,
    openTaskCount: suite.openTaskCount ?? 0,
  };
}

function mapTask(task: StoredFacilityTask): FacilityTask {
  return {
    id: task.id,
    locationId: task.location_id ?? task.locationId,
    suiteId: task.suite_id ?? task.suiteId,
    suiteName: task.suiteName ?? "Practice Suite",
    taskType: task.task_type ?? task.taskType,
    priority: task.priority,
    status: task.status,
    dueAt: optionalDate(task.due_at ?? task.dueAt),
    createdAt: new Date(task.created_at ?? task.createdAt),
    claimedBySelf: task.claimedBySelf ?? false,
    claimedAt: optionalDate(task.claimed_at ?? task.claimedAt),
    startedAt: optionalDate(task.started_at ?? task.startedAt),
    completedAt: optionalDate(task.completed_at ?? task.completedAt),
    nextReservationAt: optionalDate(task.nextReservationAt),
    minutesUntilNextReservation: task.minutesUntilNextReservation ?? null,
    occupiedUntil: optionalDate(task.occupiedUntil),
  };
}

function optionalDate(value: string | Date | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

interface StoredFacilitiesState {
  actor: { memberProfileId: string };
  location: StoredLocation;
  suites: StoredFacilitiesSuite[];
  tasks: StoredFacilityTask[];
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

interface StoredFacilitiesSuite {
  id: string;
  location_id?: string;
  locationId: string;
  name: string;
  status: FacilitiesSuite["status"];
  occupiedUntil?: string | null;
  nextReservationAt?: string | null;
  minutesUntilNextReservation?: number | null;
  openTaskCount?: number;
}

interface StoredFacilityTask {
  id: string;
  location_id?: string;
  locationId: string;
  suite_id?: string;
  suiteId: string;
  suiteName?: string;
  task_type?: FacilityTask["taskType"];
  taskType: FacilityTask["taskType"];
  priority: number;
  status: FacilityTask["status"];
  due_at?: string | null;
  dueAt?: string | null;
  created_at?: string;
  createdAt: string;
  claimedBySelf?: boolean;
  claimed_at?: string | null;
  claimedAt?: string | null;
  started_at?: string | null;
  startedAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  nextReservationAt?: string | null;
  minutesUntilNextReservation?: number | null;
  occupiedUntil?: string | null;
}
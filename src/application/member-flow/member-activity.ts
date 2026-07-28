import type { DemoGolfActivity, DemoGolfProfile } from "@/demo-universe/universe";

export interface CompletedSessionActivityFact {
  sessionId: string;
  reservationId: string;
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  suiteName: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  sessionStartedAt: string;
  sessionEndedAt: string;
}

export interface MemberReservationSelection {
  id: string;
  suiteName: string;
  status: "held" | "confirmed" | "checked_in" | "cancelled" | "completed";
  bookingMode: "ADVANCE" | "PLAY_NOW" | "OPERATOR" | "INSTRUCTOR";
  startAt: string;
  endAt: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
}

export function projectMemberGolfProfile(input: {
  baseProfile: DemoGolfProfile;
  completedSessions: CompletedSessionActivityFact[];
  seededSessionIds: ReadonlySet<string>;
}): DemoGolfProfile {
  const uniqueCompletedSessions = [...new Map(input.completedSessions.map((session) => [session.sessionId, session])).values()];
  const runtimeActivity = uniqueCompletedSessions
    .filter((session) => !input.seededSessionIds.has(session.sessionId))
    .map(toRuntimeActivity);
  const recentActivity = [...runtimeActivity, ...input.baseProfile.recentActivity]
    .filter((activity, index, all) => all.findIndex((candidate) => candidate.sessionId === activity.sessionId) === index)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 3);

  return {
    ...input.baseProfile,
    completedSessionCount: uniqueCompletedSessions.length,
    recentActivity,
  };
}

export function selectHomeFeaturedReservation<T extends MemberReservationSelection>(
  reservations: T[],
  selectedReservationId: string | null,
): T | undefined {
  const eligible = reservations
    .filter((reservation) => reservation.status !== "completed" && reservation.status !== "cancelled")
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  const active = eligible.find((reservation) => reservation.status === "checked_in" && reservation.sessionStartedAt && !reservation.sessionEndedAt);
  const immediate = eligible.find((reservation) => reservation.bookingMode === "PLAY_NOW" && reservation.status === "confirmed");
  const selected = eligible.find((reservation) => reservation.id === selectedReservationId);
  return active ?? immediate ?? selected ?? eligible[0];
}

export function sessionCompletionPresentation(input: {
  scheduledStartAt: string | Date;
  scheduledEndAt: string | Date;
  sessionStartedAt: string | Date;
  sessionEndedAt: string | Date;
}) {
  const scheduledDurationMinutes = minutesBetween(input.scheduledStartAt, input.scheduledEndAt);
  const elapsedDurationMinutes = minutesBetween(input.sessionStartedAt, input.sessionEndedAt);
  return {
    scheduledDurationMinutes,
    elapsedDurationMinutes,
    sessionStartedAt: toIso(input.sessionStartedAt),
    sessionEndedAt: toIso(input.sessionEndedAt),
    bookingLabel: `${scheduledDurationMinutes}-minute booking`,
  };
}

function toRuntimeActivity(session: CompletedSessionActivityFact): DemoGolfActivity {
  const presentation = sessionCompletionPresentation(session);
  return {
    id: `fairway_activity_${session.sessionId}`,
    title: session.bookingMode === "PLAY_NOW" ? "Play Now session" : "Booked session",
    detail: `${bookingModeLabel(session.bookingMode)} - ${session.suiteName} - ${presentation.bookingLabel}`,
    occurredAt: presentation.sessionEndedAt,
    sessionId: session.sessionId,
    reservationId: session.reservationId,
    scheduledDurationMinutes: presentation.scheduledDurationMinutes,
    elapsedDurationMinutes: presentation.elapsedDurationMinutes,
    sessionStartedAt: presentation.sessionStartedAt,
    sessionEndedAt: presentation.sessionEndedAt,
    source: "PERSISTED_SESSION",
  };
}

function bookingModeLabel(mode: CompletedSessionActivityFact["bookingMode"]): string {
  if (mode === "PLAY_NOW") return "Play Now";
  if (mode === "ADVANCE") return "Booked ahead";
  if (mode === "OPERATOR") return "Operator assisted";
  return "Instructor time";
}

function minutesBetween(start: string | Date, end: string | Date): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

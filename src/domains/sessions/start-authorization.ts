export type SessionStartReservationStatus =
  | "held"
  | "confirmed"
  | "checked_in"
  | "cancelled"
  | "completed";

export interface SessionStartAuthorizationInput {
  now: Date;
  requestingMemberProfileId: string;
  reservation: {
    memberProfileId: string;
    suiteId: string;
    status: SessionStartReservationStatus;
  };
  accessGrant?: {
    memberProfileId: string;
    suiteId: string;
    status: "active" | "revoked" | "expired";
    startsAt: Date;
    expiresAt: Date;
  } | null;
  existingSession?: {
    memberProfileId: string;
    suiteId: string;
  } | null;
}

export type SessionStartAuthorization =
  | { allowed: true; idempotent: boolean }
  | {
      allowed: false;
      reason:
        | "RESERVATION_NOT_OWNED"
        | "RESERVATION_NOT_STARTABLE"
        | "SESSION_ALREADY_STARTED"
        | "SESSION_ACCESS_GRANT_REQUIRED"
        | "SESSION_ACCESS_MAPPING_INVALID"
        | "SESSION_ACCESS_REVOKED"
        | "SESSION_ACCESS_WINDOW_NOT_OPEN"
        | "SESSION_ACCESS_WINDOW_EXPIRED";
    };

export function authorizeSessionStart(input: SessionStartAuthorizationInput): SessionStartAuthorization {
  if (input.reservation.memberProfileId !== input.requestingMemberProfileId) {
    return { allowed: false, reason: "RESERVATION_NOT_OWNED" };
  }

  if (input.existingSession) {
    if (
      input.existingSession.memberProfileId === input.requestingMemberProfileId
      && input.existingSession.suiteId === input.reservation.suiteId
      && input.reservation.status === "checked_in"
    ) {
      return { allowed: true, idempotent: true };
    }
    return { allowed: false, reason: "SESSION_ALREADY_STARTED" };
  }

  if (input.reservation.status !== "confirmed") {
    return { allowed: false, reason: "RESERVATION_NOT_STARTABLE" };
  }

  const access = input.accessGrant;
  if (!access) return { allowed: false, reason: "SESSION_ACCESS_GRANT_REQUIRED" };
  if (
    access.memberProfileId !== input.requestingMemberProfileId
    || access.suiteId !== input.reservation.suiteId
  ) {
    return { allowed: false, reason: "SESSION_ACCESS_MAPPING_INVALID" };
  }
  if (access.status !== "active") return { allowed: false, reason: "SESSION_ACCESS_REVOKED" };
  if (input.now < access.startsAt) return { allowed: false, reason: "SESSION_ACCESS_WINDOW_NOT_OPEN" };
  if (input.now >= access.expiresAt) return { allowed: false, reason: "SESSION_ACCESS_WINDOW_EXPIRED" };

  return { allowed: true, idempotent: false };
}

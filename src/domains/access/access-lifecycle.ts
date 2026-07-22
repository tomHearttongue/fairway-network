import type { AccessGrant } from "@/domains/access/fake-access-provider";

export type AccessGrantStatus = "active" | "revoked" | "expired";

export interface ManagedAccessGrant extends AccessGrant {
  status: AccessGrantStatus;
  revokedAt?: Date;
}

export function revokeAccessGrant(grant: ManagedAccessGrant, revokedAt: Date): ManagedAccessGrant {
  if (grant.status === "revoked") return { ...grant, revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : new Date(revokedAt) };
  return { ...grant, status: "revoked", revokedAt: new Date(revokedAt) };
}

export function canUseAccessGrant(grant: ManagedAccessGrant, at: Date): boolean {
  return grant.status === "active" && grant.startsAt <= at && grant.expiresAt > at;
}

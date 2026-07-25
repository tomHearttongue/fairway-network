import { formatLocationTime } from "@/shared/location-time";

type AccessWindowSummary = {
  accessWindowStatus: "none" | "scheduled" | "active" | "expired" | "revoked";
  accessGrant?: { startsAt: string } | null;
};

export function memberAccessMessage(summary: AccessWindowSummary, timeZone: string): string {
  if (summary.accessWindowStatus === "active") return "Access is open now.";
  if (summary.accessWindowStatus === "scheduled" && summary.accessGrant?.startsAt) {
    return `Access opens at ${formatLocationTime(summary.accessGrant.startsAt, timeZone)}.`;
  }
  if (summary.accessWindowStatus === "expired" || summary.accessWindowStatus === "revoked") {
    return "Access is closed.";
  }
  return "Access will be prepared for this session.";
}

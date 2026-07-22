export type DemoGolfProfile = {
  id: string;
  displayName: string;
  label: string;
  officialGolf: {
    handicapIndex: number | null;
    source: string;
    status: "simulated" | "manual" | "verified" | "not_established";
    lastUpdated?: string;
  };
  performance: Array<{
    clubCode: "driver" | "7i" | "pw";
    clubName: string;
    typicalCarryYards: number;
    ballSpeedMph?: number;
    dispersionYards: number;
    sampleCount: number;
    trend: "stable" | "building" | "improving";
    provenance: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    detail: string;
    occurredAt: string;
  }>;
};

export const TOM_DEMO_GOLF_PROFILE: DemoGolfProfile = {
  id: "demo_tom_golfer",
  displayName: "Tom",
  label: "Demo Golfer",
  officialGolf: {
    handicapIndex: 8.4,
    source: "Simulated official-golf demo source",
    status: "simulated",
    lastUpdated: "2026-07-20T14:00:00.000Z",
  },
  performance: [
    { clubCode: "driver", clubName: "Driver", typicalCarryYards: 264, ballSpeedMph: 163, dispersionYards: 28, sampleCount: 43, trend: "stable", provenance: "Fairway baseline - 43 demo shots" },
    { clubCode: "7i", clubName: "7 Iron", typicalCarryYards: 169, ballSpeedMph: 121, dispersionYards: 18, sampleCount: 36, trend: "improving", provenance: "Fairway baseline - 36 demo shots" },
    { clubCode: "pw", clubName: "PW", typicalCarryYards: 132, ballSpeedMph: 96, dispersionYards: 12, sampleCount: 28, trend: "building", provenance: "Fairway baseline - 28 demo shots" },
  ],
  activity: [
    { id: "demo_activity_1", title: "Practice Suite session", detail: "Driver baseline and wedge distance ladder", occurredAt: "2026-07-19T22:30:00.000Z" },
    { id: "demo_activity_2", title: "Fairway baseline updated", detail: "7 Iron typical carry moved to 169 yd", occurredAt: "2026-07-16T21:15:00.000Z" },
    { id: "demo_activity_3", title: "Guest-ready session", detail: "Played with one hosted guest", occurredAt: "2026-07-12T19:45:00.000Z" },
  ],
};

const NEW_GOLFER_DEMO_PROFILE: DemoGolfProfile = {
  id: "demo_new_golfer",
  displayName: "New Golfer",
  label: "Getting Started",
  officialGolf: {
    handicapIndex: null,
    source: "No official-golf demo value established",
    status: "not_established",
  },
  performance: [],
  activity: [],
};

const POWER_TOUR_DEMO_PROFILE: DemoGolfProfile = {
  id: "demo_power_tour_member",
  displayName: "Maya",
  label: "Power Tour Member",
  officialGolf: {
    handicapIndex: 3.1,
    source: "Simulated official-golf demo source",
    status: "simulated",
    lastUpdated: "2026-07-20T14:00:00.000Z",
  },
  performance: [
    { clubCode: "driver", clubName: "Driver", typicalCarryYards: 281, ballSpeedMph: 171, dispersionYards: 22, sampleCount: 118, trend: "stable", provenance: "Fairway baseline - 118 demo shots" },
    { clubCode: "7i", clubName: "7 Iron", typicalCarryYards: 181, ballSpeedMph: 128, dispersionYards: 14, sampleCount: 96, trend: "improving", provenance: "Fairway baseline - 96 demo shots" },
    { clubCode: "pw", clubName: "PW", typicalCarryYards: 141, ballSpeedMph: 101, dispersionYards: 9, sampleCount: 74, trend: "stable", provenance: "Fairway baseline - 74 demo shots" },
  ],
  activity: [
    { id: "power_activity_1", title: "Practice Suite session", detail: "Speed ladder and fairway window work", occurredAt: "2026-07-21T00:15:00.000Z" },
    { id: "power_activity_2", title: "Baseline refreshed", detail: "Driver dispersion tightened to 22 yd", occurredAt: "2026-07-18T20:45:00.000Z" },
    { id: "power_activity_3", title: "Streak preserved", detail: "Fourth Fairway session this week", occurredAt: "2026-07-17T23:30:00.000Z" },
  ],
};

export function demoGolfProfileForEmail(email: string): DemoGolfProfile {
  const normalized = email.toLowerCase();
  if (normalized.startsWith("fairway-ux-new-golfer")) return NEW_GOLFER_DEMO_PROFILE;
  if (normalized.startsWith("fairway-ux-power-tour-member")) return POWER_TOUR_DEMO_PROFILE;
  return TOM_DEMO_GOLF_PROFILE;
}
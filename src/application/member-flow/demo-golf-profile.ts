export type DemoGolfProfile = {
  id: string;
  displayName: string;
  label: string;
  officialGolf: {
    handicapIndex: number;
    source: string;
    status: "simulated" | "manual" | "verified";
    lastUpdated: string;
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
    { clubCode: "driver", clubName: "Driver", typicalCarryYards: 264, ballSpeedMph: 163, dispersionYards: 28, sampleCount: 43, trend: "stable", provenance: "Fairway baseline � 43 demo shots" },
    { clubCode: "7i", clubName: "7 Iron", typicalCarryYards: 169, ballSpeedMph: 121, dispersionYards: 18, sampleCount: 36, trend: "improving", provenance: "Fairway baseline � 36 demo shots" },
    { clubCode: "pw", clubName: "PW", typicalCarryYards: 132, ballSpeedMph: 96, dispersionYards: 12, sampleCount: 28, trend: "building", provenance: "Fairway baseline � 28 demo shots" },
  ],
  activity: [
    { id: "demo_activity_1", title: "Practice Suite session", detail: "Driver baseline and wedge distance ladder", occurredAt: "2026-07-19T22:30:00.000Z" },
    { id: "demo_activity_2", title: "Fairway baseline updated", detail: "7 Iron typical carry moved to 169 yd", occurredAt: "2026-07-16T21:15:00.000Z" },
    { id: "demo_activity_3", title: "Guest-ready session", detail: "Played with one hosted guest", occurredAt: "2026-07-12T19:45:00.000Z" },
  ],
};
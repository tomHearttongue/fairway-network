export const FAIRWAY_DEMO_UNIVERSE_VERSION = "DU1-v1";
export const FAIRWAY_DEMO_UNIVERSE_SEED = "fairway-demo-universe-du1-v1";
export const FAIRWAY_DEMO_CLOCK_ISO = "2026-07-23T20:00:00.000Z";
export const FAIRWAY_DEMO_PROVENANCE = {
  sourceType: "DEMO",
  sourceProvider: "FAIRWAY_DEMO_UNIVERSE",
  sourceVersion: FAIRWAY_DEMO_UNIVERSE_VERSION,
} as const;

export const DEMO_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

export type DemoScenarioKey = "normal" | "busy-prime" | "new-member" | "facility-incident" | "low-inventory";
export type DemoPersonaId = "demo-tom" | "competitive-low" | "high-variance" | "bogey-grinder" | "new-golfer" | "time-compressed-pro" | "champions-member" | "night-owl-social" | "facilities-fran";
export type DemoMemberArchetype = "committed-mid-handicap" | "competitive-low-handicap" | "high-variance" | "improving-high-handicap" | "new-golfer" | "time-compressed-professional" | "champions" | "night-owl" | "social-golfer" | "facilities";
export type IdentityPoolKey = "realistic" | "subtleGolf" | "obviousGolf" | "easterEgg" | "recognizableGolfCulture";

export interface DemoUniverse {
  metadata: {
    version: string;
    seed: string;
    clock: string;
    scenario: DemoScenarioKey;
    provenance: typeof FAIRWAY_DEMO_PROVENANCE;
  };
  locations: DemoLocation[];
  membershipPlans: DemoMembershipPlan[];
  members: DemoMember[];
  memberships: DemoMembership[];
  creditLedgerEntries: DemoCreditLedgerEntry[];
  ledgerAudits: DemoLedgerAudit[];
  personas: DemoPersona[];
  personaEvidence: DemoPersonaEvidence[];
  bags: DemoBag[];
  shots: DemoShot[];
  reservations: DemoReservation[];
  sessions: DemoSession[];
  accessGrants: DemoAccessGrant[];
  facilityTasks: DemoFacilityTask[];
  facilityState: DemoSuiteState[];
  guests: DemoGuest[];
  reservationGuests: DemoReservationGuest[];
  agreementVersions: DemoAgreementVersion[];
  agreementAcceptances: DemoAgreementAcceptance[];
  scenarioExpectation: DemoScenarioExpectation;
  identityPools: Record<IdentityPoolKey, string[]>;
}

export interface DemoLocation {
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

export interface DemoMembershipPlan {
  id: string;
  code: "TEST_BIRDIE" | "TEST_TOUR" | "TEST_CHAMPIONS" | "TEST_NIGHT_OWL";
  name: string;
  monthlyCredits: number;
  bookingWindowDays: number;
  maxActiveFutureReservations: number;
  playNowEnabled: boolean;
  guestAllowance: number;
}

export interface DemoMember {
  id: string;
  personId: string;
  memberProfileId: string;
  email: string;
  displayName: string;
  memberNumber: string;
  homeLocationId: string;
  membershipPlanCode: DemoMembershipPlan["code"] | null;
  archetype: DemoMemberArchetype;
  identityPool: IdentityPoolKey;
  availableCreditUnits: number;
  personCreatedAt: string;
  memberProfileCreatedAt: string;
  role?: "facilities";
}

export interface DemoMembership {
  id: string;
  memberProfileId: string;
  membershipPlanCode: DemoMembershipPlan["code"];
  status: "active";
  startedAt: string;
  createdAt: string;
}

export interface DemoCreditLedgerEntry {
  id: string;
  memberProfileId: string;
  entryType: "grant" | "hold" | "commit" | "release" | "refund" | "expiration" | "adjustment";
  amountUnits: number;
  balanceDeltaUnits: number;
  relatedEntryId?: string;
  reservationId?: string;
  idempotencyKey: string;
  reason: string;
  actorId: string;
  createdAt: string;
}

export interface DemoLedgerAudit {
  memberProfileId: string;
  displayName: string;
  entryCount: number;
  grantUnits: number;
  committedUnits: number;
  expiredUnits: number;
  finalUnits: number;
  projectedAvailableUnits: number;
  negativeRunningBalanceCount: number;
  idempotencyKeysUnique: boolean;
  firstEntryAt?: string;
  lastEntryAt?: string;
}

export interface DemoPersona {
  id: DemoPersonaId;
  memberProfileId: string;
  displayName: string;
  archetype: DemoMemberArchetype;
  purpose: string;
  behaviorPattern: string;
  dataStoryIntent: string;
  scenarioCompatibility: DemoScenarioKey[];
}

export interface DemoPersonaEvidence {
  personaId: DemoPersonaId;
  displayName: string;
  planCode: DemoMembershipPlan["code"] | null;
  role: "member" | "facilities";
  availableCredits: number;
  reservations: number;
  completedSessions: number;
  historySpanDays: number;
  shots: number;
  bagClubs: number;
  guests: number;
  guestStates: Array<"pending" | "ready">;
  scenarioUsage: DemoScenarioKey[];
}

export interface DemoBag {
  memberProfileId: string;
  effectiveAt: string;
  clubs: DemoClub[];
}

export interface DemoClub {
  code: "driver" | "3w" | "hybrid" | "4i" | "5i" | "6i" | "7i" | "8i" | "9i" | "pw" | "gw" | "sw" | "putter";
  name: string;
  category: "wood" | "hybrid" | "iron" | "wedge" | "putter";
}

export interface DemoShot {
  id: string;
  memberProfileId: string;
  sessionId: string;
  clubCode: DemoClub["code"];
  occurredAt: string;
  carryYards: number;
  ballSpeedMph?: number;
  offlineYards: number;
  provenance: typeof FAIRWAY_DEMO_PROVENANCE;
}

export interface DemoReservation {
  id: string;
  locationId: string;
  suiteId: string;
  memberProfileId: string;
  bookingMode: "ADVANCE" | "PLAY_NOW";
  status: "confirmed" | "checked_in" | "completed" | "cancelled";
  startAt: string;
  endAt: string;
  creditUnits: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface DemoSession {
  id: string;
  reservationId: string;
  memberProfileId: string;
  suiteId: string;
  startedAt: string;
  endedAt?: string;
  provider: "demo";
  externalSessionId: string;
  createdAt: string;
}

export interface DemoAccessGrant {
  id: string;
  reservationId: string;
  memberProfileId: string;
  locationId: string;
  suiteId: string;
  status: "active" | "expired" | "revoked";
  windowStatus: "scheduled" | "active" | "expired" | "revoked";
  startsAt: string;
  expiresAt: string;
  provider: "fake";
  externalGrantId: string;
  createdAt: string;
}

export interface DemoFacilityTask {
  id: string;
  locationId: string;
  suiteId: string;
  taskType: "turnover" | "inspection";
  priority: number;
  status: "open" | "claimed" | "in_progress" | "completed";
  sourceReservationId?: string;
  sourceSessionId?: string;
  dueAt: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  claimedByMemberProfileId?: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;
  completionNotes?: string;
}

export interface DemoSuiteState {
  suiteId: string;
  status: "available" | "occupied" | "turnover" | "inspection_required" | "maintenance" | "administrative_hold";
  reason: string;
}

export interface DemoGuest {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface DemoReservationGuest {
  id: string;
  reservationId: string;
  sessionId?: string;
  hostMemberProfileId: string;
  guestId: string;
  status: "active";
  idempotencyKey: string;
  createdAt: string;
}

export interface DemoAgreementVersion {
  id: string;
  code: "GUEST_WAIVER";
  version: string;
  provider: "fake";
  status: "active";
  effectiveAt: string;
  createdAt: string;
}

export interface DemoAgreementAcceptance {
  id: string;
  agreementVersionId: string;
  guestId: string;
  provider: "fake";
  status: "requested" | "completed";
  requestedAt: string;
  completedAt?: string;
  evidenceReference: string;
  verificationState: "pending" | "verified";
  idempotencyKey: string;
  createdAt: string;
}

export interface DemoScenarioExpectation {
  scenario: DemoScenarioKey;
  primaryPersonaId: DemoPersonaId;
  readyNowCount: number;
  readyNowSuiteIds: string[];
  occupiedSuiteIds: string[];
  blockedSuites: Array<{ suiteId: string; reason: string; operationalStatus: DemoSuiteState["status"] }>;
  activeSessionIds: string[];
  futureReservationIds: string[];
  facilityTaskIds: string[];
  story: string;
}

export interface DemoGolfProfile {
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
  activity: Array<{ id: string; title: string; detail: string; occurredAt: string }>;
}

export interface DemoIntegrityResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  fingerprint: string;
}

interface ScenarioPlan {
  scenario: DemoScenarioKey;
  primaryPersonaId: DemoPersonaId;
  currentReservations: CurrentReservationPlan[];
  operationalBlocks: Array<{ suiteNumber: number; status: "maintenance" | "administrative_hold" | "inspection_required"; reason: string }>;
  tasks: Array<{ key: string; suiteNumber: number; taskType: "turnover" | "inspection"; status: "open" | "claimed"; sourceReservationKey?: string; priority: number }>;
  expectedReadySuiteNumbers: number[];
  story: string;
}

interface CurrentReservationPlan {
  key: string;
  memberId: string;
  suiteNumber: number;
  status: "confirmed" | "checked_in" | "completed";
  mode: "ADVANCE" | "PLAY_NOW";
  startOffsetMinutes: number;
  durationMinutes: number;
  creditUnits: number;
}

interface HistorySpec {
  memberId: DemoPersonaId;
  sessionCount: number;
  spanDays: number;
  durations: number[];
  hourUtc: number;
  suites: number[];
  shotCount: number;
  mode: "ADVANCE" | "PLAY_NOW";
}

export const IDENTITY_POOLS: Record<IdentityPoolKey, string[]> = {
  realistic: [
    "Michael Carter", "Sarah Bennett", "David Kim", "Amanda Brooks", "James Walker", "Lauren Hughes", "Chris Morgan", "Emily Parker", "Daniel Price", "Rachel Turner",
    "Kevin Foster", "Megan Collins", "Andrew Bailey", "Natalie Reed", "Brian Walsh", "Erin Coleman", "Jason Miller", "Kara Mitchell", "Patrick Sullivan", "Olivia Hayes",
    "Ryan Cooper", "Hannah Ellis", "Brandon Scott", "Claire Donovan", "Marcus Lee", "Paige Stewart", "Ethan Russell", "Avery Nelson", "Derek Vaughn", "Lena Morris",
    "Simon Hart", "Jenna Price", "Noah Spencer", "Allison Grant", "Trevor Miles", "Molly Sinclair", "Victor Chen", "Rebecca Stone", "Ian Fletcher", "Tessa Bryant",
  ],
  subtleGolf: ["Chip Mulligan", "Ace Fairweather", "Wade Roughley", "Perry Pinseeker", "Graham Green", "Cal Cutter", "Max Carry", "Luke Lofton"],
  obviousGolf: ["Ned Threeputt", "Harry Hosel"],
  easterEgg: ["Lonnie Hawkins"],
  recognizableGolfCulture: [],
};

const REALISTIC_FIRST_NAMES = [
  "Aiden", "Alice", "Amelia", "Andrew", "Anna", "Audrey", "Benjamin", "Blake",
  "Caleb", "Caroline", "Chloe", "Connor", "Daniel", "Elena", "Emily", "Ethan",
  "Evelyn", "Gabriel", "Grace", "Hannah", "Henry", "Ian", "Isabel", "Jack",
  "Jasmine", "Jonah", "Julia", "Katherine", "Leah", "Leo", "Liam", "Lily",
  "Lucas", "Madeline", "Marcus", "Maya", "Mia", "Miles", "Naomi", "Nathan",
  "Nora", "Oliver", "Owen", "Paige", "Peter", "Rachel", "Ryan", "Samuel",
  "Sarah", "Simon", "Sophia", "Stella", "Theo", "Thomas", "Victoria", "William",
] as const;

const REALISTIC_SURNAMES = [
  "Adams", "Albright", "Alvarez", "Archer", "Atkins", "Baldwin", "Barnes", "Barrett",
  "Barton", "Beck", "Bell", "Benson", "Black", "Bolton", "Boyd", "Brennan",
  "Briggs", "Burke", "Burns", "Caldwell", "Callahan", "Carlson", "Chandler", "Chapman",
  "Clarke", "Clayton", "Cobb", "Conrad", "Cook", "Crawford", "Cross", "Dalton",
  "Dawson", "Dean", "Delaney", "Diaz", "Douglas", "Doyle", "Duncan", "Edwards",
  "Emerson", "Erickson", "Evans", "Farrell", "Fields", "Fischer", "Fleming", "Flores",
  "Ford", "Franklin", "Fraser", "Freeman", "Gallagher", "Gardner", "Garrett", "Gibbs",
  "Gilbert", "Gill", "Gordon", "Graham", "Greene", "Griffin", "Hale", "Hamilton",
  "Hampton", "Harper", "Harrington", "Harvey", "Hawkins", "Henderson", "Hendricks", "Henry",
  "Hines", "Holden", "Holland", "Holt", "Howard", "Ingram", "Jacobs", "James",
  "Jarvis", "Johnson", "Keller", "Kelley", "Kennedy", "Knox", "Lambert", "Lane",
  "Larson", "Lawrence", "Lewis", "Livingston", "Lloyd", "Logan", "Lowe", "Mack",
  "Marshall", "Mason", "Maxwell", "McCarthy", "McLean", "Medina", "Meyer", "Monroe",
  "Moody", "Murray", "Nash", "Newman", "Norris", "Osborne", "Page", "Palmer",
  "Parsons", "Pearson", "Perkins", "Pierce", "Porter", "Powell", "Quinn", "Ramsey",
  "Rhodes", "Richardson", "Rivers", "Robertson", "Ross", "Saunders", "Sawyer", "Schmidt",
  "Sherman", "Sims", "Snyder", "Spencer", "Stanton", "Stevens", "Sutton", "Thompson",
  "Wagner", "Warren", "Watkins", "Webb", "Wells", "Wheeler", "Whitaker", "Williams",
  "Willis", "Wilson", "Wright",
] as const;

export interface AuthoredDemoFundingEvent {
  id: string;
  memberId: DemoPersonaId;
  entryType: "grant";
  amountUnits: number;
  createdAt: string;
  rationale: string;
  eligibility: string;
  demoOnly: true;
}

export const AUTHORED_DEMO_FUNDING_EVENTS: AuthoredDemoFundingEvent[] = [
  authoredFunding("demo-tom", 106, "Primary Demo Tom account opening balance for longitudinal Golden Demo history."),
  authoredFunding("competitive-low", 15, "Authored competition-persona launch balance before historical practice usage."),
  authoredFunding("high-variance", 18, "Authored high-variance persona launch balance before historical practice usage."),
  authoredFunding("bogey-grinder", 12, "Authored grinder-persona launch balance before historical practice usage."),
  authoredFunding("time-compressed-pro", 16, "Authored time-compressed persona launch balance before historical practice usage."),
  authoredFunding("champions-member", 67, "Authored Champions persona launch balance before historical practice usage."),
  authoredFunding("night-owl-social", 30, "Authored Night Owl persona launch balance before historical and guest-host activity."),
];

const LOCATION: DemoLocation = {
  id: DEMO_LOCATION_ID,
  name: "Fairway KC",
  timezone: "America/Chicago",
  suiteCount: 12,
  minimumSessionMinutes: 30,
  bookingIncrementMinutes: 15,
  turnoverBufferMinutes: 15,
  accessBeforeMinutes: 15,
  accessAfterMinutes: 15,
  playNowEnabled: true,
};

const MEMBERSHIP_PLANS: DemoMembershipPlan[] = [
  { id: stableUuid("plan:test-birdie"), code: "TEST_BIRDIE", name: "Test Birdie", monthlyCredits: 24, bookingWindowDays: 7, maxActiveFutureReservations: 2, playNowEnabled: true, guestAllowance: 1 },
  { id: stableUuid("plan:test-tour"), code: "TEST_TOUR", name: "Test Tour", monthlyCredits: 96, bookingWindowDays: 14, maxActiveFutureReservations: 4, playNowEnabled: true, guestAllowance: 3 },
  { id: stableUuid("plan:test-champions"), code: "TEST_CHAMPIONS", name: "Test Champions", monthlyCredits: 60, bookingWindowDays: 14, maxActiveFutureReservations: 3, playNowEnabled: true, guestAllowance: 1 },
  { id: stableUuid("plan:test-night-owl"), code: "TEST_NIGHT_OWL", name: "Test Night Owl", monthlyCredits: 40, bookingWindowDays: 7, maxActiveFutureReservations: 2, playNowEnabled: true, guestAllowance: 1 },
];

const DEEP_PERSONA_FACTS: Array<{
  id: DemoPersonaId;
  name: string;
  email: string;
  plan: DemoMembershipPlan["code"] | null;
  archetype: DemoMemberArchetype;
  pool: IdentityPoolKey;
  credits: number;
  purpose: string;
  behavior: string;
  story: string;
}> = [
  { id: "demo-tom", name: "Tom", email: "fairway-ux-demo-active-birdie@example.com", plan: "TEST_BIRDIE", archetype: "committed-mid-handicap", pool: "realistic", credits: 48, purpose: "Primary Golden Demo protagonist.", behavior: "Regular evening practice with gaps and gradual measurable improvement.", story: "Months of Fairway practice produce credible Driver, 7 Iron, and PW baselines." },
  { id: "competitive-low", name: "Cameron Vale", email: "fairway-demo-competitive@example.com", plan: "TEST_TOUR", archetype: "competitive-low-handicap", pool: "realistic", credits: 90, purpose: "Future-compatible competition and low-handicap density.", behavior: "Frequent prime and standard practice with disciplined long-game work.", story: "Strong performance and tight consistency are derived from canonical shot facts." },
  { id: "high-variance", name: "Cole Mercer", email: "fairway-demo-high-variance@example.com", plan: "TEST_TOUR", archetype: "high-variance", pool: "realistic", credits: 90, purpose: "Talented but inconsistent performance archetype.", behavior: "High ball speed and carry with materially wider lateral variance.", story: "High upside and high variance remain grounded in plausible observations." },
  { id: "bogey-grinder", name: "Bogey Nelson", email: "fairway-demo-bogey@example.com", plan: "TEST_BIRDIE", archetype: "improving-high-handicap", pool: "subtleGolf", credits: 24, purpose: "Lovable improving grinder.", behavior: "Frequent shorter sessions with modest, noisy improvement.", story: "The subtle joke works because the performance data remains honest." },
  { id: "new-golfer", name: "Nora Bennett", email: "fairway-ux-new-golfer@example.com", plan: "TEST_BIRDIE", archetype: "new-golfer", pool: "realistic", credits: 24, purpose: "Future ONB1 and empty-state validation.", behavior: "New member with no Fairway performance history.", story: "Premium empty states should remain useful and inviting." },
  { id: "time-compressed-pro", name: "Priya Shah", email: "fairway-demo-priya@example.com", plan: "TEST_BIRDIE", archetype: "time-compressed-professional", pool: "realistic", credits: 24, purpose: "Play Now convenience archetype.", behavior: "Eight efficient 30-45 minute sessions around work and family commitments.", story: "Embodies 'I have 45 minutes. I will go hit balls.'" },
  { id: "champions-member", name: "Maya Torres", email: "fairway-ux-power-tour-member@example.com", plan: "TEST_CHAMPIONS", archetype: "champions", pool: "realistic", credits: 80, purpose: "Dense My Golf state and higher-engagement membership.", behavior: "Weekday practice rhythm with deep longitudinal history.", story: "A richer state that remains coherent and scannable." },
  { id: "night-owl-social", name: "Grant Gimme", email: "fairway-ux-guest-host-member@example.com", plan: "TEST_NIGHT_OWL", archetype: "night-owl", pool: "subtleGolf", credits: 40, purpose: "Guest-hosting and off-hours archetype.", behavior: "Late sessions with reservation-scoped pending and ready guest evidence.", story: "Social golfer energy without inventing a social product." },
  { id: "facilities-fran", name: "Fran Facilities", email: "fairway-ux-facilities-user@example.com", plan: null, archetype: "facilities", pool: "realistic", credits: 0, purpose: "Restricted Cleaning Mode persona.", behavior: "Facilities-only actor with no golfer entitlements or history.", story: "Exercises least-privilege facility workflows without accidental member data." },
];

const HISTORY_SPECS: HistorySpec[] = [
  { memberId: "demo-tom", sessionCount: 36, spanDays: 180, durations: [45, 60, 60, 60, 90, 60], hourUtc: 23, suites: [1, 8, 9], shotCount: 280, mode: "PLAY_NOW" },
  { memberId: "competitive-low", sessionCount: 12, spanDays: 100, durations: [60, 75], hourUtc: 21, suites: [2], shotCount: 132, mode: "ADVANCE" },
  { memberId: "high-variance", sessionCount: 10, spanDays: 95, durations: [60, 75, 90], hourUtc: 22, suites: [3], shotCount: 110, mode: "PLAY_NOW" },
  { memberId: "bogey-grinder", sessionCount: 12, spanDays: 130, durations: [30, 45, 45], hourUtc: 20, suites: [4], shotCount: 132, mode: "PLAY_NOW" },
  { memberId: "time-compressed-pro", sessionCount: 8, spanDays: 70, durations: [30, 45, 30, 45], hourUtc: 17, suites: [5], shotCount: 72, mode: "PLAY_NOW" },
  { memberId: "champions-member", sessionCount: 16, spanDays: 150, durations: [60, 75], hourUtc: 19, suites: [6, 11], shotCount: 340, mode: "ADVANCE" },
  { memberId: "night-owl-social", sessionCount: 12, spanDays: 100, durations: [45, 60], hourUtc: 2, suites: [7, 12], shotCount: 96, mode: "PLAY_NOW" },
];

const SCENARIO_PLANS: Record<DemoScenarioKey, ScenarioPlan> = {
  normal: {
    scenario: "normal",
    primaryPersonaId: "demo-tom",
    currentReservations: [
      { key: "priya-active", memberId: "time-compressed-pro", suiteNumber: 3, status: "checked_in", mode: "PLAY_NOW", startOffsetMinutes: -15, durationMinutes: 45, creditUnits: 6 },
      { key: "tom-upcoming", memberId: "demo-tom", suiteNumber: 10, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 90, durationMinutes: 60, creditUnits: 12 },
    ],
    operationalBlocks: [],
    tasks: [],
    expectedReadySuiteNumbers: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    story: "A credible baseline operating day with one active short session, Demo Tom's protected upcoming reservation, and safe immediate inventory.",
  },
  "busy-prime": {
    scenario: "busy-prime",
    primaryPersonaId: "time-compressed-pro",
    currentReservations: [
      ...[1, 2, 3, 4, 5, 6].map((suiteNumber, index): CurrentReservationPlan => ({ key: `busy-active-${suiteNumber}`, memberId: `lightweight-${String(index + 1).padStart(3, "0")}`, suiteNumber, status: "checked_in", mode: "ADVANCE", startOffsetMinutes: -15, durationMinutes: 60, creditUnits: 12 })),
      ...[7, 8, 9, 10].map((suiteNumber, index): CurrentReservationPlan => ({ key: `busy-future-${suiteNumber}`, memberId: `lightweight-${String(index + 10).padStart(3, "0")}`, suiteNumber, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 30, durationMinutes: 60, creditUnits: 12 })),
      { key: "tom-upcoming", memberId: "demo-tom", suiteNumber: 11, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 90, durationMinutes: 60, creditUnits: 12 },
    ],
    operationalBlocks: [],
    tasks: [],
    expectedReadySuiteNumbers: [11, 12],
    story: "High demand comes from six active sessions and four protected near-term reservations, leaving two safe suites ready now.",
  },
  "new-member": {
    scenario: "new-member",
    primaryPersonaId: "new-golfer",
    currentReservations: [
      { key: "tom-upcoming", memberId: "demo-tom", suiteNumber: 10, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 90, durationMinutes: 60, creditUnits: 12 },
    ],
    operationalBlocks: [],
    tasks: [],
    expectedReadySuiteNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    story: "Nora has a valid new membership and credits but no sessions, shots, bag, or mature baseline.",
  },
  "facility-incident": {
    scenario: "facility-incident",
    primaryPersonaId: "facilities-fran",
    currentReservations: [
      { key: "incident-priya-active", memberId: "time-compressed-pro", suiteNumber: 3, status: "checked_in", mode: "PLAY_NOW", startOffsetMinutes: -15, durationMinutes: 45, creditUnits: 6 },
      { key: "incident-turnover-source", memberId: "lightweight-050", suiteNumber: 6, status: "completed", mode: "PLAY_NOW", startOffsetMinutes: -60, durationMinutes: 30, creditUnits: 4 },
      { key: "tom-upcoming", memberId: "demo-tom", suiteNumber: 10, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 90, durationMinutes: 60, creditUnits: 12 },
    ],
    operationalBlocks: [{ suiteNumber: 8, status: "inspection_required", reason: "Projector alignment requires inspection before use." }],
    tasks: [
      { key: "incident-turnover", suiteNumber: 6, taskType: "turnover", status: "claimed", sourceReservationKey: "incident-turnover-source", priority: 100 },
      { key: "incident-inspection", suiteNumber: 8, taskType: "inspection", status: "open", priority: 125 },
    ],
    expectedReadySuiteNumbers: [1, 2, 4, 5, 7, 9, 10, 11, 12],
    story: "A genuine inspection exception blocks Suite 8 while an unrelated completed session creates turnover work on Suite 6.",
  },
  "low-inventory": {
    scenario: "low-inventory",
    primaryPersonaId: "demo-tom",
    currentReservations: [
      ...[1, 2, 3, 4, 5].map((suiteNumber, index): CurrentReservationPlan => ({ key: `low-active-${suiteNumber}`, memberId: `lightweight-${String(index + 30).padStart(3, "0")}`, suiteNumber, status: "checked_in", mode: "ADVANCE", startOffsetMinutes: -15, durationMinutes: 60, creditUnits: 12 })),
      ...[6, 7, 8].map((suiteNumber, index): CurrentReservationPlan => ({ key: `low-future-${suiteNumber}`, memberId: `lightweight-${String(index + 40).padStart(3, "0")}`, suiteNumber, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 30, durationMinutes: 60, creditUnits: 12 })),
      { key: "tom-upcoming", memberId: "demo-tom", suiteNumber: 11, status: "confirmed", mode: "ADVANCE", startOffsetMinutes: 90, durationMinutes: 60, creditUnits: 12 },
    ],
    operationalBlocks: [
      { suiteNumber: 9, status: "maintenance", reason: "Launch monitor calibration in progress." },
      { suiteNumber: 10, status: "administrative_hold", reason: "Reserved for a scheduled facility check." },
    ],
    tasks: [],
    expectedReadySuiteNumbers: [11, 12],
    story: "Inventory is constrained by five active sessions, three protected near-term reservations, one maintenance block, and one administrative hold; Demo Tom retains sufficient credits.",
  },
};

const AGREEMENT_VERSION: DemoAgreementVersion = {
  id: "00000000-0000-0000-0000-000000000501",
  code: "GUEST_WAIVER",
  version: "dev-2026-07",
  provider: "fake",
  status: "active",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2025-12-15T18:00:00.000Z",
};

export function buildDemoUniverse(input: { scenario?: DemoScenarioKey } = {}): DemoUniverse {
  const scenario = input.scenario ?? "normal";
  const members = buildMembers();
  const personas = buildPersonas(members);
  const memberships = buildMemberships(members);
  const historicalReservations = buildHistoricalReservations(members, memberships);
  const guestReservations = buildGuestReservations(members);
  const plan = SCENARIO_PLANS[scenario];
  const scenarioReservations = buildScenarioReservations(members, plan);
  const reservations = [...historicalReservations, ...guestReservations, ...scenarioReservations].sort(sortByCreatedThenId);
  const sessions = buildSessions(reservations);
  const facilityTasks = buildFacilityTasks(plan, reservations, sessions, members);
  const facilityState = buildFacilityState(plan, sessions, facilityTasks);
  const bags = buildBags(members, memberships);
  const shots = buildShots(members, sessions, bags);
  const guestFacts = buildGuestFacts(members, reservations, sessions);
  const creditLedgerEntries = buildCreditLedgerEntries(members, memberships, reservations);
  applyAvailableCreditProjection(members, creditLedgerEntries);
  const accessGrants = buildAccessGrants(reservations);
  const scenarioExpectation = buildScenarioExpectation(plan, reservations, sessions, facilityTasks, facilityState);
  const ledgerAudits = buildLedgerAudits(members, creditLedgerEntries);
  const personaEvidence = buildPersonaEvidence(members, personas, memberships, reservations, sessions, shots, bags, guestFacts, ledgerAudits);

  return {
    metadata: {
      version: FAIRWAY_DEMO_UNIVERSE_VERSION,
      seed: FAIRWAY_DEMO_UNIVERSE_SEED,
      clock: FAIRWAY_DEMO_CLOCK_ISO,
      scenario,
      provenance: FAIRWAY_DEMO_PROVENANCE,
    },
    locations: [LOCATION],
    membershipPlans: MEMBERSHIP_PLANS,
    members,
    memberships,
    creditLedgerEntries,
    ledgerAudits,
    personas,
    personaEvidence,
    bags,
    shots,
    reservations,
    sessions,
    accessGrants,
    facilityTasks,
    facilityState,
    guests: guestFacts.guests,
    reservationGuests: guestFacts.reservationGuests,
    agreementVersions: [AGREEMENT_VERSION],
    agreementAcceptances: guestFacts.agreementAcceptances,
    scenarioExpectation,
    identityPools: IDENTITY_POOLS,
  };
}

export function demoGolfProfileForEmail(email: string, scenario: DemoScenarioKey = "normal"): DemoGolfProfile {
  const universe = buildDemoUniverse({ scenario });
  const normalized = email.toLowerCase();
  const member = universe.members.find((item) => item.email.toLowerCase() === normalized) ?? universe.members.find((item) => item.id === "demo-tom");
  if (!member) throw new Error("DEMO_TOM_NOT_FOUND");
  return deriveDemoGolfProfile(universe, member.memberProfileId);
}

export function deriveDemoGolfProfile(universe: DemoUniverse, memberProfileId: string): DemoGolfProfile {
  const member = required(universe.members.find((item) => item.memberProfileId === memberProfileId), `member ${memberProfileId}`);
  const sessions = universe.sessions.filter((session) => session.memberProfileId === memberProfileId && session.endedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const shots = universe.shots.filter((shot) => shot.memberProfileId === memberProfileId);

  if (member.archetype === "new-golfer" || shots.length === 0) {
    return {
      id: member.id === "new-golfer" ? "demo_new_golfer" : member.id,
      displayName: firstName(member.displayName),
      label: member.archetype === "new-golfer" ? "Getting Started" : labelForArchetype(member.archetype),
      officialGolf: member.archetype === "new-golfer"
        ? { handicapIndex: null, source: "No official handicap connected", status: "not_established" }
        : officialGolfFor(member),
      performance: [],
      activity: [],
    };
  }

  return {
    id: member.id === "demo-tom" ? "demo_tom_golfer" : member.id,
    displayName: firstName(member.displayName),
    label: member.id === "demo-tom" ? "Demo Golfer" : labelForArchetype(member.archetype),
    officialGolf: officialGolfFor(member),
    performance: (["driver", "7i", "pw"] as const)
      .map((clubCode) => summarizeClub(shots, clubCode, member))
      .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary)),
    activity: sessions.slice(0, 3).map((session, index) => ({
      id: `demo_activity_${member.id}_${index + 1}`,
      title: activityTitle(session, index),
      detail: activityDetail(session, shots.filter((shot) => shot.sessionId === session.id)),
      occurredAt: session.startedAt,
    })),
  };
}

export function buildScenarioReconciliation(universe: DemoUniverse) {
  const primary = required(universe.personaEvidence.find((item) => item.personaId === universe.scenarioExpectation.primaryPersonaId), "primary persona evidence");
  const primaryMember = required(universe.members.find((item) => item.id === primary.personaId), "primary member");
  const primaryProfile = primary.role === "member" ? deriveDemoGolfProfile(universe, primaryMember.memberProfileId) : null;
  const primaryReservations = universe.reservations.filter((item) => item.memberProfileId === primaryMember.memberProfileId);
  const primaryAccess = universe.accessGrants.filter((item) => item.memberProfileId === primaryMember.memberProfileId);
  const primaryGuests = universe.reservationGuests.filter((item) => item.hostMemberProfileId === primaryMember.memberProfileId);
  return {
    universe: {
      version: universe.metadata.version,
      seed: universe.metadata.seed,
      clock: universe.metadata.clock,
      scenario: universe.metadata.scenario,
      fingerprint: verifyDemoUniverse(universe).fingerprint,
    },
    persona: primary,
    membership: universe.memberships.find((item) => item.memberProfileId === primaryMember.memberProfileId) ?? null,
    ledger: universe.ledgerAudits.find((item) => item.memberProfileId === primaryMember.memberProfileId) ?? null,
    reservations: primaryReservations,
    sessions: universe.sessions.filter((item) => item.memberProfileId === primaryMember.memberProfileId),
    access: primaryAccess,
    suiteAvailability: universe.scenarioExpectation,
    guests: primaryGuests.map((association) => ({
      association,
      guest: universe.guests.find((item) => item.id === association.guestId),
      acceptance: universe.agreementAcceptances.find((item) => item.guestId === association.guestId) ?? null,
    })),
    myGolf: primaryProfile,
    facilityTasks: universe.facilityTasks,
    suiteReadiness: universe.facilityState.map((state) => suiteReadinessAtClock(universe, state)),
  };
}

export function buildPopulationMetrics(universe: DemoUniverse) {
  const realistic = universe.members.filter((member) => member.id.startsWith("lightweight-") && member.identityPool === "realistic");
  const firstNames = realistic.map((member) => member.displayName.split(" ")[0]);
  const surnames = realistic.map((member) => member.displayName.split(" ").at(-1) ?? "");
  const firstFrequency = countBy(firstNames, (value) => value);
  const surnameFrequency = countBy(surnames, (value) => value);
  const humorous = universe.members.filter((member) => member.id.startsWith("lightweight-") && member.identityPool !== "realistic");
  return {
    totalMembers: universe.members.length,
    deepPersonas: universe.personas.length,
    lightweightMembers: universe.members.length - universe.personas.length,
    realisticLightweightMembers: realistic.length,
    humorousLightweightMembers: humorous.length,
    uniqueFullNames: new Set(universe.members.map((member) => member.displayName)).size,
    uniqueRealisticSurnames: Object.keys(surnameFrequency).length,
    maxRealisticSurnameFrequency: Math.max(0, ...Object.values(surnameFrequency)),
    maxRealisticFirstNameFrequency: Math.max(0, ...Object.values(firstFrequency)),
    longestContiguousSurnameBlock: longestContiguousBlock(surnames),
    topSurnames: topFrequencyRows(surnameFrequency, 10),
    topFirstNames: topFrequencyRows(firstFrequency, 10),
    humorousMembers: humorous.map((member) => ({ id: member.id, displayName: member.displayName, pool: member.identityPool })),
  };
}

export function buildIndependentAudit(universes: DemoUniverse[]) {
  const scenarioRows = universes.map((universe) => {
    const integrity = verifyDemoUniverse(universe);
    const names = countBy(universe.members, (member) => member.displayName);
    return {
      scenario: universe.metadata.scenario,
      fingerprint: integrity.fingerprint,
      totalMembers: universe.members.length,
      uniqueNames: Object.keys(names).length,
      duplicateNameGroups: Object.entries(names).filter(([, count]) => count > 1),
      reservations: universe.reservations.length,
      sessions: universe.sessions.length,
      shots: universe.shots.length,
      shotsOutsideSession: countShotsOutsideSessions(universe),
      shotsWithClubsOutsideBags: countShotsOutsideBags(universe),
      reservationSuiteStateConflicts: countReservationSuiteConflicts(universe),
      occupiedTurnoverConflicts: countOccupiedTurnoverConflicts(universe),
      taskSessionChronologyConflicts: countTaskChronologyConflicts(universe),
      futureCreatedAtCount: countFutureCreatedAt(universe),
      ledgerNegativeRunningBalanceCount: universe.ledgerAudits.reduce((sum, item) => sum + item.negativeRunningBalanceCount, 0),
      accessStatusWindowConflicts: countAccessWindowConflicts(universe),
      readyNowCount: actualReadyNowSuiteIds(universe).length,
      expectedReadyNowCount: universe.scenarioExpectation.readyNowCount,
      integrityErrors: integrity.errors,
    };
  });
  return {
    version: FAIRWAY_DEMO_UNIVERSE_VERSION,
    seed: FAIRWAY_DEMO_UNIVERSE_SEED,
    clock: FAIRWAY_DEMO_CLOCK_ISO,
    personaEvidence: universes[0]?.personaEvidence ?? [],
    scenarios: scenarioRows,
    conflictCount: scenarioRows.reduce((sum, row) => sum
      + row.shotsOutsideSession
      + row.shotsWithClubsOutsideBags
      + row.reservationSuiteStateConflicts
      + row.occupiedTurnoverConflicts
      + row.taskSessionChronologyConflicts
      + row.futureCreatedAtCount
      + row.ledgerNegativeRunningBalanceCount
      + row.accessStatusWindowConflicts
      + row.integrityErrors.length, 0),
  };
}

export function verifyDemoUniverse(universe: DemoUniverse): DemoIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenario = universe.metadata.scenario;
  const context = (message: string) => `scenario=${scenario} ${message}`;

  verifyUnique(universe.members, (item) => item.id, "member id", errors, scenario);
  verifyUnique(universe.members, (item) => item.email.toLowerCase(), "member email", errors, scenario);
  verifyUnique(universe.members, (item) => item.personId, "person id", errors, scenario);
  verifyUnique(universe.members, (item) => item.memberProfileId, "member profile id", errors, scenario);
  verifyUnique(universe.reservations, (item) => item.id, "reservation id", errors, scenario);
  verifyUnique(universe.reservations, (item) => item.idempotencyKey, "reservation idempotency key", errors, scenario);
  verifyUnique(universe.sessions, (item) => item.id, "session id", errors, scenario);
  verifyUnique(universe.shots, (item) => item.id, "shot id", errors, scenario);
  verifyUnique(universe.creditLedgerEntries, (item) => item.idempotencyKey, "credit idempotency key", errors, scenario);
  verifyUnique(universe.accessGrants, (item) => item.id, "access grant id", errors, scenario);
  verifyUnique(universe.facilityTasks, (item) => item.idempotencyKey, "facility task idempotency key", errors, scenario);

  if (universe.metadata.version !== FAIRWAY_DEMO_UNIVERSE_VERSION) errors.push(context(`version expected=${FAIRWAY_DEMO_UNIVERSE_VERSION} actual=${universe.metadata.version}`));
  if (universe.metadata.seed !== FAIRWAY_DEMO_UNIVERSE_SEED) errors.push(context(`seed expected=${FAIRWAY_DEMO_UNIVERSE_SEED} actual=${universe.metadata.seed}`));
  if (universe.metadata.clock !== FAIRWAY_DEMO_CLOCK_ISO) errors.push(context(`clock expected=${FAIRWAY_DEMO_CLOCK_ISO} actual=${universe.metadata.clock}`));
  if (universe.members.length !== 220) errors.push(context(`population expected=220 actual=${universe.members.length}`));
  if (universe.personas.length !== 9) errors.push(context(`deep-personas expected=9 actual=${universe.personas.length}`));
  if (universe.members.length - universe.personas.length !== 211) errors.push(context(`lightweight-members expected=211 actual=${universe.members.length - universe.personas.length}`));

  const names = countBy(universe.members, (member) => member.displayName);
  const uniqueNameCount = Object.keys(names).length;
  if (uniqueNameCount !== 220) errors.push(context(`display-name uniqueness expected=220 actual=${uniqueNameCount}`));
  for (const [name, count] of Object.entries(names)) if (count > 1) errors.push(context(`display-name duplicate name="${name}" count=${count} max=1`));
  for (const thirdPartyName of ["Shooter McGavin", "Roy McAvoy", "Happy Gilmore"]) {
    if (universe.members.some((member) => member.displayName === thirdPartyName)) errors.push(context(`public display name must be original name="${thirdPartyName}"`));
  }
  const humorousCount = universe.members.filter((member) => ["subtleGolf", "obviousGolf", "easterEgg", "recognizableGolfCulture"].includes(member.identityPool)).length;
  if (humorousCount > 10) errors.push(context(`golf-humor identities expected<=10 actual=${humorousCount}`));
  const population = buildPopulationMetrics(universe);
  if (population.realisticLightweightMembers !== 203) errors.push(context(`realistic lightweight expected=203 actual=${population.realisticLightweightMembers}`));
  if (population.humorousLightweightMembers !== 8) errors.push(context(`humorous lightweight expected=8 actual=${population.humorousLightweightMembers}`));
  if (population.uniqueRealisticSurnames < 120) errors.push(context(`realistic surnames expected>=120 actual=${population.uniqueRealisticSurnames}`));
  if (population.maxRealisticSurnameFrequency > 3) errors.push(context(`surname frequency expected<=3 actual=${population.maxRealisticSurnameFrequency}`));
  if (population.maxRealisticFirstNameFrequency > 4) errors.push(context(`first-name frequency expected<=4 actual=${population.maxRealisticFirstNameFrequency}`));
  if (population.longestContiguousSurnameBlock > 2) errors.push(context(`contiguous surname block expected<=2 actual=${population.longestContiguousSurnameBlock}`));

  const membersByProfile = new Map(universe.members.map((member) => [member.memberProfileId, member]));
  const membershipsByProfile = new Map(universe.memberships.map((membership) => [membership.memberProfileId, membership]));
  for (const member of universe.members) {
    if (Date.parse(member.personCreatedAt) > Date.parse(member.memberProfileCreatedAt)) errors.push(context(`identity chronology member=${member.id} personCreatedAt=${member.personCreatedAt} memberProfileCreatedAt=${member.memberProfileCreatedAt}`));
    if (Date.parse(member.memberProfileCreatedAt) > Date.parse(universe.metadata.clock)) errors.push(context(`future createdAt member=${member.id} createdAt=${member.memberProfileCreatedAt} clock=${universe.metadata.clock}`));
    const membership = membershipsByProfile.get(member.memberProfileId);
    if (member.role === "facilities") {
      if (membership) errors.push(context(`facilities-only membership conflict member=${member.id} membership=${membership.id}`));
      if (member.availableCreditUnits !== 0) errors.push(context(`facilities-only credits conflict member=${member.id} availableUnits=${member.availableCreditUnits}`));
    } else {
      if (!membership) errors.push(context(`missing active membership member=${member.id} profile=${member.memberProfileId}`));
      if (membership && member.membershipPlanCode !== membership.membershipPlanCode) errors.push(context(`membership plan mismatch member=${member.id} memberPlan=${member.membershipPlanCode} membershipPlan=${membership.membershipPlanCode}`));
      if (membership && Date.parse(member.memberProfileCreatedAt) > Date.parse(membership.createdAt)) errors.push(context(`membership chronology member=${member.id} profileCreatedAt=${member.memberProfileCreatedAt} membershipCreatedAt=${membership.createdAt}`));
    }
  }

  for (const reservation of universe.reservations) {
    const member = membersByProfile.get(reservation.memberProfileId);
    const membership = membershipsByProfile.get(reservation.memberProfileId);
    if (!member) errors.push(context(`reservation=${reservation.id} missing memberProfile=${reservation.memberProfileId}`));
    if (!membership) errors.push(context(`reservation=${reservation.id} has no active membership memberProfile=${reservation.memberProfileId}`));
    if (membership && Date.parse(membership.startedAt) > Date.parse(reservation.createdAt)) errors.push(context(`reservation funding eligibility reservation=${reservation.id} membershipStartedAt=${membership.startedAt} reservationCreatedAt=${reservation.createdAt}`));
    if (!suiteIds().includes(reservation.suiteId)) errors.push(context(`reservation=${reservation.id} missing suite=${reservation.suiteId}`));
    if (Date.parse(reservation.endAt) <= Date.parse(reservation.startAt)) errors.push(context(`reservation=${reservation.id} invalid range startAt=${reservation.startAt} endAt=${reservation.endAt}`));
    if (Date.parse(reservation.createdAt) >= Date.parse(reservation.startAt)) errors.push(context(`reservation=${reservation.id} booking chronology createdAt=${reservation.createdAt} startAt=${reservation.startAt}`));
    if (Date.parse(reservation.createdAt) > Date.parse(universe.metadata.clock)) errors.push(context(`future createdAt reservation=${reservation.id} createdAt=${reservation.createdAt} clock=${universe.metadata.clock}`));
    if (reservation.creditUnits <= 0 || !Number.isInteger(reservation.creditUnits)) errors.push(context(`reservation=${reservation.id} invalid creditUnits=${reservation.creditUnits}`));
  }

  for (const session of universe.sessions) {
    const reservation = universe.reservations.find((item) => item.id === session.reservationId);
    if (!reservation) errors.push(context(`session=${session.id} missing reservation=${session.reservationId}`));
    if (reservation && reservation.memberProfileId !== session.memberProfileId) errors.push(context(`session=${session.id} member mismatch reservation=${reservation.id}`));
    if (reservation && reservation.suiteId !== session.suiteId) errors.push(context(`session=${session.id} suite mismatch reservation=${reservation.id} sessionSuite=${session.suiteId} reservationSuite=${reservation.suiteId}`));
    if (Date.parse(session.createdAt) > Date.parse(universe.metadata.clock)) errors.push(context(`future createdAt session=${session.id} createdAt=${session.createdAt} clock=${universe.metadata.clock}`));
    if (session.endedAt && Date.parse(session.endedAt) <= Date.parse(session.startedAt)) errors.push(context(`session=${session.id} invalid range startedAt=${session.startedAt} endedAt=${session.endedAt}`));
    const suiteState = universe.facilityState.find((state) => state.suiteId === session.suiteId);
    if (!session.endedAt && suiteState?.status !== "occupied") errors.push(context(`active session=${session.id} suite=${session.suiteId} expected=occupied actual=${suiteState?.status ?? "missing"}`));
  }

  for (const task of universe.facilityTasks) verifyFacilityTask(universe, task, errors);
  for (const shot of universe.shots) verifyShot(universe, shot, errors);
  verifyReservationSuiteState(universe, errors);
  verifyNoReservationOrSessionOverlaps(universe, errors);
  verifyScenarioExpectation(universe, errors);
  verifyAccessGrants(universe, errors);
  verifyLedger(universe, errors);
  verifyPersonaEvidence(universe, errors);
  verifyTomCoherence(universe, errors, warnings);

  return { ok: errors.length === 0, errors, warnings, fingerprint: fingerprint(canonicalize(universe)) };
}

export function summarizeDemoUniverse(universe: DemoUniverse) {
  const integrity = verifyDemoUniverse(universe);
  return {
    version: universe.metadata.version,
    seed: universe.metadata.seed,
    clock: universe.metadata.clock,
    scenario: universe.metadata.scenario,
    locations: universe.locations.length,
    members: universe.members.length,
    uniqueNames: new Set(universe.members.map((member) => member.displayName)).size,
    deepPersonas: universe.personas.length,
    reservations: universe.reservations.length,
    sessions: universe.sessions.length,
    shots: universe.shots.length,
    facilityTasks: universe.facilityTasks.length,
    readyNow: universe.scenarioExpectation.readyNowCount,
    facilityState: countBy(universe.facilityState, (state) => state.status),
    fingerprint: integrity.fingerprint,
  };
}

export function stableDemoUuid(input: string): string {
  return stableUuid(input);
}

function realisticIdentityForId(id: string): string {
  const match = /^lightweight-(\d{3})$/.exec(id);
  if (!match) throw new Error(`Invalid lightweight member ID: ${id}`);
  const ordinal = Number(match[1]);
  const firstName = REALISTIC_FIRST_NAMES[(ordinal * 29 + 17) % REALISTIC_FIRST_NAMES.length];
  const surname = REALISTIC_SURNAMES[(ordinal * 67 + 31) % REALISTIC_SURNAMES.length];
  return `${firstName} ${surname}`;
}

function buildMembers(): DemoMember[] {
  const deep = DEEP_PERSONA_FACTS.map(memberFromFact);
  const curatedGolf = [...IDENTITY_POOLS.subtleGolf.slice(0, 6), ...IDENTITY_POOLS.obviousGolf.slice(0, 2)];
  const population: DemoMember[] = [];
  for (let index = 0; index < 211; index += 1) {
    const id = `lightweight-${String(index + 1).padStart(3, "0")}`;
    const pool: IdentityPoolKey = index < 203 ? "realistic" : index < 209 ? "subtleGolf" : "obviousGolf";
    const displayName = pool === "realistic"
      ? realisticIdentityForId(id)
      : curatedGolf[index - 203];
    const archetype = archetypeForIndex(index);
    const membershipPlanCode = planForArchetype(archetype);
    const plan = required(MEMBERSHIP_PLANS.find((item) => item.code === membershipPlanCode), membershipPlanCode);
    population.push({
      id,
      personId: stableUuid(`person:${id}`),
      memberProfileId: stableUuid(`member-profile:${id}`),
      email: `fairway-demo-member-${String(index + 1).padStart(3, "0")}@example.com`,
      displayName,
      memberNumber: `FN-DEMO-${String(index + 1).padStart(4, "0")}`,
      homeLocationId: DEMO_LOCATION_ID,
      membershipPlanCode,
      archetype,
      identityPool: pool,
      availableCreditUnits: plan.monthlyCredits * 2,
      personCreatedAt: "2026-06-01T14:00:00.000Z",
      memberProfileCreatedAt: "2026-06-01T14:05:00.000Z",
    });
  }
  return [...deep, ...population].sort((a, b) => a.id.localeCompare(b.id));
}

function authoredFunding(memberId: DemoPersonaId, amountUnits: number, rationale: string): AuthoredDemoFundingEvent {
  return {
    id: `authored-opening:${memberId}`,
    memberId,
    entryType: "grant",
    amountUnits,
    createdAt: "2026-01-01T14:30:00.000Z",
    rationale,
    eligibility: `Explicit DU1 persona fixture ${memberId}`,
    demoOnly: true,
  };
}

function memberFromFact(fact: (typeof DEEP_PERSONA_FACTS)[number]): DemoMember {
  const isNew = fact.id === "new-golfer";
  const isFacilities = fact.id === "facilities-fran";
  const personCreatedAt = isNew ? "2026-07-18T14:00:00.000Z" : isFacilities ? "2026-01-02T15:00:00.000Z" : "2025-12-15T15:00:00.000Z";
  return {
    id: fact.id,
    personId: stableUuid(`person:${fact.id}`),
    memberProfileId: stableUuid(`member-profile:${fact.id}`),
    email: fact.email,
    displayName: fact.name,
    memberNumber: `FN-${fact.id.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14)}`,
    homeLocationId: DEMO_LOCATION_ID,
    membershipPlanCode: fact.plan,
    archetype: fact.archetype,
    identityPool: fact.pool,
    availableCreditUnits: fact.credits * 2,
    role: isFacilities ? "facilities" : undefined,
    personCreatedAt,
    memberProfileCreatedAt: addMinutes(personCreatedAt, 5),
  };
}

function buildMemberships(members: DemoMember[]): DemoMembership[] {
  return members
    .filter((member) => member.membershipPlanCode)
    .map((member) => {
      const startedAt = member.id === "new-golfer" ? "2026-07-19T14:00:00.000Z" : member.id.startsWith("lightweight-") ? "2026-07-01T14:00:00.000Z" : "2026-01-01T14:00:00.000Z";
      return {
        id: stableUuid(`membership:${member.id}`),
        memberProfileId: member.memberProfileId,
        membershipPlanCode: required(member.membershipPlanCode, member.id),
        status: "active",
        startedAt,
        createdAt: addMinutes(member.memberProfileCreatedAt, 5),
      };
    });
}

function buildPersonas(members: DemoMember[]): DemoPersona[] {
  return DEEP_PERSONA_FACTS.map((fact) => {
    const member = required(members.find((item) => item.id === fact.id), fact.id);
    return {
      id: fact.id,
      memberProfileId: member.memberProfileId,
      displayName: member.displayName,
      archetype: fact.archetype,
      purpose: fact.purpose,
      behaviorPattern: fact.behavior,
      dataStoryIntent: fact.story,
      scenarioCompatibility: fact.id === "new-golfer"
        ? ["normal", "new-member"]
        : fact.id === "facilities-fran"
          ? ["normal", "facility-incident"]
          : ["normal", "busy-prime", "facility-incident", "low-inventory"],
    };
  });
}

function buildHistoricalReservations(members: DemoMember[], memberships: DemoMembership[]): DemoReservation[] {
  const reservations: DemoReservation[] = [];
  for (const spec of HISTORY_SPECS) {
    const member = required(members.find((item) => item.id === spec.memberId), spec.memberId);
    const membership = required(memberships.find((item) => item.memberProfileId === member.memberProfileId), `membership ${spec.memberId}`);
    for (let index = 0; index < spec.sessionCount; index += 1) {
      const fraction = spec.sessionCount === 1 ? 0 : index / (spec.sessionCount - 1);
      const daysBack = Math.round(spec.spanDays - fraction * (spec.spanDays - 5));
      const startAt = addDaysAtHour(FAIRWAY_DEMO_CLOCK_ISO, -daysBack, spec.hourUtc + (index % 2));
      const durationMinutes = spec.durations[index % spec.durations.length];
      const mode = index % 4 === 0 ? "ADVANCE" : spec.mode;
      const provisionalCreatedAt = mode === "ADVANCE" ? addMinutes(startAt, -(1 + (index % 5)) * 24 * 60) : addMinutes(startAt, -20);
      const createdAt = Date.parse(provisionalCreatedAt) > Date.parse(membership.startedAt) ? provisionalCreatedAt : addMinutes(membership.startedAt, 60);
      reservations.push(reservationFor({
        key: `history:${spec.memberId}:${index}`,
        member,
        suiteNumber: spec.suites[index % spec.suites.length],
        status: "completed",
        mode,
        startAt,
        durationMinutes,
        creditUnits: historicalCreditUnits(spec.memberId, durationMinutes),
        createdAt,
      }));
    }
  }
  return reservations;
}

function buildGuestReservations(members: DemoMember[]): DemoReservation[] {
  const grant = required(members.find((member) => member.id === "night-owl-social"), "night-owl-social");
  return [
    reservationFor({ key: "guest:pending", member: grant, suiteNumber: 4, status: "confirmed", mode: "ADVANCE", startAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, 24 * 60), durationMinutes: 60, creditUnits: 8, createdAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, -24 * 60) }),
    reservationFor({ key: "guest:ready", member: grant, suiteNumber: 5, status: "confirmed", mode: "ADVANCE", startAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, 48 * 60), durationMinutes: 60, creditUnits: 8, createdAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, -23 * 60) }),
  ];
}

function buildScenarioReservations(members: DemoMember[], plan: ScenarioPlan): DemoReservation[] {
  return plan.currentReservations.map((item) => {
    const member = required(members.find((candidate) => candidate.id === item.memberId), item.memberId);
    const startAt = addMinutes(FAIRWAY_DEMO_CLOCK_ISO, item.startOffsetMinutes);
    const createdAt = item.status === "confirmed"
      ? addMinutes(FAIRWAY_DEMO_CLOCK_ISO, item.startOffsetMinutes > 60 ? -2 * 24 * 60 : -10)
      : addMinutes(startAt, -20);
    return reservationFor({
      key: `scenario:${plan.scenario}:${item.key}`,
      member,
      suiteNumber: item.suiteNumber,
      status: item.status,
      mode: item.mode,
      startAt,
      durationMinutes: item.durationMinutes,
      creditUnits: item.creditUnits,
      createdAt,
    });
  });
}

function buildSessions(reservations: DemoReservation[]): DemoSession[] {
  return reservations
    .filter((reservation) => reservation.status === "completed" || reservation.status === "checked_in")
    .map((reservation) => ({
      id: stableUuid(`session:${reservation.id}`),
      reservationId: reservation.id,
      memberProfileId: reservation.memberProfileId,
      suiteId: reservation.suiteId,
      startedAt: reservation.startAt,
      endedAt: reservation.status === "completed" ? reservation.endAt : undefined,
      provider: "demo" as const,
      externalSessionId: `du1-${reservation.id.slice(24)}`,
      createdAt: reservation.startAt,
    }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
}

function buildFacilityTasks(plan: ScenarioPlan, reservations: DemoReservation[], sessions: DemoSession[], members: DemoMember[]): DemoFacilityTask[] {
  const fran = required(members.find((member) => member.id === "facilities-fran"), "facilities-fran");
  return plan.tasks.map((task) => {
    const sourceReservation = task.sourceReservationKey
      ? required(reservations.find((reservation) => reservation.id === stableUuid(`reservation:scenario:${plan.scenario}:${task.sourceReservationKey}`)), task.sourceReservationKey)
      : undefined;
    const sourceSession = sourceReservation ? required(sessions.find((session) => session.reservationId === sourceReservation.id), `session for ${sourceReservation.id}`) : undefined;
    const createdAt = sourceSession?.endedAt ? addMinutes(sourceSession.endedAt, 1) : addMinutes(FAIRWAY_DEMO_CLOCK_ISO, -20);
    const claimedAt = task.status === "claimed" ? addMinutes(createdAt, 5) : undefined;
    return {
      id: stableUuid(`task:${plan.scenario}:${task.key}`),
      locationId: DEMO_LOCATION_ID,
      suiteId: suiteId(task.suiteNumber),
      taskType: task.taskType,
      priority: task.priority,
      status: task.status,
      sourceReservationId: sourceReservation?.id,
      sourceSessionId: sourceSession?.id,
      dueAt: task.taskType === "turnover" && sourceSession?.endedAt ? addMinutes(sourceSession.endedAt, LOCATION.turnoverBufferMinutes) : FAIRWAY_DEMO_CLOCK_ISO,
      idempotencyKey: `du1:task:${plan.scenario}:${task.key}`,
      createdAt,
      updatedAt: claimedAt ?? createdAt,
      claimedByMemberProfileId: claimedAt ? fran.memberProfileId : undefined,
      claimedAt,
    };
  });
}

function buildFacilityState(plan: ScenarioPlan, sessions: DemoSession[], tasks: DemoFacilityTask[]): DemoSuiteState[] {
  const states = suiteIds().map((id) => ({ suiteId: id, status: "available" as const, reason: "Ready for assignment." }));
  for (const session of sessions.filter((item) => !item.endedAt)) setSuiteState(states, session.suiteId, "occupied", `Active session ${session.id}.`);
  for (const task of tasks.filter((item) => item.status !== "completed")) {
    setSuiteState(states, task.suiteId, task.taskType === "turnover" ? "turnover" : "inspection_required", `${task.taskType} task ${task.id}.`);
  }
  for (const block of plan.operationalBlocks) setSuiteState(states, suiteId(block.suiteNumber), block.status, block.reason);
  return states;
}

function buildBags(members: DemoMember[], memberships: DemoMembership[]): DemoBag[] {
  const historyMemberIds = new Set(HISTORY_SPECS.map((spec) => spec.memberId));
  return members
    .filter((member) => historyMemberIds.has(member.id as DemoPersonaId))
    .map((member) => ({
      memberProfileId: member.memberProfileId,
      effectiveAt: required(memberships.find((item) => item.memberProfileId === member.memberProfileId), member.id).startedAt,
      clubs: bagForArchetype(member.archetype),
    }));
}

function buildShots(members: DemoMember[], sessions: DemoSession[], bags: DemoBag[]): DemoShot[] {
  const shots: DemoShot[] = [];
  for (const spec of HISTORY_SPECS) {
    const member = required(members.find((item) => item.id === spec.memberId), spec.memberId);
    const bag = required(bags.find((item) => item.memberProfileId === member.memberProfileId), `bag ${member.id}`);
    const memberSessions = sessions
      .filter((session) => session.memberProfileId === member.memberProfileId && session.endedAt)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const clubPattern = shotClubPattern(member);
    const clubTotals = countPlannedClubs(spec.shotCount, clubPattern);
    const clubOrdinals = new Map<DemoClub["code"], number>();
    let globalIndex = 0;
    for (let sessionIndex = 0; sessionIndex < memberSessions.length; sessionIndex += 1) {
      const session = memberSessions[sessionIndex];
      const count = Math.floor(spec.shotCount / memberSessions.length) + (sessionIndex < spec.shotCount % memberSessions.length ? 1 : 0);
      const durationMinutes = minutesBetween(session.startedAt, required(session.endedAt, session.id));
      for (let localIndex = 0; localIndex < count; localIndex += 1) {
        const clubCode = clubPattern[globalIndex % clubPattern.length];
        if (!bag.clubs.some((club) => club.code === clubCode)) throw new Error(`Shot plan club ${clubCode} is not in ${member.id}'s bag`);
        const clubOrdinal = clubOrdinals.get(clubCode) ?? 0;
        clubOrdinals.set(clubCode, clubOrdinal + 1);
        const measurement = shotMeasurement(member, clubCode, clubOrdinal, clubTotals[clubCode] ?? 1);
        const minuteOffset = count === 1 ? Math.floor(durationMinutes / 2) : 5 + Math.floor(((localIndex + 1) * Math.max(1, durationMinutes - 10)) / (count + 1));
        shots.push({
          id: stableUuid(`shot:${member.id}:${globalIndex}`),
          memberProfileId: member.memberProfileId,
          sessionId: session.id,
          clubCode,
          occurredAt: addMinutes(session.startedAt, minuteOffset),
          carryYards: measurement.carryYards,
          ballSpeedMph: measurement.ballSpeedMph,
          offlineYards: measurement.offlineYards,
          provenance: FAIRWAY_DEMO_PROVENANCE,
        });
        globalIndex += 1;
      }
    }
  }
  return shots.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

function buildGuestFacts(members: DemoMember[], reservations: DemoReservation[], sessions: DemoSession[]) {
  const grant = required(members.find((member) => member.id === "night-owl-social"), "night-owl-social");
  const pendingReservation = required(reservations.find((item) => item.id === stableUuid("reservation:guest:pending")), "guest pending reservation");
  const readyReservation = required(reservations.find((item) => item.id === stableUuid("reservation:guest:ready")), "guest ready reservation");
  const guests: DemoGuest[] = [
    { id: stableUuid("guest:grant:pending"), fullName: "Casey Monroe", email: "fairway-demo-guest-casey@example.com", createdAt: addMinutes(pendingReservation.createdAt, 10) },
    { id: stableUuid("guest:grant:ready"), fullName: "Riley Chen", email: "fairway-demo-guest-riley@example.com", createdAt: addMinutes(readyReservation.createdAt, 10) },
  ];
  const reservationGuests: DemoReservationGuest[] = guests.map((guest, index) => {
    const reservation = index === 0 ? pendingReservation : readyReservation;
    return {
      id: stableUuid(`reservation-guest:${reservation.id}:${guest.id}`),
      reservationId: reservation.id,
      sessionId: sessions.find((session) => session.reservationId === reservation.id)?.id,
      hostMemberProfileId: grant.memberProfileId,
      guestId: guest.id,
      status: "active",
      idempotencyKey: `du1:reservation-guest:${reservation.id}:${guest.id}`,
      createdAt: addMinutes(guest.createdAt, 1),
    };
  });
  const agreementAcceptances: DemoAgreementAcceptance[] = guests.map((guest, index) => {
    const requestedAt = addMinutes(guest.createdAt, 30);
    const completedAt = index === 1 ? addMinutes(requestedAt, 45) : undefined;
    return {
      id: stableUuid(`agreement-acceptance:${guest.id}`),
      agreementVersionId: AGREEMENT_VERSION.id,
      guestId: guest.id,
      provider: "fake",
      status: completedAt ? "completed" : "requested",
      requestedAt,
      completedAt,
      evidenceReference: completedAt ? `du1-waiver-evidence-${guest.id}` : `du1-waiver-request-${guest.id}`,
      verificationState: completedAt ? "verified" : "pending",
      idempotencyKey: `du1:agreement-acceptance:${guest.id}`,
      createdAt: requestedAt,
    };
  });
  return { guests, reservationGuests, agreementAcceptances };
}

function buildCreditLedgerEntries(members: DemoMember[], memberships: DemoMembership[], reservations: DemoReservation[]): DemoCreditLedgerEntry[] {
  const entries: DemoCreditLedgerEntry[] = [];
  for (const member of members.filter((item) => item.membershipPlanCode)) {
    const membership = required(memberships.find((item) => item.memberProfileId === member.memberProfileId), member.id);
    const plan = required(MEMBERSHIP_PLANS.find((item) => item.code === member.membershipPlanCode), String(member.membershipPlanCode));
    const memberReservations = reservations.filter((item) => item.memberProfileId === member.memberProfileId);
    const monthStarts = monthlyGrantDates(membership.startedAt, FAIRWAY_DEMO_CLOCK_ISO);
    const currentMonthStart = monthStarts.at(-1);
    const monthGrantUnits = plan.monthlyCredits * 2;

    for (const event of AUTHORED_DEMO_FUNDING_EVENTS.filter((item) => item.memberId === member.id)) {
      entries.push(ledgerEntry({
        member,
        key: event.id,
        entryType: event.entryType,
        amountUnits: event.amountUnits,
        balanceDeltaUnits: event.amountUnits,
        reason: `${event.rationale} Eligibility: ${event.eligibility} Demo-only; not a production entitlement.`,
        createdAt: event.createdAt,
      }));
    }

    for (const monthStart of monthStarts) {
      const nextMonth = addMonths(monthStart, 1);
      const monthlyKey = monthStart.slice(0, 7);
      entries.push(ledgerEntry({
        member,
        key: `monthly:${monthlyKey}`,
        entryType: "grant",
        amountUnits: monthGrantUnits,
        balanceDeltaUnits: monthGrantUnits,
        reason: `${plan.code} monthly demo grant for ${monthlyKey}.`,
        createdAt: monthStart,
      }));
      const commits = memberReservations.filter((reservation) => reservation.createdAt >= monthStart && reservation.createdAt < nextMonth).reduce((sum, reservation) => sum + reservation.creditUnits, 0);
      const unused = Math.max(0, monthGrantUnits - commits);
      if (monthStart !== currentMonthStart && unused > 0) {
        const grantId = stableUuid(`credit:${member.id}:monthly:${monthlyKey}`);
        entries.push(ledgerEntry({
          member,
          key: `expiration:${monthlyKey}`,
          entryType: "expiration",
          amountUnits: unused,
          balanceDeltaUnits: -unused,
          relatedEntryId: grantId,
          reason: `DU1 demo-only no-rollover expiration for ${monthlyKey}; production rollover policy remains unresolved.`,
          createdAt: addMinutes(nextMonth, -1),
        }));
      }
    }

    for (const reservation of memberReservations) {
      const hold = ledgerEntry({
        member,
        key: `hold:${reservation.id}`,
        entryType: "hold",
        amountUnits: reservation.creditUnits,
        balanceDeltaUnits: 0,
        reservationId: reservation.id,
        reason: "DU1 reservation credit hold.",
        createdAt: reservation.createdAt,
      });
      entries.push(hold);
      entries.push(ledgerEntry({
        member,
        key: `commit:${reservation.id}`,
        entryType: "commit",
        amountUnits: reservation.creditUnits,
        balanceDeltaUnits: -reservation.creditUnits,
        relatedEntryId: hold.id,
        reservationId: reservation.id,
        reason: "DU1 reservation credit commit.",
        createdAt: addMinutes(reservation.createdAt, 1),
      }));
    }
  }
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || ledgerOrder(a.entryType) - ledgerOrder(b.entryType) || a.id.localeCompare(b.id));
}

function applyAvailableCreditProjection(members: DemoMember[], entries: DemoCreditLedgerEntry[]): void {
  for (const member of members) {
    member.availableCreditUnits = entries
      .filter((entry) => entry.memberProfileId === member.memberProfileId)
      .reduce((balance, entry) => balance + entry.balanceDeltaUnits, 0);
  }
}

function buildAccessGrants(reservations: DemoReservation[]): DemoAccessGrant[] {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .map((reservation) => {
      const startsAt = addMinutes(reservation.startAt, -LOCATION.accessBeforeMinutes);
      const expiresAt = addMinutes(reservation.endAt, LOCATION.accessAfterMinutes);
      const persistentStatus: DemoAccessGrant["status"] = reservation.status === "completed" ? "expired" : "active";
      return {
        id: stableUuid(`access:${reservation.id}`),
        reservationId: reservation.id,
        memberProfileId: reservation.memberProfileId,
        locationId: reservation.locationId,
        suiteId: reservation.suiteId,
        status: persistentStatus,
        windowStatus: accessWindowStatus(persistentStatus, startsAt, expiresAt, FAIRWAY_DEMO_CLOCK_ISO),
        startsAt,
        expiresAt,
        provider: "fake",
        externalGrantId: `du1-access-${reservation.id.slice(24)}`,
        createdAt: addMinutes(reservation.createdAt, 2),
      };
    });
}

function buildScenarioExpectation(plan: ScenarioPlan, reservations: DemoReservation[], sessions: DemoSession[], facilityTasks: DemoFacilityTask[], facilityState: DemoSuiteState[]): DemoScenarioExpectation {
  const currentReservationIds = new Set(plan.currentReservations.map((item) => stableUuid(`reservation:scenario:${plan.scenario}:${item.key}`)));
  return {
    scenario: plan.scenario,
    primaryPersonaId: plan.primaryPersonaId,
    readyNowCount: plan.expectedReadySuiteNumbers.length,
    readyNowSuiteIds: plan.expectedReadySuiteNumbers.map(suiteId).sort(),
    occupiedSuiteIds: facilityState.filter((item) => item.status === "occupied").map((item) => item.suiteId).sort(),
    blockedSuites: facilityState
      .filter((item) => !plan.expectedReadySuiteNumbers.map(suiteId).includes(item.suiteId))
      .map((item) => ({ suiteId: item.suiteId, reason: item.reason, operationalStatus: item.status })),
    activeSessionIds: sessions.filter((item) => !item.endedAt && currentReservationIds.has(item.reservationId)).map((item) => item.id).sort(),
    futureReservationIds: reservations.filter((item) => currentReservationIds.has(item.id) && item.status === "confirmed" && item.startAt > FAIRWAY_DEMO_CLOCK_ISO).map((item) => item.id).sort(),
    facilityTaskIds: facilityTasks.map((item) => item.id).sort(),
    story: plan.story,
  };
}

function buildLedgerAudits(members: DemoMember[], entries: DemoCreditLedgerEntry[]): DemoLedgerAudit[] {
  return members.map((member) => {
    const memberEntries = entries.filter((entry) => entry.memberProfileId === member.memberProfileId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || ledgerOrder(a.entryType) - ledgerOrder(b.entryType));
    let balance = 0;
    let negativeRunningBalanceCount = 0;
    for (const entry of memberEntries) {
      balance += entry.balanceDeltaUnits;
      if (balance < 0) negativeRunningBalanceCount += 1;
    }
    return {
      memberProfileId: member.memberProfileId,
      displayName: member.displayName,
      entryCount: memberEntries.length,
      grantUnits: sum(memberEntries.filter((item) => item.entryType === "grant").map((item) => item.balanceDeltaUnits)),
      committedUnits: sum(memberEntries.filter((item) => item.entryType === "commit").map((item) => item.amountUnits)),
      expiredUnits: sum(memberEntries.filter((item) => item.entryType === "expiration").map((item) => item.amountUnits)),
      finalUnits: balance,
      projectedAvailableUnits: member.availableCreditUnits,
      negativeRunningBalanceCount,
      idempotencyKeysUnique: new Set(memberEntries.map((item) => item.idempotencyKey)).size === memberEntries.length,
      firstEntryAt: memberEntries[0]?.createdAt,
      lastEntryAt: memberEntries.at(-1)?.createdAt,
    };
  });
}

function buildPersonaEvidence(
  members: DemoMember[],
  personas: DemoPersona[],
  memberships: DemoMembership[],
  reservations: DemoReservation[],
  sessions: DemoSession[],
  shots: DemoShot[],
  bags: DemoBag[],
  guests: ReturnType<typeof buildGuestFacts>,
  audits: DemoLedgerAudit[],
): DemoPersonaEvidence[] {
  return personas.map((persona) => {
    const member = required(members.find((item) => item.memberProfileId === persona.memberProfileId), persona.id);
    const memberSessions = sessions.filter((item) => item.memberProfileId === member.memberProfileId && item.endedAt);
    const starts = memberSessions.map((item) => Date.parse(item.startedAt));
    const hostGuests = guests.reservationGuests.filter((item) => item.hostMemberProfileId === member.memberProfileId);
    return {
      personaId: persona.id,
      displayName: member.displayName,
      planCode: memberships.find((item) => item.memberProfileId === member.memberProfileId)?.membershipPlanCode ?? null,
      role: member.role === "facilities" ? "facilities" : "member",
      availableCredits: (audits.find((item) => item.memberProfileId === member.memberProfileId)?.finalUnits ?? 0) / 2,
      reservations: reservations.filter((item) => item.memberProfileId === member.memberProfileId).length,
      completedSessions: memberSessions.length,
      historySpanDays: starts.length > 1 ? Math.round((Math.max(...starts) - Math.min(...starts)) / 86_400_000) : 0,
      shots: shots.filter((item) => item.memberProfileId === member.memberProfileId).length,
      bagClubs: bags.find((item) => item.memberProfileId === member.memberProfileId)?.clubs.length ?? 0,
      guests: hostGuests.length,
      guestStates: hostGuests.map((association) => guests.agreementAcceptances.find((item) => item.guestId === association.guestId)?.verificationState === "verified" ? "ready" as const : "pending" as const),
      scenarioUsage: persona.scenarioCompatibility,
    };
  });
}

function verifyFacilityTask(universe: DemoUniverse, task: DemoFacilityTask, errors: string[]): void {
  const prefix = `scenario=${universe.metadata.scenario} task=${task.id} suite=${task.suiteId}`;
  if (!suiteIds().includes(task.suiteId)) errors.push(`${prefix} references missing suite`);
  if (Date.parse(task.createdAt) > Date.parse(universe.metadata.clock)) errors.push(`${prefix} future createdAt=${task.createdAt} clock=${universe.metadata.clock}`);
  if (task.taskType === "turnover") {
    const sourceSession = universe.sessions.find((session) => session.id === task.sourceSessionId);
    if (!sourceSession) errors.push(`${prefix} turnover missing sourceSession=${task.sourceSessionId ?? "none"}`);
    if (sourceSession && !sourceSession.endedAt) errors.push(`${prefix} turnover references active session=${sourceSession.id} startedAt=${sourceSession.startedAt}`);
    if (sourceSession?.endedAt && Date.parse(task.createdAt) < Date.parse(sourceSession.endedAt)) errors.push(`${prefix} createdAt=${task.createdAt} before sessionEndedAt=${sourceSession.endedAt}`);
  }
  if (task.claimedAt && Date.parse(task.claimedAt) < Date.parse(task.createdAt)) errors.push(`${prefix} claimedAt=${task.claimedAt} before createdAt=${task.createdAt}`);
  if (task.startedAt && (!task.claimedAt || Date.parse(task.startedAt) < Date.parse(task.claimedAt))) errors.push(`${prefix} startedAt=${task.startedAt} before claimedAt=${task.claimedAt ?? "none"}`);
  if (task.completedAt && (!task.startedAt || Date.parse(task.completedAt) < Date.parse(task.startedAt))) errors.push(`${prefix} completedAt=${task.completedAt} before startedAt=${task.startedAt ?? "none"}`);
}

function verifyShot(universe: DemoUniverse, shot: DemoShot, errors: string[]): void {
  const prefix = `scenario=${universe.metadata.scenario} shot=${shot.id}`;
  const member = universe.members.find((item) => item.memberProfileId === shot.memberProfileId);
  const session = universe.sessions.find((item) => item.id === shot.sessionId);
  const bag = universe.bags.find((item) => item.memberProfileId === shot.memberProfileId && item.effectiveAt <= shot.occurredAt);
  if (!member) errors.push(`${prefix} missing memberProfile=${shot.memberProfileId}`);
  if (!session) errors.push(`${prefix} missing session=${shot.sessionId}`);
  if (session && (Date.parse(shot.occurredAt) < Date.parse(session.startedAt) || !session.endedAt || Date.parse(shot.occurredAt) > Date.parse(session.endedAt))) {
    errors.push(`${prefix} session=${session.id} occurredAt=${shot.occurredAt} outside session startedAt=${session.startedAt} endedAt=${session.endedAt ?? "active"}`);
  }
  if (!bag) errors.push(`${prefix} missing canonical bag memberProfile=${shot.memberProfileId} occurredAt=${shot.occurredAt}`);
  else if (!bag.clubs.some((club) => club.code === shot.clubCode)) errors.push(`${prefix} club=${shot.clubCode} absent from bag memberProfile=${shot.memberProfileId}`);
  if (shot.provenance.sourceProvider !== FAIRWAY_DEMO_PROVENANCE.sourceProvider) errors.push(`${prefix} invalid provenance=${shot.provenance.sourceProvider}`);
}

function verifyReservationSuiteState(universe: DemoUniverse, errors: string[]): void {
  const blocked = new Set(["turnover", "inspection_required", "maintenance", "administrative_hold"]);
  for (const reservation of universe.reservations.filter((item) => item.status === "confirmed" || item.status === "checked_in")) {
    const state = universe.facilityState.find((item) => item.suiteId === reservation.suiteId);
    if (state && blocked.has(state.status) && overlapsIso(reservation.startAt, reservation.endAt, universe.metadata.clock, addMinutes(universe.metadata.clock, LOCATION.minimumSessionMinutes))) {
      errors.push(`scenario=${universe.metadata.scenario} reservation=${reservation.id} suite=${reservation.suiteId} startAt=${reservation.startAt} endAt=${reservation.endAt} conflicts operationalState=${state.status}`);
    }
    if (reservation.status === "confirmed" && state?.status === "occupied" && overlapsIso(reservation.startAt, reservation.endAt, universe.metadata.clock, addMinutes(universe.metadata.clock, LOCATION.minimumSessionMinutes))) {
      errors.push(`scenario=${universe.metadata.scenario} reservation=${reservation.id} suite=${reservation.suiteId} confirmed reservation overlaps occupied suite`);
    }
  }
  for (const state of universe.facilityState.filter((item) => item.status === "occupied")) {
    const activeSession = universe.sessions.find((session) => session.suiteId === state.suiteId && !session.endedAt);
    if (!activeSession) errors.push(`scenario=${universe.metadata.scenario} suite=${state.suiteId} marked occupied without active session`);
    const activeTurnover = universe.facilityTasks.find((task) => task.suiteId === state.suiteId && task.taskType === "turnover" && task.status !== "completed");
    if (activeTurnover) errors.push(`scenario=${universe.metadata.scenario} suite=${state.suiteId} occupied with active turnover task=${activeTurnover.id}`);
  }
}

function verifyNoReservationOrSessionOverlaps(universe: DemoUniverse, errors: string[]): void {
  const activeReservations = universe.reservations.filter((item) => item.status === "confirmed" || item.status === "checked_in");
  for (let index = 0; index < activeReservations.length; index += 1) {
    for (let other = index + 1; other < activeReservations.length; other += 1) {
      const left = activeReservations[index];
      const right = activeReservations[other];
      if (left.suiteId === right.suiteId && overlapsIso(left.startAt, left.endAt, right.startAt, right.endAt)) {
        errors.push(`scenario=${universe.metadata.scenario} reservation overlap suite=${left.suiteId} left=${left.id} leftRange=${left.startAt}/${left.endAt} right=${right.id} rightRange=${right.startAt}/${right.endAt}`);
      }
    }
  }
  for (let index = 0; index < universe.sessions.length; index += 1) {
    for (let other = index + 1; other < universe.sessions.length; other += 1) {
      const left = universe.sessions[index];
      const right = universe.sessions[other];
      if (left.suiteId !== right.suiteId) continue;
      const leftEnd = left.endedAt ?? universe.reservations.find((item) => item.id === left.reservationId)?.endAt;
      const rightEnd = right.endedAt ?? universe.reservations.find((item) => item.id === right.reservationId)?.endAt;
      if (leftEnd && rightEnd && overlapsIso(left.startedAt, leftEnd, right.startedAt, rightEnd)) {
        errors.push(`scenario=${universe.metadata.scenario} session overlap suite=${left.suiteId} left=${left.id} leftRange=${left.startedAt}/${leftEnd} right=${right.id} rightRange=${right.startedAt}/${rightEnd}`);
      }
    }
  }
}

function verifyScenarioExpectation(universe: DemoUniverse, errors: string[]): void {
  const expected = universe.scenarioExpectation;
  if (expected.scenario !== universe.metadata.scenario) errors.push(`scenario=${universe.metadata.scenario} expectation scenario=${expected.scenario}`);
  const actualReady = actualReadyNowSuiteIds(universe);
  if (JSON.stringify(actualReady) !== JSON.stringify([...expected.readyNowSuiteIds].sort())) {
    errors.push(`scenario=${universe.metadata.scenario} ready-now mismatch expected=${expected.readyNowSuiteIds.join(",")} actual=${actualReady.join(",")} clock=${universe.metadata.clock}`);
  }
  if (actualReady.length !== expected.readyNowCount) errors.push(`scenario=${universe.metadata.scenario} ready-now count expected=${expected.readyNowCount} actual=${actualReady.length}`);
  const actualOccupied = universe.facilityState.filter((item) => item.status === "occupied").map((item) => item.suiteId).sort();
  if (JSON.stringify(actualOccupied) !== JSON.stringify([...expected.occupiedSuiteIds].sort())) errors.push(`scenario=${universe.metadata.scenario} occupied suites expected=${expected.occupiedSuiteIds.join(",")} actual=${actualOccupied.join(",")}`);
  if (universe.metadata.scenario === "low-inventory") {
    const tom = required(universe.ledgerAudits.find((item) => item.memberProfileId === required(universe.members.find((member) => member.id === "demo-tom"), "demo-tom").memberProfileId), "Tom ledger");
    if (tom.finalUnits <= 0) errors.push(`scenario=low-inventory inventory must be constraint but Demo Tom availableUnits=${tom.finalUnits}`);
    if (actualReady.length !== 2) errors.push(`scenario=low-inventory expected exactly two ready suites actual=${actualReady.length}`);
  }
  if (universe.metadata.scenario === "new-member") {
    const nora = required(universe.personaEvidence.find((item) => item.personaId === "new-golfer"), "Nora evidence");
    if (nora.completedSessions !== 0 || nora.shots !== 0 || nora.bagClubs !== 0) errors.push(`scenario=new-member Nora history must be empty sessions=${nora.completedSessions} shots=${nora.shots} bagClubs=${nora.bagClubs}`);
  }
}

function verifyAccessGrants(universe: DemoUniverse, errors: string[]): void {
  for (const grant of universe.accessGrants) {
    const expected = accessWindowStatus(grant.status, grant.startsAt, grant.expiresAt, universe.metadata.clock);
    if (grant.windowStatus !== expected) errors.push(`scenario=${universe.metadata.scenario} access=${grant.id} reservation=${grant.reservationId} startsAt=${grant.startsAt} expiresAt=${grant.expiresAt} clock=${universe.metadata.clock} expectedWindowStatus=${expected} actual=${grant.windowStatus}`);
    if (Date.parse(grant.createdAt) > Date.parse(universe.metadata.clock)) errors.push(`scenario=${universe.metadata.scenario} future createdAt access=${grant.id} createdAt=${grant.createdAt} clock=${universe.metadata.clock}`);
  }
}

function verifyLedger(universe: DemoUniverse, errors: string[]): void {
  for (const audit of universe.ledgerAudits) {
    if (audit.negativeRunningBalanceCount !== 0) errors.push(`scenario=${universe.metadata.scenario} ledger memberProfile=${audit.memberProfileId} negativeRunningBalanceCount=${audit.negativeRunningBalanceCount}`);
    if (audit.finalUnits !== audit.projectedAvailableUnits) errors.push(`scenario=${universe.metadata.scenario} ledger memberProfile=${audit.memberProfileId} finalUnits=${audit.finalUnits} projectedUnits=${audit.projectedAvailableUnits}`);
    if (!audit.idempotencyKeysUnique) errors.push(`scenario=${universe.metadata.scenario} ledger memberProfile=${audit.memberProfileId} duplicate idempotency key`);
  }
  for (const entry of universe.creditLedgerEntries) {
    if (Date.parse(entry.createdAt) > Date.parse(universe.metadata.clock)) errors.push(`scenario=${universe.metadata.scenario} future createdAt ledgerEntry=${entry.id} createdAt=${entry.createdAt} clock=${universe.metadata.clock}`);
    if (entry.entryType === "commit" && entry.reservationId) {
      const reservation = universe.reservations.find((item) => item.id === entry.reservationId);
      if (!reservation) errors.push(`scenario=${universe.metadata.scenario} ledger commit=${entry.id} missing reservation=${entry.reservationId}`);
      const priorFunding = universe.creditLedgerEntries
        .filter((item) => item.memberProfileId === entry.memberProfileId && item.createdAt <= entry.createdAt && item.balanceDeltaUnits > 0)
        .reduce((sumValue, item) => sumValue + item.balanceDeltaUnits, 0);
      if (priorFunding <= 0) errors.push(`scenario=${universe.metadata.scenario} ledger commit=${entry.id} reservation=${entry.reservationId} has no prior funding createdAt=${entry.createdAt}`);
    }
  }
}

function verifyPersonaEvidence(universe: DemoUniverse, errors: string[]): void {
  const evidence = new Map(universe.personaEvidence.map((item) => [item.personaId, item]));
  const requireAtLeast = (personaId: DemoPersonaId, field: "completedSessions" | "shots" | "historySpanDays", minimum: number) => {
    const item = required(evidence.get(personaId), personaId);
    if (item[field] < minimum) errors.push(`scenario=${universe.metadata.scenario} persona=${personaId} evidence ${field} expected>=${minimum} actual=${item[field]}`);
  };
  requireAtLeast("demo-tom", "completedSessions", 30);
  requireAtLeast("competitive-low", "completedSessions", 12);
  requireAtLeast("competitive-low", "shots", 120);
  requireAtLeast("competitive-low", "historySpanDays", 90);
  requireAtLeast("high-variance", "completedSessions", 10);
  requireAtLeast("high-variance", "shots", 100);
  requireAtLeast("bogey-grinder", "completedSessions", 12);
  requireAtLeast("bogey-grinder", "shots", 120);
  requireAtLeast("bogey-grinder", "historySpanDays", 120);
  requireAtLeast("time-compressed-pro", "completedSessions", 8);
  requireAtLeast("time-compressed-pro", "shots", 60);
  requireAtLeast("night-owl-social", "completedSessions", 12);
  requireAtLeast("night-owl-social", "shots", 90);
  const nora = required(evidence.get("new-golfer"), "new-golfer");
  if (nora.completedSessions || nora.shots || nora.bagClubs) errors.push(`scenario=${universe.metadata.scenario} persona=new-golfer expected zero history actual sessions=${nora.completedSessions} shots=${nora.shots} bag=${nora.bagClubs}`);
  const fran = required(evidence.get("facilities-fran"), "facilities-fran");
  if (fran.planCode || fran.availableCredits || fran.reservations || fran.completedSessions || fran.shots || fran.bagClubs) errors.push(`scenario=${universe.metadata.scenario} persona=facilities-fran unintended golfer data plan=${fran.planCode} credits=${fran.availableCredits} reservations=${fran.reservations} sessions=${fran.completedSessions} shots=${fran.shots} bag=${fran.bagClubs}`);
  const grant = required(evidence.get("night-owl-social"), "night-owl-social");
  if (!grant.guestStates.includes("pending") || !grant.guestStates.includes("ready")) errors.push(`scenario=${universe.metadata.scenario} persona=night-owl-social guest evidence expected=pending,ready actual=${grant.guestStates.join(",")}`);
}

function verifyTomCoherence(universe: DemoUniverse, errors: string[], warnings: string[]): void {
  const tom = required(universe.members.find((member) => member.id === "demo-tom"), "demo-tom");
  const profile = deriveDemoGolfProfile(universe, tom.memberProfileId);
  const audit = required(universe.ledgerAudits.find((item) => item.memberProfileId === tom.memberProfileId), "Tom ledger");
  const driver = profile.performance.find((item) => item.clubCode === "driver");
  const seven = profile.performance.find((item) => item.clubCode === "7i");
  const wedge = profile.performance.find((item) => item.clubCode === "pw");
  if (tom.displayName !== "Tom") errors.push(`scenario=${universe.metadata.scenario} Demo Tom displayName=${tom.displayName}`);
  if (tom.membershipPlanCode !== "TEST_BIRDIE") errors.push(`scenario=${universe.metadata.scenario} Demo Tom plan=${tom.membershipPlanCode}`);
  if (audit.finalUnits !== 96) errors.push(`scenario=${universe.metadata.scenario} Demo Tom credits expectedUnits=96 actual=${audit.finalUnits}`);
  if (profile.officialGolf.handicapIndex !== 8.4 || profile.officialGolf.status !== "simulated") errors.push(`scenario=${universe.metadata.scenario} Demo Tom handicap=${profile.officialGolf.handicapIndex} status=${profile.officialGolf.status}`);
  for (const [club, summary, expectedCarry, expectedSamples] of [
    ["driver", driver, 264, 43],
    ["7i", seven, 169, 36],
    ["pw", wedge, 132, 28],
  ] as const) {
    if (!summary || summary.typicalCarryYards !== expectedCarry || summary.sampleCount !== expectedSamples) errors.push(`scenario=${universe.metadata.scenario} Demo Tom ${club} expectedCarry=${expectedCarry} expectedSamples=${expectedSamples} actualCarry=${summary?.typicalCarryYards ?? "missing"} actualSamples=${summary?.sampleCount ?? "missing"}`);
  }
  if (driver?.dispersionYards !== 28) errors.push(`scenario=${universe.metadata.scenario} Demo Tom driver dispersion expected=28 actual=${driver?.dispersionYards ?? "missing"}`);
  if (universe.shots.filter((shot) => shot.memberProfileId === tom.memberProfileId).length < 250) warnings.push("Demo Tom shot count is near the lower bound; richer future slices may expand it.");
}

function summarizeClub(shots: DemoShot[], clubCode: "driver" | "7i" | "pw", member?: DemoMember): DemoGolfProfile["performance"][number] | null {
  const allClubShots = shots.filter((shot) => shot.clubCode === clubCode).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const clubShots = allClubShots.slice(-clubCodeTargetSamples(clubCode, member));
  if (clubShots.length < 12) return null;
  const ballSpeeds = clubShots.map((shot) => shot.ballSpeedMph).filter((value): value is number => value !== undefined);
  return {
    clubCode,
    clubName: clubName(clubCode),
    typicalCarryYards: Math.round(average(clubShots.map((shot) => shot.carryYards))),
    ballSpeedMph: ballSpeeds.length ? Math.round(average(ballSpeeds)) : undefined,
    dispersionYards: dispersionWidth(clubShots),
    sampleCount: clubShots.length,
    trend: derivedTrend(clubShots),
    provenance: `Fairway baseline - ${clubShots.length} demo swings`,
  };
}

function actualReadyNowSuiteIds(universe: DemoUniverse): string[] {
  const at = universe.metadata.clock;
  const minimumEnd = addMinutes(at, universe.locations[0].minimumSessionMinutes);
  return universe.facilityState
    .filter((state) => state.status === "available")
    .filter((state) => {
      const reservations = universe.reservations.filter((reservation) => reservation.suiteId === state.suiteId && (reservation.status === "confirmed" || reservation.status === "checked_in"));
      if (reservations.some((reservation) => overlapsIso(at, minimumEnd, reservation.startAt, reservation.endAt))) return false;
      const next = reservations.filter((reservation) => reservation.startAt > at).sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
      return !next || Date.parse(addMinutes(next.startAt, -universe.locations[0].turnoverBufferMinutes)) >= Date.parse(minimumEnd);
    })
    .map((state) => state.suiteId)
    .sort();
}

function suiteReadinessAtClock(universe: DemoUniverse, state: DemoSuiteState) {
  const now = universe.metadata.clock;
  const location = universe.locations[0];
  const activeReservations = universe.reservations
    .filter((reservation) => reservation.suiteId === state.suiteId && ["confirmed", "checked_in"].includes(reservation.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const activeSession = universe.sessions.find((session) => session.suiteId === state.suiteId && !session.endedAt);
  const activeTurnoverTask = universe.facilityTasks.find((task) => task.suiteId === state.suiteId && task.taskType === "turnover" && task.status !== "completed");
  const protectedFutureReservation = activeReservations.find((reservation) => reservation.startAt > now);

  let maxSafeDurationMinutes = 0;
  let safeToAssignNow = false;
  let reason = "No safe Play Now window.";
  if (state.status !== "available") {
    reason = `Operational state ${state.status} blocks assignment.`;
  } else if (activeSession || activeReservations.some((reservation) => overlapsIso(now, addMinutes(now, 1), reservation.startAt, reservation.endAt))) {
    reason = "Current occupancy blocks assignment.";
  } else {
    const rawMinutes = protectedFutureReservation
      ? minutesBetween(now, addMinutes(protectedFutureReservation.startAt, -location.turnoverBufferMinutes))
      : 120;
    maxSafeDurationMinutes = Math.max(0, Math.floor(rawMinutes / location.bookingIncrementMinutes) * location.bookingIncrementMinutes);
    safeToAssignNow = maxSafeDurationMinutes >= location.minimumSessionMinutes;
    reason = safeToAssignNow
      ? protectedFutureReservation
        ? `Safe until turnover begins before protected reservation ${protectedFutureReservation.id}.`
        : "Operationally ready with no near-term protected reservation."
      : "Protected reservation leaves less than the minimum safe session.";
  }

  return {
    suiteId: state.suiteId,
    operationalStatus: state.status,
    activeSessionId: activeSession?.id ?? null,
    activeTurnoverTaskId: activeTurnoverTask?.id ?? null,
    protectedFutureReservationId: protectedFutureReservation?.id ?? null,
    protectedFutureReservationStartAt: protectedFutureReservation?.startAt ?? null,
    maxSafeDurationMinutes,
    safeToAssignNow,
    reason,
  };
}

function longestContiguousBlock(values: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: string | undefined;
  for (const value of values) {
    current = value === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  }
  return longest;
}

function topFrequencyRows(values: Record<string, number>, limit: number) {
  return Object.entries(values)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function countShotsOutsideSessions(universe: DemoUniverse): number {
  return universe.shots.filter((shot) => {
    const session = universe.sessions.find((item) => item.id === shot.sessionId);
    return !session || !session.endedAt || Date.parse(shot.occurredAt) < Date.parse(session.startedAt) || Date.parse(shot.occurredAt) > Date.parse(session.endedAt);
  }).length;
}

function countShotsOutsideBags(universe: DemoUniverse): number {
  return universe.shots.filter((shot) => {
    const bag = universe.bags.find((item) => item.memberProfileId === shot.memberProfileId && item.effectiveAt <= shot.occurredAt);
    return !bag || !bag.clubs.some((club) => club.code === shot.clubCode);
  }).length;
}

function countReservationSuiteConflicts(universe: DemoUniverse): number {
  const errors: string[] = [];
  verifyReservationSuiteState(universe, errors);
  return errors.length;
}

function countOccupiedTurnoverConflicts(universe: DemoUniverse): number {
  return universe.facilityState.filter((state) => state.status === "occupied" && universe.facilityTasks.some((task) => task.suiteId === state.suiteId && task.taskType === "turnover" && task.status !== "completed")).length;
}

function countTaskChronologyConflicts(universe: DemoUniverse): number {
  const errors: string[] = [];
  for (const task of universe.facilityTasks) verifyFacilityTask(universe, task, errors);
  return errors.length;
}

function countFutureCreatedAt(universe: DemoUniverse): number {
  const clock = Date.parse(universe.metadata.clock);
  return [
    ...universe.members.map((item) => item.personCreatedAt),
    ...universe.members.map((item) => item.memberProfileCreatedAt),
    ...universe.memberships.map((item) => item.createdAt),
    ...universe.creditLedgerEntries.map((item) => item.createdAt),
    ...universe.reservations.map((item) => item.createdAt),
    ...universe.sessions.map((item) => item.createdAt),
    ...universe.accessGrants.map((item) => item.createdAt),
    ...universe.facilityTasks.map((item) => item.createdAt),
  ].filter((value) => Date.parse(value) > clock).length;
}

function countAccessWindowConflicts(universe: DemoUniverse): number {
  return universe.accessGrants.filter((grant) => grant.windowStatus !== accessWindowStatus(grant.status, grant.startsAt, grant.expiresAt, universe.metadata.clock)).length;
}

function reservationFor(input: {
  key: string;
  member: DemoMember;
  suiteNumber: number;
  status: DemoReservation["status"];
  mode: DemoReservation["bookingMode"];
  startAt: string;
  durationMinutes: number;
  creditUnits: number;
  createdAt: string;
}): DemoReservation {
  const id = stableUuid(`reservation:${input.key}`);
  return {
    id,
    locationId: DEMO_LOCATION_ID,
    suiteId: suiteId(input.suiteNumber),
    memberProfileId: input.member.memberProfileId,
    bookingMode: input.mode,
    status: input.status,
    startAt: input.startAt,
    endAt: addMinutes(input.startAt, input.durationMinutes),
    creditUnits: input.creditUnits,
    idempotencyKey: `du1:reservation:${input.key}`,
    createdAt: input.createdAt,
  };
}

function ledgerEntry(input: {
  member: DemoMember;
  key: string;
  entryType: DemoCreditLedgerEntry["entryType"];
  amountUnits: number;
  balanceDeltaUnits: number;
  relatedEntryId?: string;
  reservationId?: string;
  reason: string;
  createdAt: string;
}): DemoCreditLedgerEntry {
  return {
    id: stableUuid(`credit:${input.member.id}:${input.key}`),
    memberProfileId: input.member.memberProfileId,
    entryType: input.entryType,
    amountUnits: input.amountUnits,
    balanceDeltaUnits: input.balanceDeltaUnits,
    relatedEntryId: input.relatedEntryId,
    reservationId: input.reservationId,
    idempotencyKey: `du1:credit:${input.member.id}:${input.key}`,
    reason: input.reason,
    actorId: "du1",
    createdAt: input.createdAt,
  };
}

function historicalCreditUnits(memberId: DemoPersonaId, durationMinutes: number): number {
  const unitsPerHour = memberId === "night-owl-social" ? 8 : memberId === "demo-tom" || memberId === "bogey-grinder" || memberId === "time-compressed-pro" ? 8 : 12;
  return Math.round((unitsPerHour * durationMinutes) / 60);
}

function monthlyGrantDates(startedAt: string, clock: string): string[] {
  const result: string[] = [];
  let cursor = firstDayOfMonth(startedAt);
  const membershipStart = Date.parse(startedAt);
  while (Date.parse(cursor) <= Date.parse(clock)) {
    const effective = Date.parse(cursor) < membershipStart ? startedAt : cursor;
    if (!result.includes(effective)) result.push(effective);
    cursor = addMonths(cursor, 1);
  }
  return result;
}

function shotClubPattern(member: DemoMember): DemoClub["code"][] {
  if (member.id === "demo-tom") return ["driver", "7i", "pw", "driver", "7i", "5i", "driver", "pw", "7i", "sw"];
  if (member.id === "competitive-low") return ["driver", "3w", "7i", "pw", "sw", "driver", "4i"];
  if (member.id === "high-variance") return ["driver", "3w", "driver", "7i", "pw", "4i"];
  if (member.id === "bogey-grinder") return ["driver", "7i", "pw", "hybrid", "7i", "sw"];
  if (member.id === "time-compressed-pro") return ["driver", "7i", "pw", "7i", "sw"];
  if (member.id === "champions-member") return ["driver", "driver", "7i", "pw", "driver", "7i", "pw", "sw"];
  return ["driver", "7i", "pw", "hybrid", "sw"];
}

function countPlannedClubs(count: number, pattern: DemoClub["code"][]): Partial<Record<DemoClub["code"], number>> {
  const totals: Partial<Record<DemoClub["code"], number>> = {};
  for (let index = 0; index < count; index += 1) {
    const code = pattern[index % pattern.length];
    totals[code] = (totals[code] ?? 0) + 1;
  }
  return totals;
}

function shotMeasurement(member: DemoMember, clubCode: DemoClub["code"], ordinal: number, total: number) {
  const progress = total <= 1 ? 1 : ordinal / (total - 1);
  const base = baseClubMeasurement(member, clubCode);
  const improvement = member.id === "bogey-grinder" ? 8 * progress : member.id === "demo-tom" && clubCode === "7i" ? 2 * progress : member.id === "demo-tom" ? progress : 0;
  const variance = member.archetype === "high-variance" ? 12 : member.archetype === "improving-high-handicap" ? 8 : member.archetype === "competitive-low-handicap" ? 3 : 5;
  const carryWave = symmetricWave(ordinal, variance);
  const dispersionTarget = member.archetype === "competitive-low-handicap" ? 18 : member.archetype === "high-variance" ? 44 : member.archetype === "improving-high-handicap" ? Math.round(38 - 8 * progress) : member.id === "demo-tom" && clubCode === "driver" ? 28 : clubCode === "driver" ? 28 : clubCode === "7i" ? 18 : 12;
  const offlineYards = scaledOffline(ordinal, dispersionTarget);
  return {
    carryYards: Math.round(base.carry - (member.id === "demo-tom" ? 1 : member.id === "bogey-grinder" ? 8 : 0) + improvement + carryWave),
    ballSpeedMph: base.ballSpeed ? Math.round(base.ballSpeed + symmetricWave(ordinal + 3, member.archetype === "high-variance" ? 4 : 2)) : undefined,
    offlineYards,
  };
}

function baseClubMeasurement(member: DemoMember, clubCode: DemoClub["code"]): { carry: number; ballSpeed?: number } {
  const defaults: Record<DemoClub["code"], { carry: number; ballSpeed?: number }> = {
    driver: { carry: 258, ballSpeed: 161 },
    "3w": { carry: 235, ballSpeed: 151 },
    hybrid: { carry: 211, ballSpeed: 139 },
    "4i": { carry: 205, ballSpeed: 136 },
    "5i": { carry: 190, ballSpeed: 131 },
    "6i": { carry: 179, ballSpeed: 125 },
    "7i": { carry: 168, ballSpeed: 120 },
    "8i": { carry: 156, ballSpeed: 114 },
    "9i": { carry: 144, ballSpeed: 107 },
    pw: { carry: 131, ballSpeed: 98 },
    gw: { carry: 116, ballSpeed: 90 },
    sw: { carry: 96, ballSpeed: 80 },
    putter: { carry: 0 },
  };
  if (member.id === "demo-tom") {
    if (clubCode === "driver") return { carry: 264, ballSpeed: 163 };
    if (clubCode === "7i") return { carry: 168, ballSpeed: 121 };
    if (clubCode === "pw") return { carry: 132, ballSpeed: 96 };
  }
  if (member.id === "champions-member") {
    if (clubCode === "driver") return { carry: 281, ballSpeed: 171 };
    if (clubCode === "7i") return { carry: 181, ballSpeed: 128 };
    if (clubCode === "pw") return { carry: 141, ballSpeed: 101 };
  }
  if (member.archetype === "competitive-low-handicap") return { carry: defaults[clubCode].carry + 18, ballSpeed: defaults[clubCode].ballSpeed ? defaults[clubCode].ballSpeed + 8 : undefined };
  if (member.archetype === "high-variance") return { carry: defaults[clubCode].carry + 14, ballSpeed: defaults[clubCode].ballSpeed ? defaults[clubCode].ballSpeed + 7 : undefined };
  if (member.archetype === "improving-high-handicap") return { carry: defaults[clubCode].carry - 10, ballSpeed: defaults[clubCode].ballSpeed ? defaults[clubCode].ballSpeed - 5 : undefined };
  return defaults[clubCode];
}

function dispersionWidth(shots: DemoShot[]): number {
  const absolute = shots.map((shot) => Math.abs(shot.offlineYards)).sort((a, b) => a - b);
  return Math.round(2 * percentile(absolute, 0.8));
}

function derivedTrend(shots: DemoShot[]): "stable" | "building" | "improving" {
  if (shots.length < 20) return "building";
  const third = Math.max(1, Math.floor(shots.length / 3));
  const early = average(shots.slice(0, third).map((shot) => shot.carryYards));
  const recent = average(shots.slice(-third).map((shot) => shot.carryYards));
  return recent - early >= 2 ? "improving" : "stable";
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * percentileValue)));
  return values[index];
}

function scaledOffline(index: number, dispersionWidthYards: number): number {
  const pattern = [-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16];
  return Math.round((pattern[index % pattern.length] * dispersionWidthYards) / 28);
}

function symmetricWave(index: number, amplitude: number): number {
  const pattern = [-1, 0, 1, 0, 1, -1, 0];
  return pattern[index % pattern.length] * amplitude;
}

function officialGolfFor(member: DemoMember): DemoGolfProfile["officialGolf"] {
  if (member.id === "demo-tom") return { handicapIndex: 8.4, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
  if (member.archetype === "competitive-low-handicap") return { handicapIndex: 1.7, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
  if (member.archetype === "high-variance") return { handicapIndex: 5.6, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
  if (member.archetype === "improving-high-handicap") return { handicapIndex: 18.2, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
  if (member.archetype === "champions") return { handicapIndex: 3.1, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
  return { handicapIndex: 11.8, source: "Demo official handicap", status: "simulated", lastUpdated: "2026-07-20T14:00:00.000Z" };
}

function labelForArchetype(archetype: DemoMemberArchetype): string {
  if (archetype === "champions") return "Champions Member";
  if (archetype === "competitive-low-handicap") return "Competitive Golfer";
  if (archetype === "improving-high-handicap") return "Improving Golfer";
  if (archetype === "facilities") return "Facilities";
  return "Demo Golfer";
}

function activityTitle(session: DemoSession, index: number): string {
  const titles = ["Evening practice", "Baseline session", "Guest session", "Speed session", "Short-window tuneup"];
  return titles[(Number.parseInt(session.id.slice(-2), 16) + index) % titles.length];
}

function activityDetail(session: DemoSession, shots: DemoShot[]): string {
  const clubs = Array.from(new Set(shots.map((shot) => clubName(shot.clubCode)))).filter(Boolean).slice(0, 2);
  const minutes = minutesBetween(session.startedAt, session.endedAt ?? session.startedAt);
  return clubs.length ? `${clubs.join(" and ")} work over ${minutes} minutes` : `${minutes}-minute Fairway practice session`;
}

function clubCodeTargetSamples(clubCode: "driver" | "7i" | "pw", member?: DemoMember): number {
  if (member?.id === "champions-member") return clubCode === "driver" ? 118 : clubCode === "7i" ? 96 : 74;
  return clubCode === "driver" ? 43 : clubCode === "7i" ? 36 : 28;
}

function archetypeForIndex(index: number): DemoMemberArchetype {
  const archetypes: DemoMemberArchetype[] = ["committed-mid-handicap", "competitive-low-handicap", "improving-high-handicap", "new-golfer", "time-compressed-professional", "champions", "night-owl", "social-golfer", "high-variance"];
  return archetypes[index % archetypes.length];
}

function planForArchetype(archetype: DemoMemberArchetype): DemoMembershipPlan["code"] {
  if (archetype === "competitive-low-handicap" || archetype === "high-variance") return "TEST_TOUR";
  if (archetype === "champions") return "TEST_CHAMPIONS";
  if (archetype === "night-owl") return "TEST_NIGHT_OWL";
  return "TEST_BIRDIE";
}

function bagForArchetype(archetype: DemoMemberArchetype): DemoClub[] {
  const core = [
    club("driver", "Driver", "wood"),
    club("3w", "3 Wood", "wood"),
    club("hybrid", "Hybrid", "hybrid"),
    club("5i", "5 Iron", "iron"),
    club("6i", "6 Iron", "iron"),
    club("7i", "7 Iron", "iron"),
    club("8i", "8 Iron", "iron"),
    club("9i", "9 Iron", "iron"),
    club("pw", "PW", "wedge"),
    club("gw", "GW", "wedge"),
    club("sw", "SW", "wedge"),
    club("putter", "Putter", "putter"),
  ];
  if (archetype === "competitive-low-handicap" || archetype === "high-variance") return [core[0], core[1], club("4i", "4 Iron", "iron"), ...core.slice(3)];
  return core;
}

function club(code: DemoClub["code"], name: string, category: DemoClub["category"]): DemoClub {
  return { code, name, category };
}

function clubName(code: DemoClub["code"]): string {
  const names: Record<DemoClub["code"], string> = { driver: "Driver", "3w": "3 Wood", hybrid: "Hybrid", "4i": "4 Iron", "5i": "5 Iron", "6i": "6 Iron", "7i": "7 Iron", "8i": "8 Iron", "9i": "9 Iron", pw: "PW", gw: "GW", sw: "SW", putter: "Putter" };
  return names[code];
}

function setSuiteState(states: DemoSuiteState[], targetSuiteId: string, status: DemoSuiteState["status"], reason: string): void {
  const index = states.findIndex((item) => item.suiteId === targetSuiteId);
  if (index < 0) throw new Error(`Missing suite state ${targetSuiteId}`);
  states[index] = { suiteId: targetSuiteId, status, reason };
}

function accessWindowStatus(status: DemoAccessGrant["status"], startsAt: string, expiresAt: string, clock: string): DemoAccessGrant["windowStatus"] {
  if (status === "revoked") return "revoked";
  if (Date.parse(clock) < Date.parse(startsAt)) return "scheduled";
  if (status === "expired" || Date.parse(clock) >= Date.parse(expiresAt)) return "expired";
  return "active";
}

function suiteIds(): string[] {
  return Array.from({ length: LOCATION.suiteCount }, (_, index) => suiteId(index + 1));
}

function suiteId(suiteNumber: number): string {
  return `00000000-0000-0000-0000-${String(1000 + suiteNumber).padStart(12, "0")}`;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addDaysAtHour(base: string, days: number, hourUtc: number): string {
  const date = new Date(Date.parse(base) + days * 86_400_000);
  date.setUTCHours(((hourUtc % 24) + 24) % 24, 15, 0, 0);
  return date.toISOString();
}

function addMonths(value: string, months: number): string {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function firstDayOfMonth(value: string): string {
  const date = new Date(value);
  date.setUTCDate(1);
  date.setUTCHours(14, 0, 0, 0);
  return date.toISOString();
}

function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

function stableUuid(input: string): string {
  const hex = stableHex(`${FAIRWAY_DEMO_UNIVERSE_SEED}:${input}`, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stableHex(input: string, length: number): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let output = "";
  let next = input;
  while (output.length < length) {
    for (let index = 0; index < next.length; index += 1) {
      a ^= next.charCodeAt(index);
      a = Math.imul(a, 16777619) >>> 0;
      b = Math.imul(b ^ a, 2246822519) >>> 0;
    }
    output += (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
    next = `${next}:${output.length}`;
  }
  return output.slice(0, length);
}

function fingerprint(value: string): string {
  return stableHex(value, 16);
}

function canonicalize(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
  });
}

function countBy<TItem, TKey extends string>(items: readonly TItem[], getKey: (item: TItem) => TKey): Record<TKey, number> {
  return items.reduce<Record<TKey, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {} as Record<TKey, number>);
}

function verifyUnique<T>(items: T[], getKey: (item: T) => string, label: string, errors: string[], scenario: DemoScenarioKey): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) errors.push(`scenario=${scenario} duplicate ${label}=${key}`);
    seen.add(key);
  }
}

function sortByCreatedThenId(left: DemoReservation, right: DemoReservation): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function overlapsIso(startA: string, endA: string, startB: string, endB: string): boolean {
  return Date.parse(startA) < Date.parse(endB) && Date.parse(endA) > Date.parse(startB);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ledgerOrder(entryType: DemoCreditLedgerEntry["entryType"]): number {
  return { grant: 0, hold: 1, commit: 2, release: 3, refund: 4, expiration: 5, adjustment: 6 }[entryType];
}

function firstName(value: string): string {
  return value.split(" ")[0] ?? value;
}

function required<T>(value: T | undefined | null, label: string): T {
  if (value === undefined || value === null) throw new Error(`Missing demo universe value: ${label}`);
  return value;
}

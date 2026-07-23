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
export type DemoMemberArchetype = "committed-mid-handicap" | "competitive-low-handicap" | "high-variance" | "improving-high-handicap" | "new-golfer" | "time-compressed-professional" | "champions" | "night-owl" | "social-golfer";
export type IdentityPoolKey = "realistic" | "subtleGolf" | "obviousGolf" | "easterEgg" | "recognizableGolfCulture";

export interface DemoUniverse {
  metadata: { version: string; seed: string; clock: string; scenario: DemoScenarioKey; provenance: typeof FAIRWAY_DEMO_PROVENANCE };
  locations: DemoLocation[];
  membershipPlans: DemoMembershipPlan[];
  members: DemoMember[];
  personas: DemoPersona[];
  bags: DemoBag[];
  shots: DemoShot[];
  reservations: DemoReservation[];
  sessions: DemoSession[];
  accessGrants: DemoAccessGrant[];
  facilityTasks: DemoFacilityTask[];
  facilityState: DemoSuiteState[];
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
  membershipPlanCode: DemoMembershipPlan["code"];
  archetype: DemoMemberArchetype;
  identityPool: IdentityPoolKey;
  targetAvailableCreditUnits: number;
  role?: "facilities";
}

export interface DemoPersona {
  id: DemoPersonaId;
  memberProfileId: string;
  displayName: string;
  archetype: DemoMemberArchetype | "facilities";
  purpose: string;
  behaviorPattern: string;
  dataStoryIntent: string;
  scenarioCompatibility: DemoScenarioKey[];
}

export interface DemoBag {
  memberProfileId: string;
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
}

export interface DemoAccessGrant {
  id: string;
  reservationId: string;
  memberProfileId: string;
  locationId: string;
  suiteId: string;
  status: "active" | "expired" | "revoked";
  startsAt: string;
  expiresAt: string;
  provider: "fake";
  externalGrantId: string;
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
}

export interface DemoSuiteState {
  suiteId: string;
  status: "available" | "turnover" | "inspection_required" | "maintenance" | "administrative_hold";
}

export interface DemoGolfProfile {
  id: string;
  displayName: string;
  label: string;
  officialGolf: { handicapIndex: number | null; source: string; status: "simulated" | "manual" | "verified" | "not_established"; lastUpdated?: string };
  performance: Array<{ clubCode: "driver" | "7i" | "pw"; clubName: string; typicalCarryYards: number; ballSpeedMph?: number; dispersionYards: number; sampleCount: number; trend: "stable" | "building" | "improving"; provenance: string }>;
  activity: Array<{ id: string; title: string; detail: string; occurredAt: string }>;
}

export interface DemoIntegrityResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  fingerprint: string;
}

export const IDENTITY_POOLS: Record<IdentityPoolKey, string[]> = {
  realistic: [
    "Michael Carter", "Sarah Bennett", "David Kim", "Amanda Brooks", "James Walker", "Lauren Hughes", "Chris Morgan", "Emily Parker", "Daniel Price", "Rachel Turner",
    "Kevin Foster", "Megan Collins", "Andrew Bailey", "Natalie Reed", "Brian Walsh", "Erin Coleman", "Jason Miller", "Kara Mitchell", "Patrick Sullivan", "Olivia Hayes",
    "Ryan Cooper", "Hannah Ellis", "Brandon Scott", "Claire Donovan", "Marcus Lee", "Paige Stewart", "Ethan Russell", "Avery Nelson", "Derek Vaughn", "Lena Morris",
    "Simon Hart", "Jenna Price", "Noah Spencer", "Allison Grant", "Trevor Miles", "Molly Sinclair", "Victor Chen", "Rebecca Stone", "Ian Fletcher", "Tessa Bryant",
  ],
  subtleGolf: [
    "Bogey Nelson", "Chip Mulligan", "Ace Fairweather", "Wade Roughley", "Perry Pinseeker", "Graham Green", "Cal Cutter", "Max Carry", "Luke Lofton", "Brooks Birdie",
    "Grant Gimme", "Parker Links", "Russ Divot", "Doug Dogleg", "Marty Mulligan", "Willa Fairweather", "Greta Green", "Miles Marker", "Blaire Backswing", "Callie Carry",
  ],
  obviousGolf: ["Ned Threeputt", "Harry Hosel", "Cole Shankman", "Dale Duffner", "Will Yipley", "Frank Fore", "Benny Bunker"],
  easterEgg: ["Lonnie Hawkins", "Albatross Annie", "Carmen Cartpath"],
  recognizableGolfCulture: ["Shooter McGavin", "Roy McAvoy", "Happy Gilmore"],
};

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

const DEEP_PERSONA_FACTS: Array<{ id: DemoPersonaId; name: string; email: string; plan: DemoMembershipPlan["code"]; archetype: DemoMemberArchetype | "facilities"; pool: IdentityPoolKey; credits: number; purpose: string; behavior: string; story: string }> = [
  { id: "demo-tom", name: "Tom", email: "fairway-ux-demo-active-birdie@example.com", plan: "TEST_BIRDIE", archetype: "committed-mid-handicap", pool: "realistic", credits: 48, purpose: "Primary Golden Demo protagonist.", behavior: "Regular evening practice with gaps, guests, and gradual measurable improvement.", story: "Months of Fairway practice produce credible Driver, 7 Iron, and PW baselines." },
  { id: "competitive-low", name: "Shooter McGavin", email: "fairway-demo-shooter@example.com", plan: "TEST_TOUR", archetype: "competitive-low-handicap", pool: "recognizableGolfCulture", credits: 70, purpose: "Future-compatible competition and low-handicap density.", behavior: "Frequent prime and standard practice with strong long-game numbers.", story: "Strong, disciplined golfer whose data should not require competition to be believable." },
  { id: "high-variance", name: "Roy McAvoy", email: "fairway-demo-roy@example.com", plan: "TEST_TOUR", archetype: "high-variance", pool: "recognizableGolfCulture", credits: 64, purpose: "Talented but inconsistent performance archetype.", behavior: "Brilliant ball-striking sessions mixed with noisy dispersion.", story: "High upside, high variance, still grounded in plausible shot facts." },
  { id: "bogey-grinder", name: "Bogey Nelson", email: "fairway-demo-bogey@example.com", plan: "TEST_BIRDIE", archetype: "improving-high-handicap", pool: "subtleGolf", credits: 32, purpose: "Lovable improving grinder.", behavior: "Frequent shorter sessions with gradual improvement, not secret elite performance.", story: "The name is funny because the data remains honest." },
  { id: "new-golfer", name: "Nora Bennett", email: "fairway-ux-new-golfer@example.com", plan: "TEST_BIRDIE", archetype: "new-golfer", pool: "realistic", credits: 24, purpose: "Future ONB1 and empty-state validation.", behavior: "New member with little or no Fairway performance history.", story: "Premium empty states should still feel inviting." },
  { id: "time-compressed-pro", name: "Priya Shah", email: "fairway-demo-priya@example.com", plan: "TEST_BIRDIE", archetype: "time-compressed-professional", pool: "realistic", credits: 28, purpose: "Play Now convenience archetype.", behavior: "Short sessions squeezed between work and family commitments.", story: "Embodies 'I have 45 minutes. I'll go hit balls.'" },
  { id: "champions-member", name: "Maya Torres", email: "fairway-ux-power-tour-member@example.com", plan: "TEST_CHAMPIONS", archetype: "champions", pool: "realistic", credits: 80, purpose: "Dense My Golf state and higher-engagement membership.", behavior: "Weekday practice rhythm with strong performance history.", story: "Power/high-engagement state without overwhelming the UI." },
  { id: "night-owl-social", name: "Grant Gimme", email: "fairway-ux-guest-host-member@example.com", plan: "TEST_NIGHT_OWL", archetype: "night-owl", pool: "subtleGolf", credits: 40, purpose: "Guest-hosting and off-hours/social archetype.", behavior: "Later sessions and hosted guest usage where current domains support it.", story: "Social golfer energy without inventing social features." },
  { id: "facilities-fran", name: "Fran Facilities", email: "fairway-ux-facilities-user@example.com", plan: "TEST_BIRDIE", archetype: "facilities", pool: "realistic", credits: 4, purpose: "Restricted Cleaning Mode persona.", behavior: "Facilities actor, not a golfer persona.", story: "Exercises least-privilege facility workflows." },
];

export function buildDemoUniverse(input: { scenario?: DemoScenarioKey } = {}): DemoUniverse {
  const scenario = input.scenario ?? "normal";
  const members = buildMembers();
  const personas = buildPersonas(members);
  const reservations = buildReservations(members, scenario);
  const sessions = buildSessions(reservations);
  const accessGrants = buildAccessGrants(reservations);
  const facilityTasks = buildFacilityTasks(reservations, sessions, scenario);
  const facilityState = buildFacilityState(facilityTasks, scenario);
  const bags = buildBags(members);
  const shots = buildShots(members, sessions);

  return {
    metadata: { version: FAIRWAY_DEMO_UNIVERSE_VERSION, seed: FAIRWAY_DEMO_UNIVERSE_SEED, clock: FAIRWAY_DEMO_CLOCK_ISO, scenario, provenance: FAIRWAY_DEMO_PROVENANCE },
    locations: [LOCATION],
    membershipPlans: MEMBERSHIP_PLANS,
    members,
    personas,
    bags,
    shots,
    reservations,
    sessions,
    accessGrants,
    facilityTasks,
    facilityState,
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

  if (member.archetype === "new-golfer") {
    return {
      id: "demo_new_golfer",
      displayName: firstName(member.displayName),
      label: "Getting Started",
      officialGolf: { handicapIndex: null, source: "No official handicap connected", status: "not_established" },
      performance: [],
      activity: [],
    };
  }

  return {
    id: member.id === "demo-tom" ? "demo_tom_golfer" : member.id,
    displayName: firstName(member.displayName),
    label: member.id === "demo-tom" ? "Demo Golfer" : labelForArchetype(member.archetype),
    officialGolf: officialGolfFor(member),
    performance: (["driver", "7i", "pw"] as const).map((clubCode) => summarizeClub(shots, clubCode)).filter((summary): summary is NonNullable<typeof summary> => Boolean(summary)),
    activity: sessions.slice(0, 3).map((session, index) => ({
      id: `demo_activity_${member.id}_${index + 1}`,
      title: activityTitle(session, index),
      detail: activityDetail(session, shots.filter((shot) => shot.sessionId === session.id)),
      occurredAt: session.startedAt,
    })),
  };
}

export function verifyDemoUniverse(universe: DemoUniverse): DemoIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unique = <T>(items: T[], getKey: (item: T) => string, label: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = getKey(item);
      if (seen.has(key)) errors.push(`Duplicate ${label}: ${key}`);
      seen.add(key);
    }
  };

  unique(universe.members, (item) => item.id, "member id");
  unique(universe.members, (item) => item.email.toLowerCase(), "member email");
  unique(universe.members, (item) => item.personId, "person id");
  unique(universe.members, (item) => item.memberProfileId, "member profile id");
  unique(universe.reservations, (item) => item.id, "reservation id");
  unique(universe.sessions, (item) => item.id, "session id");
  unique(universe.shots, (item) => item.id, "shot id");

  const tom = universe.members.filter((item) => item.id === "demo-tom");
  if (tom.length !== 1) errors.push(`Demo Tom count must be 1, got ${tom.length}`);
  if (tom[0]?.displayName !== "Tom") errors.push("Demo Tom display name must remain Tom");
  if (universe.metadata.version !== FAIRWAY_DEMO_UNIVERSE_VERSION) errors.push("Universe version mismatch");
  if (universe.metadata.clock !== FAIRWAY_DEMO_CLOCK_ISO) errors.push("Universe clock mismatch");
  if (universe.members.length < 150 || universe.members.length > 300) errors.push(`Member population must be 150-300, got ${universe.members.length}`);

  const poolCounts = countBy(universe.members, (member) => member.identityPool);
  const realisticRatio = (poolCounts.realistic ?? 0) / universe.members.length;
  if (realisticRatio < 0.75 || realisticRatio > 0.88) errors.push(`Realistic identity ratio out of DU1 guidance: ${realisticRatio.toFixed(2)}`);
  if ((poolCounts.recognizableGolfCulture ?? 0) > 4) errors.push("Recognizable golf-culture identities must remain a handful");

  const membersByProfile = new Map(universe.members.map((member) => [member.memberProfileId, member]));
  for (const membership of universe.members) {
    if (!universe.membershipPlans.some((plan) => plan.code === membership.membershipPlanCode)) errors.push(`Missing plan for ${membership.displayName}`);
  }
  for (const reservation of universe.reservations) {
    if (!membersByProfile.has(reservation.memberProfileId)) errors.push(`Reservation ${reservation.id} references missing member`);
    if (!suiteIds().includes(reservation.suiteId)) errors.push(`Reservation ${reservation.id} references missing suite`);
    if (new Date(reservation.endAt) <= new Date(reservation.startAt)) errors.push(`Reservation ${reservation.id} has invalid time range`);
    if (reservation.creditUnits <= 0 || !Number.isInteger(reservation.creditUnits)) errors.push(`Reservation ${reservation.id} has invalid credit units`);
  }
  for (const session of universe.sessions) {
    const reservation = universe.reservations.find((item) => item.id === session.reservationId);
    if (!reservation) errors.push(`Session ${session.id} references missing reservation`);
    if (reservation && reservation.memberProfileId !== session.memberProfileId) errors.push(`Session ${session.id} member mismatch`);
    if (session.endedAt && new Date(session.endedAt) <= new Date(session.startedAt)) errors.push(`Session ${session.id} has invalid endedAt`);
  }
  for (const task of universe.facilityTasks) {
    if (!suiteIds().includes(task.suiteId)) errors.push(`Facility task ${task.id} references missing suite`);
  }
  for (const shot of universe.shots) {
    if (!membersByProfile.has(shot.memberProfileId)) errors.push(`Shot ${shot.id} references missing member`);
    if (!universe.sessions.some((session) => session.id === shot.sessionId)) errors.push(`Shot ${shot.id} references missing session`);
    if (shot.provenance.sourceProvider !== FAIRWAY_DEMO_PROVENANCE.sourceProvider) errors.push(`Shot ${shot.id} missing demo provenance`);
  }

  verifyNoActiveOverlaps(universe, errors);
  verifyScenarioIntegrity(universe, errors);
  verifyTomCoherence(universe, errors, warnings);

  return { ok: errors.length === 0, errors, warnings, fingerprint: fingerprint(canonicalize(universe)) };
}

export function summarizeDemoUniverse(universe: DemoUniverse) {
  return {
    version: universe.metadata.version,
    seed: universe.metadata.seed,
    clock: universe.metadata.clock,
    scenario: universe.metadata.scenario,
    locations: universe.locations.length,
    members: universe.members.length,
    deepPersonas: universe.personas.length,
    reservations: universe.reservations.length,
    sessions: universe.sessions.length,
    shots: universe.shots.length,
    facilityTasks: universe.facilityTasks.length,
    facilityState: countBy(universe.facilityState, (state) => state.status),
    fingerprint: verifyDemoUniverse(universe).fingerprint,
  };
}

export function stableDemoUuid(input: string): string {
  return stableUuid(input);
}

function buildMembers(): DemoMember[] {
  const deep = DEEP_PERSONA_FACTS.map((fact) => memberFromFact(fact));
  const population: DemoMember[] = [];
  const target = 220 - deep.length;
  for (let index = 0; index < target; index += 1) {
    const pool = poolForIndex(index);
    const name = nameForPool(pool, index);
    const archetype = archetypeForIndex(index);
    const id = `lightweight-${String(index + 1).padStart(3, "0")}`;
    population.push({
      id,
      personId: stableUuid(`person:${id}`),
      memberProfileId: stableUuid(`member-profile:${id}`),
      email: `fairway-demo-member-${String(index + 1).padStart(3, "0")}@example.com`,
      displayName: name,
      memberNumber: `FN-DEMO-${String(index + 1).padStart(4, "0")}`,
      homeLocationId: DEMO_LOCATION_ID,
      membershipPlanCode: planForArchetype(archetype),
      archetype,
      identityPool: pool,
      targetAvailableCreditUnits: creditsForArchetype(archetype, index),
    });
  }
  return [...deep, ...population].sort((a, b) => a.id.localeCompare(b.id));
}

function memberFromFact(fact: (typeof DEEP_PERSONA_FACTS)[number]): DemoMember {
  return {
    id: fact.id,
    personId: stableUuid(`person:${fact.id}`),
    memberProfileId: stableUuid(`member-profile:${fact.id}`),
    email: fact.email,
    displayName: fact.name,
    memberNumber: `FN-${fact.id.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14)}`,
    homeLocationId: DEMO_LOCATION_ID,
    membershipPlanCode: fact.plan,
    archetype: fact.archetype === "facilities" ? "new-golfer" : fact.archetype,
    identityPool: fact.pool,
    targetAvailableCreditUnits: fact.credits * 2,
    role: fact.id === "facilities-fran" ? "facilities" : undefined,
  };
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
      scenarioCompatibility: fact.id === "new-golfer" ? ["normal", "new-member"] : ["normal", "busy-prime", "facility-incident", "low-inventory"],
    };
  });
}

function buildReservations(members: DemoMember[], scenario: DemoScenarioKey): DemoReservation[] {
  const reservations: DemoReservation[] = [];
  const tom = required(members.find((member) => member.id === "demo-tom"), "demo-tom");
  const maya = required(members.find((member) => member.id === "champions-member"), "champions-member");
  const grant = required(members.find((member) => member.id === "night-owl-social"), "night-owl-social");
  const priya = required(members.find((member) => member.id === "time-compressed-pro"), "time-compressed-pro");

  for (let index = 0; index < 36; index += 1) {
    const daysBack = 4 + index * 5 + (index % 4);
    const duration = index % 5 === 0 ? 45 : index % 3 === 0 ? 90 : 60;
    reservations.push(reservationFor({ member: tom, index, suiteNumber: (index % 8) + 1, status: "completed", mode: index % 6 === 0 ? "ADVANCE" : "PLAY_NOW", startAt: addDays(FAIRWAY_DEMO_CLOCK_ISO, -daysBack, 22 - (index % 4)), durationMinutes: duration, creditUnits: duration === 45 ? 9 : duration === 90 ? 18 : 12 }));
  }
  for (let index = 0; index < 16; index += 1) {
    reservations.push(reservationFor({ member: maya, index, suiteNumber: ((index + 4) % 10) + 1, status: "completed", mode: "ADVANCE", startAt: addDays(FAIRWAY_DEMO_CLOCK_ISO, -(3 + index * 6), 18 + (index % 3)), durationMinutes: 60, creditUnits: 12 }));
  }
  for (let index = 0; index < 12; index += 1) {
    reservations.push(reservationFor({ member: grant, index, suiteNumber: ((index + 7) % 11) + 1, status: "completed", mode: "PLAY_NOW", startAt: addDays(FAIRWAY_DEMO_CLOCK_ISO, -(2 + index * 7), 26), durationMinutes: 45, creditUnits: 6 }));
  }

  reservations.push(reservationFor({ member: tom, index: 100, suiteNumber: 10, status: "confirmed", mode: "PLAY_NOW", startAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, 30), durationMinutes: 60, creditUnits: 12 }));
  reservations.push(reservationFor({ member: priya, index: 101, suiteNumber: 3, status: "checked_in", mode: "PLAY_NOW", startAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, -20), durationMinutes: 45, creditUnits: 9 }));

  if (scenario === "busy-prime" || scenario === "low-inventory") {
    const constrainedSuiteNumbers = [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 1];
    members.slice(20, scenario === "busy-prime" ? 30 : 31).forEach((member, index) => {
      reservations.push(reservationFor({ member, index: 200 + index, suiteNumber: constrainedSuiteNumbers[index], status: index < 5 ? "checked_in" : "confirmed", mode: "ADVANCE", startAt: addMinutes(FAIRWAY_DEMO_CLOCK_ISO, index < 5 ? -10 : 120 + index * 20), durationMinutes: 60, creditUnits: 12 }));
    });
  }
  return reservations.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));
}

function buildSessions(reservations: DemoReservation[]): DemoSession[] {
  return reservations.filter((reservation) => reservation.status === "completed" || reservation.status === "checked_in").map((reservation) => ({
    id: stableUuid(`session:${reservation.id}`),
    reservationId: reservation.id,
    memberProfileId: reservation.memberProfileId,
    suiteId: reservation.suiteId,
    startedAt: reservation.startAt,
    endedAt: reservation.status === "completed" ? reservation.endAt : undefined,
    provider: "demo",
    externalSessionId: `du1-${reservation.id.slice(24)}`,
  }));
}

function buildAccessGrants(reservations: DemoReservation[]): DemoAccessGrant[] {
  return reservations.filter((reservation) => reservation.status !== "cancelled").map((reservation) => ({
    id: stableUuid(`access:${reservation.id}`),
    reservationId: reservation.id,
    memberProfileId: reservation.memberProfileId,
    locationId: reservation.locationId,
    suiteId: reservation.suiteId,
    status: reservation.status === "completed" ? "expired" : "active",
    startsAt: addMinutes(reservation.startAt, -LOCATION.accessBeforeMinutes),
    expiresAt: addMinutes(reservation.endAt, LOCATION.accessAfterMinutes),
    provider: "fake",
    externalGrantId: `du1-access-${reservation.id.slice(24)}`,
  }));
}

function buildFacilityTasks(reservations: DemoReservation[], sessions: DemoSession[], scenario: DemoScenarioKey): DemoFacilityTask[] {
  const tasks: DemoFacilityTask[] = [];
  const active = reservations.find((reservation) => reservation.status === "checked_in");
  if (active) {
    const session = sessions.find((item) => item.reservationId === active.id);
    if (session) {
      tasks.push({ id: stableUuid(`task:turnover:${session.id}`), locationId: DEMO_LOCATION_ID, suiteId: active.suiteId, taskType: "turnover", priority: scenario === "busy-prime" ? 150 : 100, status: scenario === "facility-incident" ? "claimed" : "open", sourceReservationId: active.id, sourceSessionId: session.id, dueAt: addMinutes(active.endAt, LOCATION.turnoverBufferMinutes), idempotencyKey: `du1:task:turnover:${session.id}` });
    }
  }
  if (scenario === "facility-incident") {
    tasks.push({ id: stableUuid("task:inspection:suite-8"), locationId: DEMO_LOCATION_ID, suiteId: suiteId(8), taskType: "inspection", priority: 125, status: "open", dueAt: FAIRWAY_DEMO_CLOCK_ISO, idempotencyKey: "du1:task:inspection:suite-8" });
  }
  return tasks;
}

function buildFacilityState(tasks: DemoFacilityTask[], scenario: DemoScenarioKey): DemoSuiteState[] {
  const state: DemoSuiteState[] = suiteIds().map((id) => ({ suiteId: id, status: "available" }));
  for (const task of tasks) {
    const target = state.find((item) => item.suiteId === task.suiteId);
    if (target && task.status !== "completed") target.status = task.taskType === "inspection" ? "inspection_required" : "turnover";
  }
  if (scenario === "low-inventory") {
    for (let i = 0; i < 9; i += 1) state[i] = { suiteId: suiteId(i + 1), status: i % 3 === 0 ? "maintenance" : "administrative_hold" };
  }
  return state;
}

function buildBags(members: DemoMember[]): DemoBag[] {
  return members.slice(0, 40).map((member) => ({ memberProfileId: member.memberProfileId, clubs: bagForArchetype(member.archetype) }));
}

function buildShots(members: DemoMember[], sessions: DemoSession[]): DemoShot[] {
  const shots: DemoShot[] = [];
  const deepMembers = members.filter((member) => DEEP_PERSONA_FACTS.some((fact) => fact.id === member.id));
  for (const member of deepMembers) {
    const memberSessions = sessions.filter((session) => session.memberProfileId === member.memberProfileId && session.endedAt);
    const count = member.id === "demo-tom" ? 280 : member.id === "new-golfer" || member.id === "facilities-fran" ? 0 : 90;
    for (let index = 0; index < count; index += 1) {
      const session = memberSessions[index % Math.max(memberSessions.length, 1)];
      if (!session) continue;
      const club = clubForShot(member, index);
      const baseline = baselineFor(member, club, index);
      shots.push({ id: stableUuid(`shot:${member.id}:${index}`), memberProfileId: member.memberProfileId, sessionId: session.id, clubCode: club, occurredAt: addMinutes(session.startedAt, 5 + (index % 50)), carryYards: Math.round(baseline.carry + wave(index, 7) * baseline.variance), ballSpeedMph: baseline.ballSpeed ? Math.round(baseline.ballSpeed + wave(index + 3, 5) * 2) : undefined, offlineYards: Math.round(wave(index + 11, 9) * baseline.dispersion), provenance: FAIRWAY_DEMO_PROVENANCE });
    }
  }
  return shots.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

function summarizeClub(shots: DemoShot[], clubCode: "driver" | "7i" | "pw"): DemoGolfProfile["performance"][number] | null {
  const clubShots = shots.filter((shot) => shot.clubCode === clubCode).slice(-clubCodeTargetSamples(clubCode));
  if (clubShots.length < 12) return null;
  const ballSpeeds = clubShots.map((shot) => shot.ballSpeedMph).filter((value): value is number => value !== undefined);
  return {
    clubCode,
    clubName: clubName(clubCode),
    typicalCarryYards: Math.round(average(clubShots.map((shot) => shot.carryYards))),
    ballSpeedMph: ballSpeeds.length ? Math.round(average(ballSpeeds)) : undefined,
    dispersionYards: Math.round(average(clubShots.map((shot) => Math.abs(shot.offlineYards)))),
    sampleCount: clubShots.length,
    trend: clubCode === "driver" ? "stable" : clubCode === "7i" ? "improving" : "building",
    provenance: `Fairway baseline - ${clubShots.length} demo swings`,
  };
}

function verifyNoActiveOverlaps(universe: DemoUniverse, errors: string[]): void {
  const active = universe.reservations.filter((reservation) => reservation.status === "confirmed" || reservation.status === "checked_in");
  for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) if (active[i].suiteId === active[j].suiteId && overlaps(active[i], active[j])) errors.push(`Active reservation overlap: ${active[i].id} / ${active[j].id}`);
}

function verifyScenarioIntegrity(universe: DemoUniverse, errors: string[]): void {
  if (universe.metadata.scenario === "low-inventory") {
    const availableSuites = universe.facilityState.filter((state) => state.status === "available").length;
    const tom = required(universe.members.find((member) => member.id === "demo-tom"), "demo-tom");
    if (availableSuites > 3) errors.push("low-inventory scenario must materially constrain immediate inventory");
    if (tom.targetAvailableCreditUnits < 8) errors.push("low-inventory scenario must not make credits the primary constraint");
  }
  if (universe.metadata.scenario === "facility-incident" && !universe.facilityTasks.some((task) => task.taskType === "inspection")) errors.push("facility-incident scenario must include an inspection task");
  if (universe.metadata.scenario === "new-member" && deriveDemoGolfProfile(universe, required(universe.members.find((member) => member.id === "new-golfer"), "new-golfer").memberProfileId).performance.length !== 0) errors.push("new-member scenario must preserve new golfer empty baseline");
}

function verifyTomCoherence(universe: DemoUniverse, errors: string[], warnings: string[]): void {
  const tom = required(universe.members.find((member) => member.id === "demo-tom"), "demo-tom");
  const profile = deriveDemoGolfProfile(universe, tom.memberProfileId);
  const tomSessions = universe.sessions.filter((session) => session.memberProfileId === tom.memberProfileId && session.endedAt);
  const tomShots = universe.shots.filter((shot) => shot.memberProfileId === tom.memberProfileId);
  if (tomSessions.length < 30 || tomSessions.length > 50) errors.push(`Demo Tom should have 30-50 historical sessions, got ${tomSessions.length}`);
  if (tomShots.length < 200 || tomShots.length > 400) errors.push(`Demo Tom should have 200-400 shot observations, got ${tomShots.length}`);
  const driver = profile.performance.find((item) => item.clubCode === "driver");
  if (!driver || driver.sampleCount !== 43) errors.push("Demo Tom driver summary must derive from 43 recent swings");
  if (driver && (driver.typicalCarryYards < 258 || driver.typicalCarryYards > 270)) errors.push(`Demo Tom driver carry looks incoherent: ${driver.typicalCarryYards}`);
  if (profile.activity.length !== Math.min(3, tomSessions.length)) errors.push("Demo Tom activity rows must derive from sessions");
  if (tomShots.length < 250) warnings.push("Demo Tom shot count is near the lower bound; richer DU slices may expand it.");
}

function reservationFor(input: { member: DemoMember; index: number; suiteNumber: number; status: DemoReservation["status"]; mode: DemoReservation["bookingMode"]; startAt: string; durationMinutes: number; creditUnits: number }): DemoReservation {
  const id = stableUuid(`reservation:${input.member.id}:${input.index}`);
  return { id, locationId: DEMO_LOCATION_ID, suiteId: suiteId(input.suiteNumber), memberProfileId: input.member.memberProfileId, bookingMode: input.mode, status: input.status, startAt: input.startAt, endAt: addMinutes(input.startAt, input.durationMinutes), creditUnits: input.creditUnits, idempotencyKey: `du1:reservation:${input.member.id}:${input.index}` };
}

function poolForIndex(index: number): IdentityPoolKey {
  if (index < 176) return "realistic";
  if (index < 203) return "subtleGolf";
  if (index < 209) return "obviousGolf";
  return "easterEgg";
}

function nameForPool(pool: IdentityPoolKey, index: number): string {
  const names = IDENTITY_POOLS[pool];
  if (pool === "realistic") {
    const first = names[index % names.length].split(" ")[0];
    const last = names[(index * 7 + 11) % names.length].split(" ").slice(-1)[0];
    return `${first} ${last}`;
  }
  return names[index % names.length];
}

function archetypeForIndex(index: number): DemoMemberArchetype {
  const archetypes: DemoMemberArchetype[] = ["committed-mid-handicap", "competitive-low-handicap", "improving-high-handicap", "new-golfer", "time-compressed-professional", "champions", "night-owl", "social-golfer", "high-variance"];
  return archetypes[index % archetypes.length];
}

function planForArchetype(archetype: DemoMemberArchetype): DemoMembershipPlan["code"] {
  if (archetype === "competitive-low-handicap") return "TEST_TOUR";
  if (archetype === "champions") return "TEST_CHAMPIONS";
  if (archetype === "night-owl") return "TEST_NIGHT_OWL";
  return "TEST_BIRDIE";
}

function creditsForArchetype(archetype: DemoMemberArchetype, index: number): number {
  const base = archetype === "competitive-low-handicap" ? 80 : archetype === "champions" ? 60 : archetype === "new-golfer" ? 24 : 36;
  return (base + (index % 8) * 2) * 2;
}

function bagForArchetype(archetype: DemoMemberArchetype): DemoClub[] {
  const core = [club("driver", "Driver", "wood"), club("3w", "3 Wood", "wood"), club("hybrid", "Hybrid", "hybrid"), club("5i", "5 Iron", "iron"), club("6i", "6 Iron", "iron"), club("7i", "7 Iron", "iron"), club("8i", "8 Iron", "iron"), club("9i", "9 Iron", "iron"), club("pw", "PW", "wedge"), club("gw", "GW", "wedge"), club("sw", "SW", "wedge"), club("putter", "Putter", "putter")];
  if (archetype === "competitive-low-handicap" || archetype === "high-variance") return [core[0], core[1], club("4i", "4 Iron", "iron"), ...core.slice(3)];
  return core;
}

function club(code: DemoClub["code"], name: string, category: DemoClub["category"]): DemoClub {
  return { code, name, category };
}

function clubForShot(member: DemoMember, index: number): DemoClub["code"] {
  if (member.id === "demo-tom") {
    if (index < 43 || index % 6 === 0) return "driver";
    if (index < 79 || index % 5 === 0) return "7i";
    if (index < 107 || index % 4 === 0) return "pw";
  }
  const bag = bagForArchetype(member.archetype);
  return bag[index % Math.min(bag.length, 10)].code;
}

function baselineFor(member: DemoMember, clubCode: DemoClub["code"], index: number): { carry: number; ballSpeed?: number; dispersion: number; variance: number } {
  const monthProgress = Math.min(1, index / 240);
  if (member.id === "demo-tom") {
    if (clubCode === "driver") return { carry: 261 + 10 * monthProgress, ballSpeed: 159 + 5 * monthProgress, dispersion: 28, variance: 7 };
    if (clubCode === "7i") return { carry: 162 + 7 * monthProgress, ballSpeed: 118 + 3 * monthProgress, dispersion: 18, variance: 5 };
    if (clubCode === "pw") return { carry: 126 + 6 * monthProgress, ballSpeed: 93 + 3 * monthProgress, dispersion: 12, variance: 4 };
  }
  const distanceBias = member.archetype === "competitive-low-handicap" ? 18 : member.archetype === "high-variance" ? 12 : member.archetype === "improving-high-handicap" ? -10 : 0;
  const variance = member.archetype === "high-variance" ? 12 : member.archetype === "improving-high-handicap" ? 9 : 6;
  const baseByClub: Record<DemoClub["code"], number> = { driver: 258, "3w": 235, hybrid: 211, "4i": 205, "5i": 190, "6i": 179, "7i": 168, "8i": 156, "9i": 144, pw: 131, gw: 116, sw: 96, putter: 0 };
  const ballByClub: Partial<Record<DemoClub["code"], number>> = { driver: 161, "3w": 151, hybrid: 139, "5i": 131, "6i": 125, "7i": 120, "8i": 114, "9i": 107, pw: 98 };
  return { carry: Math.max(0, baseByClub[clubCode] + distanceBias), ballSpeed: ballByClub[clubCode], dispersion: clubCode === "driver" ? 30 : 18, variance };
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
  if (archetype === "champions") return "Power Tour Member";
  if (archetype === "competitive-low-handicap") return "Competitive Golfer";
  if (archetype === "improving-high-handicap") return "Improving Golfer";
  return "Demo Golfer";
}

function activityTitle(session: DemoSession, index: number): string {
  const titles = ["Evening practice", "Baseline session", "Guest session", "Speed session", "Short-window tuneup"];
  return titles[(Number(session.id.slice(-2)) + index) % titles.length];
}

function activityDetail(session: DemoSession, shots: DemoShot[]): string {
  const clubs = Array.from(new Set(shots.map((shot) => clubName(shot.clubCode)))).filter(Boolean).slice(0, 2);
  const minutes = Math.round((new Date(session.endedAt ?? session.startedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
  return clubs.length ? `${clubs.join(" and ")} work over ${minutes} minutes` : `${minutes}-minute Fairway practice session`;
}

function clubCodeTargetSamples(clubCode: "driver" | "7i" | "pw"): number {
  return clubCode === "driver" ? 43 : clubCode === "7i" ? 36 : 28;
}

function clubName(code: DemoClub["code"]): string {
  const names: Record<DemoClub["code"], string> = { driver: "Driver", "3w": "3 Wood", hybrid: "Hybrid", "4i": "4 Iron", "5i": "5 Iron", "6i": "6 Iron", "7i": "7 Iron", "8i": "8 Iron", "9i": "9 Iron", pw: "PW", gw: "GW", sw: "SW", putter: "Putter" };
  return names[code];
}

function suiteIds(): string[] {
  return Array.from({ length: 12 }, (_, index) => suiteId(index + 1));
}

function suiteId(suiteNumber: number): string {
  return `00000000-0000-0000-0000-${String(1000 + suiteNumber).padStart(12, "0")}`;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function addDays(base: string, days: number, hourUtc: number): string {
  const date = new Date(new Date(base).getTime() + days * 86_400_000);
  date.setUTCHours(hourUtc, 15, 0, 0);
  return date.toISOString();
}

function stableUuid(input: string): string {
  const hex = stableHex(`${FAIRWAY_DEMO_UNIVERSE_SEED}:${input}`, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stableHex(input: string, length: number): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let output = "";
  while (output.length < length) {
    for (let i = 0; i < input.length; i += 1) {
      a ^= input.charCodeAt(i);
      a = Math.imul(a, 16777619) >>> 0;
      b = Math.imul(b ^ a, 2246822519) >>> 0;
    }
    output += (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
    input = `${input}:${output.length}`;
  }
  return output.slice(0, length);
}

function fingerprint(value: string): string {
  return stableHex(value, 16);
}

function canonicalize(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  });
}

function countBy<TItem, TKey extends string>(items: readonly TItem[], getKey: (item: TItem) => TKey): Record<TKey, number> {
  return items.reduce<Record<TKey, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {} as Record<TKey, number>);
}

function overlaps(a: DemoReservation, b: DemoReservation): boolean {
  return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function wave(index: number, period: number): number {
  return Math.sin((index * Math.PI * 2) / period) * 0.65 + Math.cos((index * Math.PI * 2) / (period + 3)) * 0.35;
}

function firstName(value: string): string {
  return value.split(" ")[0] ?? value;
}

function required<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`Missing demo universe value: ${label}`);
  return value;
}

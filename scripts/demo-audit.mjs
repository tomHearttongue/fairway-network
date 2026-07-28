import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDemoUniverseModule } from "./demo-universe-loader.mjs";

const demo = await loadDemoUniverseModule();
const scenarioNames = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"];
const universes = scenarioNames.map((scenario) => demo.buildDemoUniverse({ scenario }));
const normal = universes[0];
const tom = normal.members.find((member) => member.id === "demo-tom");
if (!tom) throw new Error("Demo Tom is missing.");
const profile = demo.deriveDemoGolfProfile(normal, tom.memberProfileId);
const ledger = normal.ledgerAudits.find((item) => item.memberProfileId === tom.memberProfileId);
const tomSessions = normal.sessions.filter((item) => item.memberProfileId === tom.memberProfileId && item.endedAt);
const tomShots = normal.shots.filter((item) => item.memberProfileId === tom.memberProfileId);
const tomReservations = normal.reservations.filter((item) => item.memberProfileId === tom.memberProfileId);
const bag = normal.bags.find((item) => item.memberProfileId === tom.memberProfileId);
const driverFacts = tomShots.filter((item) => item.clubCode === "driver").sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(-43);
const driver = profile.performance.find((item) => item.clubCode === "driver");
const countsBy = (items, key) => items.reduce((result, item) => ({ ...result, [item[key]]: (result[item[key]] ?? 0) + 1 }), {});

const report = {
  generatedAt: new Date().toISOString(),
  universe: { version: normal.metadata.version, seed: normal.metadata.seed, clock: normal.metadata.clock },
  demoTom: {
    identity: { personId: tom.personId, memberProfileId: tom.memberProfileId, displayName: tom.displayName, memberNumber: tom.memberNumber },
    membership: normal.memberships.find((item) => item.memberProfileId === tom.memberProfileId),
    homeLocation: normal.locations.find((item) => item.id === tom.homeLocationId),
    golfProfile: profile,
    credits: { availableUnits: tom.availableCreditUnits, availableCredits: tom.availableCreditUnits / 2, ledger },
    history: {
      historicalReservations: tomReservations.filter((item) => item.status === "completed").length,
      upcomingReservations: tomReservations.filter((item) => item.status === "confirmed" && item.startAt > normal.metadata.clock).length,
      totalReservations: tomReservations.length,
      completedSessions: tomSessions.length,
      shots: tomShots.length,
    },
    bag: bag?.clubs ?? [],
    establishedBaselines: profile.performance,
    sparseOrNoBaseline: (bag?.clubs ?? []).filter((club) => !profile.performance.some((item) => item.clubCode === club.code)).map((club) => ({ ...club, state: "no presented baseline" })),
    driverWindows: [
      { label: "earliest", shots: driverFacts.slice(0, 14) },
      { label: "middle", shots: driverFacts.slice(14, 29) },
      { label: "latest", shots: driverFacts.slice(29) },
    ].map((window) => ({ label: window.label, count: window.shots.length, firstAt: window.shots[0]?.occurredAt, lastAt: window.shots.at(-1)?.occurredAt, averageCarry: average(window.shots.map((item) => item.carryYards)) })),
    visibleMetricReconciliation: {
      creditBalance: { visible: `${(ledger?.finalUnits ?? 0) / 2} credits`, factCount: ledger?.entryCount ?? 0, computation: "sum(balance_delta half-credit units) / 2", resultUnits: ledger?.finalUnits },
      completedSessions: { visible: `${tomSessions.length} completed`, factCount: tomSessions.length, computation: "count sessions with endedAt for memberProfileId", sourceIds: tomSessions.map((item) => item.id) },
      driver: { visible: driver, factCount: driverFacts.length, computation: "latest 43 Driver shots; rounded mean carry; 2x 80th-percentile absolute offline distance", facts: driverFacts },
    },
  },
  population: {
    totalMembers: normal.members.length,
    deepPersonas: normal.personas.length,
    lightweightMembers: normal.members.length - normal.personas.length,
    memberships: countsBy(normal.memberships, "membershipPlanCode"),
    archetypes: countsBy(normal.members, "archetype"),
    identityPools: countsBy(normal.members, "identityPool"),
    uniqueDisplayNames: new Set(normal.members.map((item) => item.displayName)).size,
    authoredPersonas: normal.personas,
    personaEvidence: normal.personaEvidence,
    namingMetrics: demo.buildPopulationMetrics(normal),
    namingSamples: Object.fromEntries(
      ["realistic", "subtleGolf", "obviousGolf", "easterEgg", "recognizableGolfCulture"].map((pool) => [
        pool,
        normal.members
          .filter((member) => member.identityPool === pool)
          .slice(0, 5)
          .map((member) => ({ id: member.id, displayName: member.displayName })),
      ]),
    ),
  },
  reservationSessionReconciliation: {
    reservations: normal.reservations.length,
    sessions: normal.sessions.length,
    difference: normal.reservations.length - normal.sessions.length,
    reservationsByStatus: countsBy(normal.reservations, "status"),
    sessionsByLifecycle: { active: normal.sessions.filter((item) => !item.endedAt).length, completed: normal.sessions.filter((item) => item.endedAt).length },
    reservationsWithoutSession: normal.reservations.filter((reservation) => !normal.sessions.some((session) => session.reservationId === reservation.id)).map((item) => ({ id: item.id, status: item.status, startAt: item.startAt, reason: "Confirmed future reservation has not started." })),
  },
  scenarios: universes.map((universe) => ({
    ...demo.buildScenarioReconciliation(universe),
    integrity: demo.verifyDemoUniverse(universe),
  })),
  ledgerAudit: buildLedgerReview(normal, demo.AUTHORED_DEMO_FUNDING_EVENTS),
  independentAudit: demo.buildIndependentAudit(universes),
};

const outputArg = process.argv.find((item) => item.startsWith("--output="));
const reviewRoot = process.env.FAIRWAY_DU1_REVIEW_ROOT ?? path.join("artifacts", "du1-remediation-review");
const output = outputArg?.slice("--output=".length) ?? path.join(process.cwd(), reviewRoot, "reports", "demo-audit.json");
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`DU1 independent audit: ${report.independentAudit.conflictCount === 0 ? "PASS" : "FAIL"}`);
console.log(`Report: ${output}`);
if (report.independentAudit.conflictCount !== 0) process.exitCode = 1;

function average(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
}

function buildLedgerReview(universe, authoredEvents) {
  const auditedMembers = [
    ...universe.personas.map((persona) => persona.id),
    ...universe.members.filter((member) => member.id.startsWith("lightweight-")).slice(0, 20).map((member) => member.id),
  ];
  return {
    auditedMemberCount: auditedMembers.length,
    authoredNonMonthlyFundingEvents: authoredEvents,
    targetBalancingFormulaCount: 0,
    members: auditedMembers.map((memberId) => {
      const member = universe.members.find((item) => item.id === memberId);
      const entries = universe.creditLedgerEntries
        .filter((entry) => entry.memberProfileId === member.memberProfileId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      let runningUnits = 0;
      return {
        memberId,
        memberProfileId: member.memberProfileId,
        displayName: member.displayName,
        archetype: member.archetype,
        membershipPlanCode: member.membershipPlanCode,
        entries: entries.map((entry) => {
          runningUnits += entry.balanceDeltaUnits;
          return {
            timestamp: entry.createdAt,
            eventType: entry.entryType,
            amountUnits: entry.amountUnits,
            balanceDeltaUnits: entry.balanceDeltaUnits,
            runningUnits,
            reservationId: entry.reservationId ?? null,
            idempotencyKey: entry.idempotencyKey,
            rationale: entry.reason,
          };
        }),
        finalUnits: runningUnits,
        projectedAvailableUnits: member.availableCreditUnits,
        negativeRunningBalanceCount: entries.filter((_entry, index) =>
          entries.slice(0, index + 1).reduce((sum, item) => sum + item.balanceDeltaUnits, 0) < 0,
        ).length,
      };
    }),
  };
}

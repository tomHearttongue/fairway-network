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
    credits: { targetUnits: tom.targetAvailableCreditUnits, targetCredits: tom.targetAvailableCreditUnits / 2, ledger },
    history: { reservations: normal.reservations.filter((item) => item.memberProfileId === tom.memberProfileId).length, completedSessions: tomSessions.length, shots: tomShots.length },
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
    namingSamples: Object.fromEntries(Object.entries(normal.identityPools).map(([pool, names]) => [pool, names.slice(0, 5)])),
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
  independentAudit: demo.buildIndependentAudit(universes),
};

const outputArg = process.argv.find((item) => item.startsWith("--output="));
const output = outputArg?.slice("--output=".length) ?? path.join(process.cwd(), "artifacts", "du1-remediation-review", "reports", "demo-audit.json");
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`DU1 independent audit: ${report.independentAudit.conflictCount === 0 ? "PASS" : "FAIL"}`);
console.log(`Report: ${output}`);
if (report.independentAudit.conflictCount !== 0) process.exitCode = 1;

function average(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
}

import { loadDemoUniverseModule } from "./demo-universe-loader.mjs";

const demo = await loadDemoUniverseModule();
const scenarios = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"];
const fingerprints = Object.fromEntries(scenarios.map((scenario) => {
  const universe = demo.buildDemoUniverse({ scenario });
  const integrity = demo.verifyDemoUniverse(universe);
  if (!integrity.ok) throw new Error(`Scenario ${scenario} is invalid: ${integrity.errors.join("; ")}`);
  return [scenario, integrity.fingerprint];
}));
process.stdout.write(`${JSON.stringify(fingerprints)}\n`);

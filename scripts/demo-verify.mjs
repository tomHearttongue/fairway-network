import { loadDemoUniverseModule, printSummary } from "./demo-universe-loader.mjs";

const scenarios = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"];
const demo = await loadDemoUniverseModule();

let failed = false;
for (const scenario of scenarios) {
  const universe = demo.buildDemoUniverse({ scenario });
  const repeat = demo.buildDemoUniverse({ scenario });
  const integrity = demo.verifyDemoUniverse(universe);
  const repeatIntegrity = demo.verifyDemoUniverse(repeat);
  const summary = demo.summarizeDemoUniverse(universe);
  printSummary(summary, integrity);
  if (integrity.fingerprint !== repeatIntegrity.fingerprint) {
    console.error(`Error: deterministic fingerprint changed for scenario ${scenario}`);
    failed = true;
  }
  if (!integrity.ok) failed = true;
  console.log("");
}

process.exit(failed ? 1 : 0);

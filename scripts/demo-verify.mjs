import { loadDemoUniverseModule, printSummary } from "./demo-universe-loader.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";

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

const childRuns = [runFingerprints(), runFingerprints()];
if (childRuns[0] !== childRuns[1]) {
  console.error("Error: deterministic fingerprints differ across independent Node processes.");
  failed = true;
} else {
  console.log("Cross-process fingerprints: PASS");
}

process.exit(failed ? 1 : 0);

function runFingerprints() {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "demo-fingerprints.mjs")], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Fingerprint process failed (${result.status}): ${result.stderr}`);
  return result.stdout.trim();
}

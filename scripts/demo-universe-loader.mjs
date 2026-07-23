import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadDemoUniverseModule() {
  const sourcePath = `${process.cwd()}\\src\\demo-universe\\universe.ts`;
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
    fileName: sourcePath,
  }).outputText;
  const encoded = Buffer.from(output, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

export function loadEnvFile(path = ".env.local") {
  const env = {};
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return env;
  }
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[line.slice(0, index).trim()] = value;
  }
  return env;
}

export function printSummary(summary, integrity) {
  console.log("Fairway Demo Universe");
  console.log(`Version: ${summary.version}`);
  console.log(`Scenario: ${summary.scenario}`);
  console.log(`Seed: ${summary.seed}`);
  console.log(`Clock: ${summary.clock}`);
  console.log(`Locations: ${summary.locations}`);
  console.log(`Members: ${summary.members}`);
  console.log(`Deep personas: ${summary.deepPersonas}`);
  console.log(`Reservations: ${summary.reservations}`);
  console.log(`Sessions: ${summary.sessions}`);
  console.log(`Shots: ${summary.shots}`);
  console.log(`Facility tasks: ${summary.facilityTasks}`);
  console.log(`Fingerprint: ${summary.fingerprint}`);
  console.log(`Integrity: ${integrity.ok ? "PASS" : "FAIL"}`);
  for (const warning of integrity.warnings) console.log(`Warning: ${warning}`);
  for (const error of integrity.errors) console.error(`Error: ${error}`);
}

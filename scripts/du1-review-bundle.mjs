import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const git = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe";
const root = path.join(repoRoot, "artifacts", "du1-remediation-review");
const staging = path.join(root, "bundle-staging");
const zipPath = path.join(root, "fairway-du1-remediation-review.zip");
const verifyRoot = path.join(root, "bundle-verify");
const expectedScenarios = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"];

assertCleanTrackedTree();
const commitSha = gitText(["rev-parse", "HEAD"]);
const branch = gitText(["branch", "--show-current"]);
const generatedAt = new Date().toISOString();
runNode("scripts/demo-verify.mjs", path.join(root, "reports", "demo-verify.txt"));
runNode("scripts/demo-audit.mjs", path.join(root, "reports", "demo-audit-command.txt"));
assertCleanTrackedTree();
if (gitText(["rev-parse", "HEAD"]) !== commitSha) throw new Error("HEAD changed while generating DU1 review evidence.");

const screenshots = readJson(path.join(root, "evidence", "screenshot-manifest.json"));
const accessibility = readJson(path.join(root, "evidence", "accessibility.json"));
const audit = readJson(path.join(root, "reports", "demo-audit.json"));
const qualityFiles = files(path.join(root, "evidence", "quality")).filter((file) => file.endsWith(".json"));
const quality = qualityFiles.map((file) => readJson(file));
validateEvidence(screenshots, accessibility, quality, audit);

rmSync(staging, { recursive: true, force: true });
rmSync(verifyRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(staging, { recursive: true });

copyGeneratedTree("screenshots");
copyGeneratedTree("evidence");
copyGeneratedTree("reports");
copyGeneratedTree("runtime");
copyGeneratedTree("playwright/report");
writeJson(path.join(staging, "evidence", "capture-provenance.json"), {
  commitSha,
  branch,
  sourceTreeStatus: "clean",
  generatedAt,
  universeVersion: audit.universe.version,
  seed: audit.universe.seed,
  clock: audit.universe.clock,
  scenarios: expectedScenarios,
});
const sourceSnapshot = writeSourceSnapshot(commitSha);
const summary = {
  screenshots: screenshots.length,
  accessibilityScreens: accessibility.length,
  axeViolations: accessibility.reduce((sum, item) => sum + item.violationCount, 0),
  consoleErrors: quality.reduce((sum, item) => sum + item.consoleErrors.length, 0),
  unexpectedNetworkFailures: quality.reduce((sum, item) => sum + item.unexpectedNetworkFailures.length, 0),
  expectedNavigationCancellations: quality.reduce((sum, item) => sum + item.expectedCancellations.length, 0),
  integrityConflicts: audit.independentAudit.conflictCount,
};
writeFileSync(path.join(staging, "00-README-FIRST.md"), readme({ commitSha, branch, generatedAt, audit, summary }));
writeJson(path.join(staging, "manifest.json"), {
  project: "Fairway Network",
  review: "DU1 Deterministic Demo Universe Acceptance Remediation",
  status: "PENDING HUMAN REVIEW",
  commitSha,
  branch,
  generatedAt,
  universe: audit.universe,
  sourceSnapshot,
  scenarios: audit.scenarios.map((item) => ({ scenario: item.universe.scenario, fingerprint: item.universe.fingerprint })),
  summary,
  screenshots: screenshots.map((item) => ({ file: item.file, screen: item.screen, scenario: item.scenario, persona: item.persona, viewport: item.viewport, sha256: item.sha256, resetExecutionId: item.resetExecutionId })),
});
writeFileSync(path.join(staging, "reports", "DEMO-TOM-REPORT.md"), demoTomMarkdown(audit));
writeFileSync(path.join(staging, "reports", "POPULATION-REPORT.md"), populationMarkdown(audit));
writeFileSync(path.join(staging, "reports", "SCENARIO-REPORT.md"), scenarioMarkdown(audit));
writeFileSync(path.join(staging, "reports", "RESERVATION-SESSION-RECONCILIATION.md"), lifecycleMarkdown(audit));
assertNoSecrets(staging);
writeFileManifest(staging);
verifyStaging(staging, commitSha);

execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${staging.replaceAll("'", "''")}\\*' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`], { stdio: "ignore" });
mkdirSync(verifyRoot, { recursive: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath.replaceAll("'", "''")}' -DestinationPath '${verifyRoot.replaceAll("'", "''")}' -Force`], { stdio: "ignore" });
assertNoSecrets(verifyRoot);
verifyStaging(verifyRoot, commitSha);
verifyFileManifest(verifyRoot);
const manifest = readJson(path.join(verifyRoot, "manifest.json"));
const readmeText = readFileSync(path.join(verifyRoot, "00-README-FIRST.md"), "utf8");
const provenance = readJson(path.join(verifyRoot, "evidence", "capture-provenance.json"));
if (new Set([manifest.commitSha, manifest.sourceSnapshot.commitSha, provenance.commitSha, readmeText.includes(commitSha) ? commitSha : "README_MISMATCH"]).size !== 1) {
  throw new Error("Embedded commit provenance is inconsistent after ZIP extraction.");
}
const result = {
  zipPath,
  sha256: sha256(readFileSync(zipPath)),
  bytes: statSync(zipPath).size,
  embeddedCommitSha: manifest.commitSha,
  sourceSnapshotCommitSha: manifest.sourceSnapshot.commitSha,
  verification: { requiredContent: "PASS", perFileHashes: "PASS", secretExclusion: "PASS", embeddedShaAgreement: "PASS", exactGitBlobSnapshot: "PASS" },
};
writeJson(path.join(root, "bundle-summary.json"), result);
rmSync(verifyRoot, { recursive: true, force: true });
console.log(JSON.stringify(result, null, 2));

function runNode(script, output) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script)], { cwd: repoRoot, env: process.env, encoding: "utf8", windowsHide: true });
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `command: ${process.execPath} ${script}\nstatus: ${result.status}\nlaunchError: ${result.error?.message ?? "none"}\n\nstdout:\n${result.stdout ?? ""}\n\nstderr:\n${result.stderr ?? ""}`);
  if (result.error || result.status !== 0) throw new Error(`${script} failed closed with status ${result.status}: ${result.error?.message ?? result.stderr}`);
}

function validateEvidence(screenshots, accessibility, quality, audit) {
  if (screenshots.length !== 13) throw new Error(`Expected 13 fresh screenshots, found ${screenshots.length}.`);
  for (const scenario of expectedScenarios) if (!screenshots.some((item) => item.scenario === scenario)) throw new Error(`Missing screenshot evidence for ${scenario}.`);
  const hashes = new Map();
  for (const item of screenshots) {
    const file = path.join(root, item.file);
    if (!existsSync(file)) throw new Error(`Missing screenshot ${item.file}.`);
    const actual = sha256(readFileSync(file));
    if (actual !== item.sha256) throw new Error(`Screenshot hash mismatch ${item.file}.`);
    if (hashes.has(actual)) throw new Error(`Duplicate screenshot evidence: ${item.file} and ${hashes.get(actual)}.`);
    hashes.set(actual, item.file);
    const receiptPath = item.reconciliationPath.startsWith("artifacts/")
      ? path.join(repoRoot, item.reconciliationPath)
      : path.join(root, item.reconciliationPath);
    const receipt = readJson(receiptPath);
    if (!receipt.reconciliation.ok || receipt.fingerprint !== item.universeFingerprint || receipt.resetExecutionId !== item.resetExecutionId) throw new Error(`Screenshot reconciliation mismatch ${item.file}.`);
  }
  if (accessibility.some((item) => item.violationCount !== 0)) throw new Error("Accessibility evidence contains violations.");
  if (quality.some((item) => item.consoleErrors.length || item.unexpectedNetworkFailures.length)) throw new Error("Browser quality evidence contains unexpected failures.");
  if (audit.independentAudit.conflictCount !== 0) throw new Error("Independent DU1 audit contains conflicts.");
}

function writeSourceSnapshot(commit) {
  const include = [/^src\/demo-universe\//, /^src\/application\/member-flow\//, /^src\/shared\/clock\.ts$/, /^scripts\/demo-/, /^scripts\/run-du1-/, /^scripts\/du1-/, /^tests\/domains\/demo-universe/, /^tests\/experience-du1\//, /^tests\/experience\/support\/personas\.ts$/, /^playwright\.du1\.config\.ts$/, /^package\.json$/, /^docs\/product\/DEMO-UNIVERSE\.md$/, /^docs\/product\/PRD\.md$/, /^docs\/product\/data\/DU1-/];
  const tracked = gitText(["ls-tree", "-r", "--name-only", commit]).split(/\r?\n/).filter(Boolean);
  let count = 0;
  for (const file of tracked) {
    if (!include.some((pattern) => pattern.test(file)) || forbiddenPath(file)) continue;
    const destination = path.join(staging, "source", file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, execFileSync(git, ["show", `${commit}:${file}`]));
    count += 1;
  }
  return { commitSha: commit, method: "git show <commit>:<path>", fileCount: count };
}

function copyGeneratedTree(relative) {
  const source = path.join(root, relative);
  if (!existsSync(source)) return;
  for (const file of files(source)) {
    if (forbiddenPath(file)) continue;
    const destination = path.join(staging, path.relative(root, file));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(file));
  }
}

function writeFileManifest(directory) {
  const entries = files(directory)
    .filter((file) => path.relative(directory, file).replaceAll("\\", "/") !== "file-manifest.json")
    .map((file) => ({ file: path.relative(directory, file).replaceAll("\\", "/"), bytes: statSync(file).size, sha256: sha256(readFileSync(file)) }))
    .sort((a, b) => a.file.localeCompare(b.file));
  writeJson(path.join(directory, "file-manifest.json"), { algorithm: "SHA-256", excludesSelf: true, files: entries });
}

function verifyFileManifest(directory) {
  const manifest = readJson(path.join(directory, "file-manifest.json"));
  for (const entry of manifest.files) {
    const file = path.join(directory, entry.file);
    if (!existsSync(file) || statSync(file).size !== entry.bytes || sha256(readFileSync(file)) !== entry.sha256) throw new Error(`Per-file manifest mismatch: ${entry.file}`);
  }
}

function verifyStaging(directory, expectedCommit) {
  const required = ["00-README-FIRST.md", "manifest.json", "file-manifest.json", "reports/DEMO-TOM-REPORT.md", "reports/POPULATION-REPORT.md", "reports/SCENARIO-REPORT.md", "reports/RESERVATION-SESSION-RECONCILIATION.md", "reports/demo-audit.json", "evidence/screenshot-manifest.json", "source/src/demo-universe/universe.ts"];
  for (const file of required) if (!existsSync(path.join(directory, file))) throw new Error(`Required bundle content missing: ${file}`);
  const manifest = readJson(path.join(directory, "manifest.json"));
  if (manifest.commitSha !== expectedCommit || manifest.sourceSnapshot.commitSha !== expectedCommit) throw new Error("Staged bundle SHA does not match expected HEAD.");
}

function assertNoSecrets(directory) {
  const forbidden = files(directory).filter(forbiddenPath);
  if (forbidden.length) throw new Error(`Forbidden paths in bundle: ${forbidden.join(", ")}`);
  for (const file of files(directory)) {
    if (!/\.(?:md|json|ts|tsx|js|mjs|txt|sql|yml|yaml)$/.test(file.toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    if (/sk_(?:test|live)_[A-Za-z0-9_-]+|whsec_[A-Za-z0-9_-]+|service_role["'\s:=]+eyJ|__clerk_db_jwt=(?!\[redacted\])[^&\s]+|\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/i.test(text)) throw new Error(`Potential secret in ${file}`);
  }
}

function assertCleanTrackedTree() {
  const dirty = gitText(["status", "--porcelain", "--untracked-files=no"]).split(/\r?\n/).filter(Boolean);
  if (dirty.length) throw new Error(`Cannot generate DU1 review bundle: tracked tree is dirty.\n${dirty.join("\n")}`);
}

function forbiddenPath(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  return /(^|\/)\.env(?:\.|$)/.test(normalized) || normalized.includes("storagestate") || normalized.includes("cookie") || normalized.endsWith("trace.zip") || normalized.includes("node_modules") || normalized.includes("/.next/") || normalized.includes("/.git/");
}

function files(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const item = path.join(current, name);
      if (statSync(item).isDirectory()) stack.push(item);
      else result.push(item);
    }
  }
  return result;
}

function gitText(args) {
  return execFileSync(git, args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readme({ commitSha, branch, generatedAt, audit, summary }) {
  return `# Fairway Network DU1 Review\n\nStatus: PENDING HUMAN REVIEW\nCommit: ${commitSha}\nBranch: ${branch}\nGenerated: ${generatedAt}\nUniverse: ${audit.universe.version}\nSeed: ${audit.universe.seed}\nCanonical clock: ${audit.universe.clock}\n\n## Review Objective\n\nEvaluate Demo Fidelity, Data Integrity, Scenario Coherence, Technical Reviewability, and Product Honesty for the remediated deterministic Demo Universe.\n\n## Start Here\n\n1. Read the four concise reports in \`reports/\`.\n2. Review \`evidence/screenshot-manifest.json\` and the 13 exact-world screenshots.\n3. Inspect \`reports/demo-audit.json\` for source facts and reconciliation.\n4. Inspect \`source/\` for exact Git-blob snapshots from the commit above.\n5. Verify any file against \`file-manifest.json\`.\n\n## Automated Result\n\n${JSON.stringify(summary, null, 2)}\n\nNo Product Acceptance decision is recorded by this bundle.\n`;
}

function demoTomMarkdown(audit) {
  const tom = audit.demoTom;
  return `# Demo Tom Reconciliation\n\n- Identity: ${tom.identity.displayName} / ${tom.identity.memberNumber}\n- Person ID: \`${tom.identity.personId}\`\n- MemberProfile ID: \`${tom.identity.memberProfileId}\`\n- Plan: ${tom.membership.membershipPlanCode}\n- Home: ${tom.homeLocation.name}\n- Credits: ${tom.credits.targetCredits} (${tom.credits.ledger.entryCount} ledger entries; ${tom.credits.ledger.finalUnits} half-credit units)\n- Historical reservations: ${tom.history.reservations}\n- Completed sessions: ${tom.history.completedSessions}\n- Shot facts: ${tom.history.shots}\n- Bag clubs: ${tom.bag.map((item) => item.name).join(", ")}\n\n## Visible Reconciliation\n\n- Credit balance -> sum of ${tom.visibleMetricReconciliation.creditBalance.factCount} append-only ledger facts -> ${tom.visibleMetricReconciliation.creditBalance.visible}.\n- Activity -> count ended canonical sessions -> ${tom.visibleMetricReconciliation.completedSessions.visible}.\n- Driver -> latest ${tom.visibleMetricReconciliation.driver.factCount} Driver facts -> ${tom.visibleMetricReconciliation.driver.visible.typicalCarryYards} yd carry, ${tom.visibleMetricReconciliation.driver.visible.dispersionYards} yd dispersion.\n\nExact source facts are in \`reports/demo-audit.json\`.\n`;
}

function populationMarkdown(audit) {
  const population = audit.population;
  return `# Demo Population\n\n- Total: ${population.totalMembers}\n- Deep personas: ${population.deepPersonas}\n- Lightweight members: ${population.lightweightMembers}\n- Unique display names: ${population.uniqueDisplayNames}\n\n## Authored Personas\n\n${population.authoredPersonas.map((item) => `- ${item.displayName} (\`${item.id}\`): ${item.purpose}`).join("\n")}\n\n## Naming Samples\n\n${Object.entries(population.namingSamples).map(([pool, names]) => `- ${pool}: ${names.length ? names.join(", ") : "none used in DU1-v1"}`).join("\n")}\n`;
}

function scenarioMarkdown(audit) {
  return `# Scenario Reconciliation\n\n${audit.scenarios.map((item) => `## ${item.universe.scenario}\n\n- Clock: ${item.universe.clock}\n- Fingerprint: \`${item.universe.fingerprint}\`\n- Primary persona: ${item.persona.displayName}\n- Credits: ${item.persona.availableCredits}\n- Ready-now suites: ${item.suiteAvailability.readyNowCount}\n- Active sessions: ${item.suiteAvailability.activeSessionIds.length}\n- Protected future reservations: ${item.suiteAvailability.futureReservationIds.length}\n- Facility tasks: ${item.facilityTasks.length}\n- Story: ${item.suiteAvailability.story}\n- Integrity: ${item.integrity.ok ? "PASS" : "FAIL"}\n`).join("\n")}`;
}

function lifecycleMarkdown(audit) {
  const item = audit.reservationSessionReconciliation;
  return `# Reservation / Session Reconciliation\n\n- Reservations: ${item.reservations}\n- Sessions: ${item.sessions}\n- Delta: ${item.difference}\n- Reservation statuses: ${JSON.stringify(item.reservationsByStatus)}\n- Session lifecycle: ${JSON.stringify(item.sessionsByLifecycle)}\n\nThe delta is intentional: ${item.reservationsWithoutSession.length} confirmed future reservations have not started and therefore have no Session. Their exact IDs and start times are in \`reports/demo-audit.json\`.\n`;
}

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const git = process.env.FAIRWAY_GIT_EXECUTABLE ?? "git";
const root = path.join(repoRoot, "artifacts", "du1-remediation-r2-review");
const staging = path.join(root, "bundle-staging");
const zipPath = path.join(root, "fairway-du1-remediation-r2-review.zip");
const verifyRoot = path.join(root, "bundle-verify");
const rejectedZip = path.join(repoRoot, "artifacts", "du1-remediation-review", "fairway-du1-remediation-review.zip");
const rejectedZipSha256 = "0bd29d54815a203948036f0eef9d3a122e28c584ef9bb177c7b2966c7f11610f";
const rejectedZipBytes = 1_060_877;
const scenarios = ["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"];

assertRejectedCandidateFrozen();
assertCleanTrackedTree();
const commitSha = gitText(["rev-parse", "HEAD"]);
const branch = gitText(["branch", "--show-current"]);
if (branch !== "du1/acceptance-remediation-r2") throw new Error(`Unexpected review branch: ${branch}`);
const generatedAt = new Date().toISOString();

const screenshots = readJson(path.join(root, "evidence", "screenshot-manifest.json"));
const accessibility = readJson(path.join(root, "evidence", "accessibility.json"));
const qualityPaths = files(path.join(root, "evidence", "quality")).filter((file) => file.endsWith(".json"));
const quality = qualityPaths.map(readJson);
const audit = readJson(path.join(root, "reports", "demo-audit.json"));
const verificationMatrix = readJson(path.join(root, "reports", "verification-matrix.json"));
const evidenceSummary = validateEvidence({ screenshots, accessibility, quality, audit, verificationMatrix, commitSha });

rmSync(staging, { recursive: true, force: true });
rmSync(verifyRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(staging, { recursive: true });

copyGeneratedTree("screenshots");
copyGeneratedTree("evidence");
copyGeneratedTree("runtime");
copyGeneratedTree("reports");
copyGeneratedTree("playwright/report");
copyGeneratedFile("playwright/results.json");

const sourceSnapshot = writeSourceSnapshot(commitSha);
writeJson(path.join(staging, "provenance.json"), {
  project: "Fairway Network",
  slice: "DU1 Acceptance Remediation Round 2",
  status: "PENDING HUMAN REVIEW",
  commitSha,
  branch,
  generatedAt,
  sourceSnapshot,
  universe: audit.universe,
  rejectedCandidate: {
    commitSha: "57eeff15784a61b167b2209828a94ee9739807b9",
    zipSha256: rejectedZipSha256,
    zipBytes: rejectedZipBytes,
    preserved: true,
  },
});

writeReportFiles(audit, evidenceSummary);
const manifest = {
  schemaVersion: "fairway-du1-r2-review-v1",
  project: "Fairway Network",
  review: "DU1 Acceptance Remediation Round 2",
  status: "PENDING HUMAN REVIEW",
  commitSha,
  branch,
  generatedAt,
  universe: audit.universe,
  sourceSnapshot,
  scenarios: audit.scenarios.map((item) => ({
    scenario: item.universe.scenario,
    fingerprint: item.universe.fingerprint,
  })),
  evidenceSummary,
  screenshots,
  verification: {
    status: verificationMatrix.status,
    gateCount: verificationMatrix.gateCount,
    gates: verificationMatrix.gates.map((gate) => ({
      id: gate.id,
      logicalCommand: gate.logicalCommand,
      status: gate.status,
      exitCode: gate.exitCode,
      transcriptPath: gate.transcriptPath,
      transcriptSha256: gate.transcriptSha256,
    })),
  },
};
writeFileSync(path.join(staging, "00-README-FIRST.md"), readme({ commitSha, branch, generatedAt, audit, evidenceSummary, sourceSnapshot }));
writeJson(path.join(staging, "manifest.json"), manifest);

assertNoSecretsOrLocalPaths(staging);
writeFileManifest(staging);
verifyStaging(staging, commitSha);
createPortableZip(staging, zipPath);
const zipEntries = listZipEntries(zipPath);
const zipPathResult = validateZipEntries(zipEntries);

mkdirSync(verifyRoot, { recursive: true });
extractZip(zipPath, verifyRoot);
const extracted = verifyExtractedPackage(verifyRoot, commitSha, zipEntries);
const zipBuffer = readFileSync(zipPath);
const result = {
  zipPath,
  sha256: sha256(zipBuffer),
  bytes: statSync(zipPath).size,
  embeddedCommitSha: extracted.manifest.commitSha,
  sourceSnapshotCommitSha: extracted.manifest.sourceSnapshot.commitSha,
  fileManifestCount: extracted.fileManifest.files.length,
  sourceBlobCount: extracted.manifest.sourceSnapshot.fileCount,
  forwardSlashViolationCount: zipPathResult.forwardSlashViolationCount,
  absoluteLocalPathFindingCount: extracted.absoluteLocalPathFindingCount,
  secretFindingCount: extracted.secretFindingCount,
  freshExtractionVerification: "PASS",
};
writeJson(path.join(root, "bundle-summary.json"), result);
rmSync(verifyRoot, { recursive: true, force: true });
assertRejectedCandidateFrozen();
assertCleanTrackedTree();
if (gitText(["rev-parse", "HEAD"]) !== commitSha) throw new Error("HEAD changed while generating the DU1 R2 review package.");
console.log(JSON.stringify(result, null, 2));

function validateEvidence(input) {
  if (input.screenshots.length !== 30) throw new Error(`Expected 30 fresh screenshots, found ${input.screenshots.length}.`);
  if (input.verificationMatrix.status !== "PASS" || input.verificationMatrix.gates.some((gate) => gate.status !== "PASS")) {
    throw new Error("Verification matrix is incomplete or failing.");
  }
  const screenshotHashes = new Map();
  const accessibilityIds = new Set(input.accessibility.map((item) => item.id));
  const qualityIds = new Set(input.quality.map((item) => item.id));
  let structuredAssertionCount = 0;
  let brokenReconciliationPathCount = 0;
  for (const scenario of scenarios) {
    if (!input.screenshots.some((item) => item.scenario === scenario)) throw new Error(`Missing screenshot evidence for ${scenario}.`);
  }
  for (const item of input.screenshots) {
    for (const field of [
      "file", "screen", "route", "persona", "personaDisplayName", "personaEmail", "scenario", "state",
      "viewport", "actualViewport", "screenshotPixels", "sha256", "bytes", "exactCommitSha",
      "universeVersion", "universeSeed", "universeFingerprint", "canonicalClockUtc",
      "canonicalClockLocal", "localTimezone", "resetExecutionId", "flowExecutionId",
      "reconciliationPath", "structuredAssertions", "qualityCaptureId", "accessibilityEvidenceId",
    ]) {
      if (item[field] === undefined || item[field] === null) throw new Error(`Screenshot ${item.file} lacks ${field}.`);
    }
    if (item.exactCommitSha !== input.commitSha) throw new Error(`Screenshot commit mismatch: ${item.file}`);
    const screenshotFile = path.join(root, item.file);
    if (!existsSync(screenshotFile)) throw new Error(`Screenshot file missing: ${item.file}`);
    if (sha256(readFileSync(screenshotFile)) !== item.sha256 || statSync(screenshotFile).size !== item.bytes) throw new Error(`Screenshot hash/size mismatch: ${item.file}`);
    if (screenshotHashes.has(item.sha256)) throw new Error(`Distinct screenshot states are byte-identical: ${item.file} and ${screenshotHashes.get(item.sha256)}`);
    screenshotHashes.set(item.sha256, item.file);
    const reconciliationFile = path.join(root, item.reconciliationPath);
    if (!existsSync(reconciliationFile)) {
      brokenReconciliationPathCount += 1;
      continue;
    }
    const reconciliation = readJson(reconciliationFile);
    if (
      reconciliation.commitSha !== input.commitSha
      || reconciliation.resetExecutionId !== item.resetExecutionId
      || reconciliation.flowExecutionId !== item.flowExecutionId
      || reconciliation.scenario !== item.scenario
      || reconciliation.fingerprint !== item.universeFingerprint
    ) throw new Error(`Screenshot reconciliation provenance mismatch: ${item.file}`);
    if (!Array.isArray(item.structuredAssertions) || item.structuredAssertions.length === 0) throw new Error(`Screenshot has no structured assertions: ${item.file}`);
    if (item.structuredAssertions.some((assertion) => assertion.passed !== true || !assertion.id || !assertion.sourcePath || !assertion.comparator)) {
      throw new Error(`Screenshot has a non-executed or malformed assertion: ${item.file}`);
    }
    if (JSON.stringify(reconciliation.executedAssertions) !== JSON.stringify(item.structuredAssertions)) throw new Error(`Screenshot assertion/reconciliation mismatch: ${item.file}`);
    structuredAssertionCount += item.structuredAssertions.length;
    if (!accessibilityIds.has(item.accessibilityEvidenceId)) throw new Error(`Screenshot lacks linked accessibility evidence: ${item.file}`);
    if (!qualityIds.has(item.qualityCaptureId)) throw new Error(`Screenshot lacks linked browser-quality evidence: ${item.file}`);
  }
  if (brokenReconciliationPathCount !== 0) throw new Error(`Broken reconciliation paths: ${brokenReconciliationPathCount}`);
  if (input.accessibility.some((item) => item.violationCount !== 0)) throw new Error("Accessibility evidence contains violations.");
  if (input.quality.some((item) => item.consoleErrors.length || item.unexpectedNetworkFailures.length)) throw new Error("Browser quality evidence contains unexpected failures.");
  if (input.audit.independentAudit.conflictCount !== 0) throw new Error("Independent DU1 audit contains conflicts.");
  const mobileSteps = input.screenshots.filter((item) => item.viewport === "mobile-primary" && Number.isInteger(item.step));
  if (mobileSteps.length !== 10 || mobileSteps.map((item) => item.step).sort((a, b) => a - b).join(",") !== "1,2,3,4,5,6,7,8,9,10") {
    throw new Error("Mobile Golden Demo does not contain exact steps 1-10.");
  }
  if (new Set(mobileSteps.map((item) => item.flowExecutionId)).size !== 1) throw new Error("Golden Demo steps do not share one flow execution ID.");
  if (new Set(mobileSteps.map((item) => item.resetExecutionId)).size !== 1) throw new Error("Golden Demo steps do not share one reset execution ID.");
  const requiredStates = [
    "no-mature-history", "coherent-high-demand", "inventory-not-credit-constrained",
    "inspection-and-turnover-affect-availability", "guest-waiver-pending",
    "guest-ready-allowance-reached", "guest-removed-add-capacity-restored",
    "inventory-available-credit-confirmation-blocked",
  ];
  for (const state of requiredStates) if (!input.screenshots.some((item) => item.state === state)) throw new Error(`Required state evidence missing: ${state}`);
  return {
    screenshots: input.screenshots.length,
    uniqueLogicalStates: new Set(input.screenshots.map((item) => `${item.viewport}:${item.scenario}:${item.persona}:${item.state}`)).size,
    structuredAssertionCount,
    brokenReconciliationPathCount,
    goldenFlowExecutionId: mobileSteps[0].flowExecutionId,
    goldenResetExecutionId: mobileSteps[0].resetExecutionId,
    accessibilityViolationCount: input.accessibility.reduce((sum, item) => sum + item.violationCount, 0),
    unexpectedConsoleErrorCount: input.quality.reduce((sum, item) => sum + item.consoleErrors.length, 0),
    unexpectedNetworkFailureCount: input.quality.reduce((sum, item) => sum + item.unexpectedNetworkFailures.length, 0),
    expectedNavigationCancellationCount: input.quality.reduce((sum, item) => sum + item.expectedCancellations.length, 0),
  };
}

function writeReportFiles(audit, evidenceSummary) {
  writeFileSync(path.join(staging, "reports", "DEMO-TOM-REPORT.md"), demoTomMarkdown(audit));
  writeFileSync(path.join(staging, "reports", "DEEP-PERSONA-REPORT.md"), deepPersonaMarkdown(audit));
  writeFileSync(path.join(staging, "reports", "POPULATION-NAMING-REPORT.md"), populationMarkdown(audit));
  writeFileSync(path.join(staging, "reports", "RESERVATION-SESSION-ACCESS-FACILITY-REPORT.md"), lifecycleMarkdown(audit));
  writeFileSync(path.join(staging, "reports", "SCENARIO-RECONCILIATION-REPORT.md"), scenarioMarkdown(audit));
  writeFileSync(path.join(staging, "reports", "LEDGER-CHRONOLOGY-REPORT.md"), ledgerMarkdown(audit));
  writeJson(path.join(staging, "evidence", "evidence-summary.json"), evidenceSummary);
}

function writeSourceSnapshot(commit) {
  const include = [
    /^src\/demo-universe\//,
    /^src\/domains\/sessions\//,
    /^src\/application\/member-flow\//,
    /^src\/shared\/clock\.ts$/,
    /^src-page\/(?:member|facilities)-experience\.tsx$/,
    /^app\/api\/member\/session\/start\/route\.ts$/,
    /^supabase\/migrations\/202607250001_session_start_authority\.sql$/,
    /^scripts\/(?:demo-|run-du1-|verify-du1-|du1-review-bundle)/,
    /^tests\/domains\/(?:demo-universe|du1-round2)/,
    /^tests\/experience-du1\//,
    /^tests\/experience\/support\/(?:personas|env)\.ts$/,
    /^playwright\.du1\.config\.ts$/,
    /^(?:package|tsconfig)\.json$/,
    /^docs\/product\/(?:DEMO-UNIVERSE|PRD)\.md$/,
    /^docs\/product\/data\/DU1-/,
  ];
  const tracked = gitText(["ls-tree", "-r", "--name-only", commit]).split(/\r?\n/).filter(Boolean);
  const snapshotFiles = [];
  for (const file of tracked) {
    if (!include.some((pattern) => pattern.test(file)) || forbiddenPath(file)) continue;
    const destination = path.join(staging, "source", file);
    mkdirSync(path.dirname(destination), { recursive: true });
    const content = execFileSync(git, ["show", `${commit}:${file}`], { cwd: repoRoot, windowsHide: true });
    writeFileSync(destination, content);
    snapshotFiles.push({ file, sha256: sha256(content), bytes: content.length });
  }
  writeJson(path.join(staging, "source", "SOURCE-SNAPSHOT.json"), {
    commitSha: commit,
    method: "exact Git blob via git show <commit>:<path>",
    fileCount: snapshotFiles.length,
    files: snapshotFiles,
  });
  return { commitSha: commit, method: "exact Git blob via git show", fileCount: snapshotFiles.length };
}

function copyGeneratedTree(relative) {
  const source = path.join(root, relative);
  if (!existsSync(source)) return;
  for (const file of files(source)) {
    if (forbiddenPath(file)) continue;
    const relativeFile = path.relative(root, file);
    const destination = path.join(staging, relativeFile);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(file));
  }
}

function copyGeneratedFile(relative) {
  const source = path.join(root, relative);
  if (!existsSync(source)) throw new Error(`Required generated file missing: ${relative}`);
  const destination = path.join(staging, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(source));
}

function writeFileManifest(directory) {
  const entries = files(directory)
    .filter((file) => normalize(path.relative(directory, file)) !== "file-manifest.json")
    .map((file) => ({ file: normalize(path.relative(directory, file)), bytes: statSync(file).size, sha256: sha256(readFileSync(file)) }))
    .sort((a, b) => a.file.localeCompare(b.file));
  writeJson(path.join(directory, "file-manifest.json"), { algorithm: "SHA-256", excludesSelf: true, files: entries });
}

function verifyStaging(directory, expectedCommit) {
  const required = [
    "00-README-FIRST.md", "manifest.json", "provenance.json", "file-manifest.json",
    "reports/DEMO-TOM-REPORT.md", "reports/DEEP-PERSONA-REPORT.md",
    "reports/POPULATION-NAMING-REPORT.md", "reports/RESERVATION-SESSION-ACCESS-FACILITY-REPORT.md",
    "reports/SCENARIO-RECONCILIATION-REPORT.md", "reports/LEDGER-CHRONOLOGY-REPORT.md",
    "reports/demo-audit.json", "reports/verification-matrix.json",
    "evidence/screenshot-manifest.json", "evidence/accessibility.json",
    "source/SOURCE-SNAPSHOT.json", "source/src/demo-universe/universe.ts",
    "source/src/domains/sessions/start-authorization.ts",
    "source/supabase/migrations/202607250001_session_start_authority.sql",
  ];
  for (const file of required) if (!existsSync(path.join(directory, file))) throw new Error(`Required package content missing: ${file}`);
  const manifest = readJson(path.join(directory, "manifest.json"));
  const provenance = readJson(path.join(directory, "provenance.json"));
  const source = readJson(path.join(directory, "source", "SOURCE-SNAPSHOT.json"));
  const readmeText = readFileSync(path.join(directory, "00-README-FIRST.md"), "utf8");
  if (manifest.commitSha !== expectedCommit || provenance.commitSha !== expectedCommit || source.commitSha !== expectedCommit || !readmeText.includes(expectedCommit)) {
    throw new Error("Package commit provenance is inconsistent.");
  }
}

function verifyExtractedPackage(directory, expectedCommit, zipEntries) {
  verifyStaging(directory, expectedCommit);
  verifyFileManifest(directory);
  const findings = scanDirectory(directory);
  if (findings.secrets.length) throw new Error(`Secret findings after extraction: ${findings.secrets.join(", ")}`);
  if (findings.absoluteLocalPaths.length) throw new Error(`Absolute local paths after extraction: ${findings.absoluteLocalPaths.join(", ")}`);
  const source = readJson(path.join(directory, "source", "SOURCE-SNAPSHOT.json"));
  for (const entry of source.files) {
    const extracted = readFileSync(path.join(directory, "source", entry.file));
    const gitBlob = execFileSync(git, ["show", `${expectedCommit}:${entry.file}`], { cwd: repoRoot, windowsHide: true });
    if (sha256(extracted) !== entry.sha256 || sha256(gitBlob) !== entry.sha256 || extracted.length !== entry.bytes) throw new Error(`Exact source blob mismatch: ${entry.file}`);
  }
  const actualFiles = files(directory).map((file) => normalize(path.relative(directory, file))).sort();
  const expectedFiles = zipEntries.filter((entry) => !entry.endsWith("/")).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error("Fresh extraction file set differs from ZIP entries.");
  return {
    manifest: readJson(path.join(directory, "manifest.json")),
    fileManifest: readJson(path.join(directory, "file-manifest.json")),
    secretFindingCount: findings.secrets.length,
    absoluteLocalPathFindingCount: findings.absoluteLocalPaths.length,
  };
}

function verifyFileManifest(directory) {
  const manifest = readJson(path.join(directory, "file-manifest.json"));
  for (const entry of manifest.files) {
    const file = path.join(directory, entry.file);
    if (!existsSync(file) || statSync(file).size !== entry.bytes || sha256(readFileSync(file)) !== entry.sha256) {
      throw new Error(`Per-file manifest mismatch: ${entry.file}`);
    }
  }
}

function createPortableZip(source, destination) {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$source='${escapePs(source)}'`,
    `$destination='${escapePs(destination)}'`,
    "$archive=[System.IO.Compression.ZipFile]::Open($destination,[System.IO.Compression.ZipArchiveMode]::Create)",
    "try {",
    "  Get-ChildItem -LiteralPath $source -Recurse -File | Sort-Object FullName | ForEach-Object {",
    "    $entry=$_.FullName.Substring($source.Length).TrimStart([char]92,[char]47).Replace([char]92,[char]47)",
    "    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$_.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null",
    "  }",
    "} finally { $archive.Dispose() }",
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
}

function listZipEntries(file) {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$archive=[System.IO.Compression.ZipFile]::OpenRead('${escapePs(file)}')`,
    "try { @($archive.Entries | ForEach-Object { $_.FullName }) | ConvertTo-Json -Compress } finally { $archive.Dispose() }",
  ].join("; ");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { cwd: repoRoot, encoding: "utf8", windowsHide: true }).trim();
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function validateZipEntries(entries) {
  const normalized = new Set();
  let forwardSlashViolationCount = 0;
  for (const entry of entries) {
    if (entry.includes("\\")) forwardSlashViolationCount += 1;
    if (!entry || entry.startsWith("/") || /^[A-Za-z]:/.test(entry) || entry.split("/").includes("..")) throw new Error(`Unsafe ZIP entry: ${entry}`);
    const key = entry.replaceAll("\\", "/").toLowerCase();
    if (normalized.has(key)) throw new Error(`Duplicate normalized ZIP entry: ${entry}`);
    normalized.add(key);
  }
  if (forwardSlashViolationCount) throw new Error(`ZIP contains ${forwardSlashViolationCount} backslash entry names.`);
  return { forwardSlashViolationCount };
}

function extractZip(file, destination) {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `[System.IO.Compression.ZipFile]::ExtractToDirectory('${escapePs(file)}','${escapePs(destination)}')`,
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
}

function assertNoSecretsOrLocalPaths(directory) {
  const findings = scanDirectory(directory);
  if (findings.secrets.length) throw new Error(`Potential secrets in package staging: ${findings.secrets.join(", ")}`);
  if (findings.absoluteLocalPaths.length) throw new Error(`Source-machine absolute paths in package staging: ${findings.absoluteLocalPaths.join(", ")}`);
}

function scanDirectory(directory) {
  const secrets = [];
  const absoluteLocalPaths = [];
  for (const file of files(directory)) {
    const relative = normalize(path.relative(directory, file));
    if (forbiddenPath(relative)) secrets.push(relative);
    if (!/\.(?:md|json|ts|tsx|js|mjs|txt|sql|yml|yaml|html|css)$/.test(file.toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    if (/sk_(?:test|live)_[A-Za-z0-9_-]+|pk_(?:test|live)_[A-Za-z0-9_-]+|whsec_[A-Za-z0-9_-]+|service_role["'\s:=]+eyJ|__clerk_db_jwt=(?!\[redacted\])[^&\s]+|\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/i.test(text)) secrets.push(relative);
    if (/[A-Za-z]:[\\/](?:Users|Documents|Program Files)[\\/]/i.test(text)) absoluteLocalPaths.push(relative);
  }
  return { secrets: [...new Set(secrets)], absoluteLocalPaths: [...new Set(absoluteLocalPaths)] };
}

function assertRejectedCandidateFrozen() {
  if (!existsSync(rejectedZip)) throw new Error("Rejected candidate ZIP is missing; it must remain frozen.");
  if (statSync(rejectedZip).size !== rejectedZipBytes || sha256(readFileSync(rejectedZip)) !== rejectedZipSha256) {
    throw new Error("Rejected candidate ZIP changed.");
  }
}

function assertCleanTrackedTree() {
  const dirty = gitText(["status", "--porcelain", "--untracked-files=no"]).split(/\r?\n/).filter(Boolean);
  if (dirty.length) throw new Error(`Cannot generate DU1 R2 Product Acceptance package: tracked tree is dirty.\n${dirty.join("\n")}`);
}

function forbiddenPath(file) {
  const normalized = normalize(file).toLowerCase();
  return /(^|\/)\.env(?:\.|$)/.test(normalized)
    || normalized.includes("storagestate")
    || normalized.includes("cookie")
    || normalized.endsWith("trace.zip")
    || normalized.includes("node_modules")
    || normalized.includes("/.next/")
    || normalized.includes("/.git/");
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

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function gitText(args) {
  return execFileSync(git, args, { cwd: repoRoot, encoding: "utf8", windowsHide: true }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function escapePs(value) {
  return String(value).replaceAll("'", "''");
}

function readme({ commitSha, branch, generatedAt, audit, evidenceSummary, sourceSnapshot }) {
  return `# Fairway Network DU1 Acceptance Remediation Round 2

Status: PENDING HUMAN REVIEW
Commit: ${commitSha}
Branch: ${branch}
Generated: ${generatedAt}
Universe: ${audit.universe.version}
Seed: ${audit.universe.seed}
Canonical clock: ${audit.universe.clock}
Source snapshot: ${sourceSnapshot.method} (${sourceSnapshot.fileCount} files)

## Review Objective

Evaluate Demo Fidelity, Data Integrity, Scenario Coherence, Technical Reviewability, Product Honesty, and the complete persisted Golden Demo.

## Start Here

1. Read the concise reports in \`reports/\`.
2. Review the exact-world screenshots and \`evidence/screenshot-manifest.json\`.
3. Follow each screenshot's \`reconciliationPath\` into \`runtime/\`.
4. Inspect \`reports/verification-matrix.json\` and its sanitized transcripts.
5. Inspect \`source/\` for exact committed Git blobs.
6. Verify any packaged file against \`file-manifest.json\`.

## Evidence Result

\`\`\`json
${JSON.stringify(evidenceSummary, null, 2)}
\`\`\`

This package records no Product Acceptance decision.
`;
}

function demoTomMarkdown(audit) {
  const tom = audit.demoTom;
  return `# Demo Tom Reconciliation

- Identity: ${tom.identity.displayName} / ${tom.identity.memberNumber}
- Person ID: \`${tom.identity.personId}\`
- MemberProfile ID: \`${tom.identity.memberProfileId}\`
- Plan: ${tom.membership.membershipPlanCode}
- Home: ${tom.homeLocation.name}
- Credits: ${tom.credits.availableCredits} (${tom.credits.ledger.entryCount} ledger entries; ${tom.credits.ledger.finalUnits} half-credit units)
- Historical reservations: ${tom.history.historicalReservations}
- Upcoming reservations: ${tom.history.upcomingReservations}
- Total canonical reservations: ${tom.history.totalReservations}
- Completed sessions: ${tom.history.completedSessions}
- Shot facts: ${tom.history.shots}
- Bag: ${tom.bag.map((item) => item.name).join(", ")}

## Visible Reconciliation

- Credit balance -> sum of ${tom.visibleMetricReconciliation.creditBalance.factCount} append-only ledger facts -> ${tom.visibleMetricReconciliation.creditBalance.visible}.
- Activity -> count ended canonical sessions -> ${tom.visibleMetricReconciliation.completedSessions.visible}.
- Driver -> latest ${tom.visibleMetricReconciliation.driver.factCount} canonical Driver shots -> ${tom.visibleMetricReconciliation.driver.visible.typicalCarryYards} yd carry and ${tom.visibleMetricReconciliation.driver.visible.dispersionYards} yd dispersion.

Exact source facts and Driver windows are in \`reports/demo-audit.json\`.
`;
}

function deepPersonaMarkdown(audit) {
  return `# Deep Persona Evidence

${audit.population.authoredPersonas.map((persona) => {
    const evidence = audit.population.personaEvidence.find((item) => item.personaId === persona.id);
    return `## ${persona.displayName}

- ID: \`${persona.id}\`
- Purpose: ${persona.purpose}
- Behavior: ${persona.behaviorPattern}
- Data story: ${persona.dataStoryIntent}
- Plan: ${evidence.planCode ?? "Facilities-only"}
- Credits: ${evidence.availableCredits}
- Reservations: ${evidence.reservations}
- Completed sessions: ${evidence.completedSessions}
- Shots: ${evidence.shots}
`;
  }).join("\n")}
`;
}

function populationMarkdown(audit) {
  const metrics = audit.population.namingMetrics;
  return `# Population and Naming

- Total members: ${metrics.totalMembers}
- Deep personas: ${metrics.deepPersonas}
- Lightweight members: ${metrics.lightweightMembers}
- Realistic lightweight identities: ${metrics.realisticLightweightMembers}
- Humorous lightweight identities: ${metrics.humorousLightweightMembers}
- Unique full names: ${metrics.uniqueFullNames}
- Unique realistic surnames: ${metrics.uniqueRealisticSurnames}
- Maximum surname frequency: ${metrics.maxRealisticSurnameFrequency}
- Maximum first-name frequency: ${metrics.maxRealisticFirstNameFrequency}
- Longest contiguous surname block: ${metrics.longestContiguousSurnameBlock}

## Generated Population Samples

${Object.entries(audit.population.namingSamples).map(([pool, rows]) => `- ${pool}: ${rows.length ? rows.map((item) => `${item.displayName} (\`${item.id}\`)`).join(", ") : "none used"}`).join("\n")}

Samples above resolve to actual canonical member rows; they are not static pool labels.
`;
}

function lifecycleMarkdown(audit) {
  const item = audit.reservationSessionReconciliation;
  return `# Reservation, Session, Access, and Facility Reconciliation

- Reservations: ${item.reservations}
- Sessions: ${item.sessions}
- Delta: ${item.difference}
- Reservation statuses: ${JSON.stringify(item.reservationsByStatus)}
- Session lifecycle: ${JSON.stringify(item.sessionsByLifecycle)}

The delta is intentional: each listed confirmed future reservation has no Session because it has not started. Demo Tom specifically has 36 completed historical reservations, one upcoming reservation, and 37 total canonical reservations.
`;
}

function scenarioMarkdown(audit) {
  return `# Scenario Reconciliation

${audit.scenarios.map((item) => `## ${item.universe.scenario}

- Clock: ${item.universe.clock}
- Fingerprint: \`${item.universe.fingerprint}\`
- Primary persona: ${item.persona.displayName}
- Credits: ${item.persona.availableCredits}
- Safe-to-assign-now suites: ${item.suiteReadiness.filter((suite) => suite.safeToAssignNow).length}
- Operationally available suites: ${item.suiteReadiness.filter((suite) => suite.operationalStatus === "available").length}
- Active occupancy: ${item.suiteReadiness.filter((suite) => suite.activeSessionId).length}
- Active turnover: ${item.suiteReadiness.filter((suite) => suite.activeTurnoverTaskId).length}
- Protected future inventory: ${item.suiteReadiness.filter((suite) => suite.protectedFutureReservationId).length}
- Story: ${item.suiteAvailability.story}
- Integrity: ${item.integrity.ok ? "PASS" : "FAIL"}
`).join("\n")}

Per-suite operational state, occupancy, turnover, protected reservation, maximum safe duration, and assignment reason are in \`reports/demo-audit.json\`.
`;
}

function ledgerMarkdown(audit) {
  return `# Ledger Chronology

- Audited members: ${audit.ledgerAudit.auditedMemberCount}
- Authored non-monthly funding events: ${audit.ledgerAudit.authoredNonMonthlyFundingEvents.length}
- Target-balancing formula count: ${audit.ledgerAudit.targetBalancingFormulaCount}
- Negative chronological running balances: ${audit.ledgerAudit.members.reduce((sum, member) => sum + member.negativeRunningBalanceCount, 0)}

## Authored Funding Events

${audit.ledgerAudit.authoredNonMonthlyFundingEvents.map((event) => `- \`${event.id}\`: ${event.amountUnits} half-credit units at ${event.createdAt}; ${event.rationale} Eligibility: ${event.eligibility}. Demo-only: ${event.demoOnly}.`).join("\n")}

The complete chronological event stream, running balances, reservation links, idempotency keys, and rationale for all nine deep personas plus 20 deterministic lightweight members are in \`reports/demo-audit.json\`.
`;
}

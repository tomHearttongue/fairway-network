import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const repoRoot = process.cwd();
const pnpm = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\bin\\pnpm.cmd";
const git = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe";
const artifactRoot = path.join(repoRoot, "artifacts", "ux-review");
const staging = path.join(artifactRoot, "bundle-staging");
const zipPath = path.join(artifactRoot, "fairway-ux-review.zip");
const slice = "VS1G.5 Lifecycle Coherence, Guest Evidence Integrity, and Final Experience Refinement";

assertCleanProductTree();
const commitSha = gitText(["rev-parse", "HEAD"]);
const branch = gitText(["branch", "--show-current"]);
const timestamp = new Date().toISOString();

const qa = spawnSync(pnpm, ["ux:qa"], { cwd: repoRoot, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS, "--use-system-ca") }, windowsHide: true, shell: true });
if (qa.error) console.error(`Experience QA could not start: ${qa.error.message}`);
if ((qa.status ?? 1) !== 0) process.exit(qa.status ?? 1);

assertCleanProductTree();
if (gitText(["rev-parse", "HEAD"]) !== commitSha) throw new Error("Cannot generate Product Acceptance bundle: HEAD changed during bundle generation.");

rmSync(staging, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(staging, { recursive: true });

const screenshotManifest = readJson(path.join(artifactRoot, "evidence", "screenshot-manifest.json"), []);
const accessibility = readJson(path.join(artifactRoot, "evidence", "accessibility-findings.json"), []);
const playwrightResults = readJson(path.join(repoRoot, "artifacts", "playwright", "results.json"), null);
const qualityFiles = listFiles(path.join(artifactRoot, "evidence")).filter((file) => file.endsWith("-quality.json"));
const quality = qualityFiles.flatMap((file) => {
  const value = readJson(file, { consoleErrors: [], failedRequests: [] });
  return [{ file: path.relative(artifactRoot, file).replaceAll("\\", "/"), ...value }];
});
const duplicateEvidence = validateDistinctScreenshotEvidence(screenshotManifest);
const summary = buildSummary(playwrightResults, screenshotManifest, accessibility, quality, duplicateEvidence);
const sourceSnapshot = copySourceSnapshot(commitSha);

writeFileSync(path.join(staging, "00-README-FIRST.md"), reviewReadme({ commitSha, branch, timestamp, summary }));
writeJson(path.join(staging, "manifest.json"), {
  project: "Fairway Network",
  slice,
  commitSha,
  branch,
  dlsVersion: "0.1",
  generatedAt: timestamp,
  reviewStatus: "PENDING HUMAN REVIEW",
  sourceSnapshot,
  personas: ["demo-active-birdie", "new-golfer", "power-tour-member", "guest-host-member", "constrained-member", "facilities-user"],
  viewports: ["390x844 mobile-primary", "360x800 mobile-compact", "1440x1000 desktop", "1600x900 presentation"],
  testResultSummary: summary,
  screenshotCount: screenshotManifest.length,
  artifacts: {
    prd: "docs/product/PRD.md",
    designLanguageSystem: "docs/design/DESIGN-LANGUAGE-SYSTEM.md",
    experienceBrief: "docs/design/FAIRWAY-EXPERIENCE-BRIEF.md",
    dataContract: "docs/product/data/VS1G-EXPERIENCE-DATA-CONTRACT.md",
    qaDataContract: "docs/product/data/VS1G1-EXPERIENCE-QA-DATA-CONTRACT.md",
    screenshotManifest: "evidence/screenshot-manifest.json",
  },
});
writeJson(path.join(staging, "evidence", "test-summary.json"), summary);
writeJson(path.join(staging, "evidence", "bundle-provenance.json"), { commitSha, branch, generatedAt: timestamp, sourceSnapshot });
writeJson(path.join(staging, "evidence", "duplicate-screenshot-evidence.json"), duplicateEvidence);

copyIfExists("docs/product/PRD.md", path.join(staging, "docs", "product", "PRD.md"));
copyIfExists("docs/design/DESIGN-LANGUAGE-SYSTEM.md", path.join(staging, "docs", "design", "DESIGN-LANGUAGE-SYSTEM.md"));
copyIfExists("docs/design/FAIRWAY-EXPERIENCE-BRIEF.md", path.join(staging, "docs", "design", "FAIRWAY-EXPERIENCE-BRIEF.md"));
copyIfExists("docs/product/data/VS1G-EXPERIENCE-DATA-CONTRACT.md", path.join(staging, "docs", "product", "data", "VS1G-EXPERIENCE-DATA-CONTRACT.md"));
copyIfExists("docs/product/data/VS1G1-EXPERIENCE-QA-DATA-CONTRACT.md", path.join(staging, "docs", "product", "data", "VS1G1-EXPERIENCE-QA-DATA-CONTRACT.md"));
copyIfExists("docs/product-acceptance/README.md", path.join(staging, "docs", "product-acceptance", "README.md"));
copyIfExists("docs/product-acceptance/vs1g/README.md", path.join(staging, "docs", "product-acceptance", "vs1g", "README.md"));
copyIfExists(path.join(artifactRoot, "screenshots"), path.join(staging, "screenshots"));
copyIfExists(path.join(artifactRoot, "evidence"), path.join(staging, "evidence"));
copyIfExists(path.join(repoRoot, "artifacts", "playwright", "playwright-report"), path.join(staging, "playwright-report"));
mkdirSync(path.join(staging, "traces"), { recursive: true });
writeFileSync(path.join(staging, "traces", "README.md"), "Failure traces are retained in local Playwright artifacts when generated. Authenticated trace ZIP files are not included in the shareable review bundle because they may contain session cookies or tokens.\n");

assertNoSecrets(staging);
verifyStaging(staging, commitSha);

execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${staging.replaceAll("'", "''")}\\*' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`], { stdio: "ignore" });
const zipVerification = verifyGeneratedBundle(zipPath, { commitSha });
const size = statSync(zipPath).size;
writeJson(path.join(artifactRoot, "bundle-summary.json"), { zipPath: path.relative(repoRoot, zipPath).replaceAll("\\", "/"), bytes: size, megabytes: Number((size / 1024 / 1024).toFixed(2)), generatedAt: timestamp, commitSha, branch, sourceSnapshot, zipVerification });
console.log(`Generated ${path.relative(repoRoot, zipPath)} (${(size / 1024 / 1024).toFixed(2)} MB) for ${zipVerification.manifestCommitSha}`);

function assertCleanProductTree() {
  const dirty = gitText(["status", "--porcelain", "--untracked-files=all"]).split(/\r?\n/).filter(Boolean);
  const relevant = dirty.filter((entry) => !isIgnorableWorkingTreePath(statusPath(entry)));
  if (relevant.length) {
    throw new Error(`Cannot generate Product Acceptance bundle: working tree contains uncommitted product/source changes.\n${relevant.join("\n")}`);
  }
}

function statusPath(entry) {
  const raw = entry.slice(3).trim();
  return raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
}

function isIgnorableWorkingTreePath(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.startsWith("artifacts/") || normalized.startsWith(".next/") || normalized.startsWith("test-results/") || normalized.startsWith("playwright-report/") || normalized.startsWith("coverage/") || normalized.endsWith(".log");
}

function buildSummary(results, screenshots, a11y, qualityEntries, duplicateEvidence) {
  const tests = results?.stats ?? {};
  const violations = a11y.flatMap((entry) => entry.violations ?? []);
  const bySeverity = violations.reduce((acc, violation) => {
    const key = violation.impact ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const consoleErrors = qualityEntries.reduce((sum, entry) => sum + (entry.consoleErrors?.length ?? 0), 0);
  const expectedConsoleMessages = qualityEntries.reduce((sum, entry) => sum + (entry.expectedConsoleMessages?.length ?? 0), 0);
  const expectedRequestCancellations = qualityEntries.reduce((sum, entry) => sum + (entry.expectedRequestCancellations?.length ?? 0), 0);
  const unexpectedNetworkFailures = qualityEntries.reduce((sum, entry) => sum + ((entry.unexpectedNetworkFailures ?? entry.failedRequests)?.length ?? 0), 0);
  return {
    goldenDemoFunctionalResult: tests.unexpected === 0 ? "passed" : "failed",
    facilitiesGoldenDemoResult: tests.unexpected === 0 ? "passed" : "failed",
    crossBrowserSmokeResult: tests.unexpected === 0 ? "passed" : "failed",
    responsiveChecks: "included in Playwright assertions, including mobile Play panel width checks",
    accessibilityFindingCountsBySeverity: bySeverity,
    accessibilityScreenCount: a11y.length,
    consoleErrorCount: consoleErrors,
    expectedConsoleMessageCount: expectedConsoleMessages,
    expectedRequestCancellationCount: expectedRequestCancellations,
    unexpectedNetworkFailureCount: unexpectedNetworkFailures,
    screenshotGenerationResult: screenshots.length > 0 ? "passed" : "no screenshots generated",
    screenshotCount: screenshots.length,
    duplicateScreenshotEvidenceCount: duplicateEvidence.duplicates.length,
    totalTests: tests.expected ?? null,
    failedTests: tests.unexpected ?? null,
    skippedTests: tests.skipped ?? null,
  };
}

function reviewReadme({ commitSha, branch, timestamp, summary }) {
  return `# Fairway UX Review Bundle\n\nProject: Fairway Network\nSlice: ${slice}\nCommit SHA: ${commitSha}\nBranch: ${branch}\nDLS Version: 0.1\nGenerated: ${timestamp}\nProduct Acceptance: PENDING HUMAN REVIEW\n\n## Primary Review Objective\nEvaluate VS1G.5 Product Acceptance remediation, including lifecycle-coherent completion rendering, active-session language, guest evidence integrity, heading-focus polish, and preserved artifact provenance.\n\n## Golden Demo Sequence\n1. demo-active-birdie opens Member Home.\n2. Reviews server-derived Play Now duration and credit quote, then confirms Play Now.\n3. Sees assigned suite, credit impact, access readiness, and active session state.\n4. Reviews My Golf / Golfer Passport demo data.\n5. Completes the session and sees a member-centered completion summary.\n6. facilities-user opens Cleaning Mode.\n7. Claims, starts, and completes the turnover task.\n8. Suite returns to ready inventory.\n\n## Personas Included\n- demo-active-birdie\n- new-golfer\n- power-tour-member\n- guest-host-member\n- constrained-member\n- facilities-user\n\n## Known Intentionally Deferred Features\nCompetition, Tour Stop, Who Needs a Fourth, real GHIN, real Uneekor ingestion, real Stripe, real Kisi, real waiver provider, smart waitlist, native apps, and broad UI redesign are out of scope.\n\n## Known Limitations\nAutomated accessibility checks are evidence, not certification. Visual baselines are not approved until human Product Acceptance. Authenticated Playwright trace ZIPs are retained locally on failure but excluded from this shareable ZIP because they can contain session tokens.\n\n## Automated Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`;
}

function copySourceSnapshot(commit) {
  const tracked = gitText(["ls-tree", "-r", "--name-only", commit]).split(/\r?\n/).filter(Boolean);
  const include = [/^app\//, /^src-page\//, /^src\//, /^tests\/experience\//, /^tests\/domains\//, /^scripts\/(run-experience-qa|ux-review-bundle|verify-vertical-slice-1g)\.mjs$/, /^playwright\.config\.ts$/, /^package\.json$/, /^pnpm-lock\.yaml$/, /^supabase\/migrations\//, /^supabase\/seed\.sql$/, /^docs\//, /^README\.md$/];
  let fileCount = 0;
  for (const file of tracked) {
    if (!include.some((pattern) => pattern.test(file))) continue;
    if (isForbiddenPath(file)) continue;
    const destination = path.join(staging, "source", file);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, gitBlob(commit, file));
    fileCount += 1;
  }
  return { commitSha: commit, method: "git show <commit>:<path>", fileCount };
}

function verifyStaging(root, commit) {
  const required = [
    "manifest.json",
    "00-README-FIRST.md",
    "evidence/screenshot-manifest.json",
    "source/src/domains/reservations/pricing.ts",
    "source/supabase/migrations/202607230001_reservation_pricing_authority.sql",
  ];
  for (const file of required) {
    if (!existsSync(path.join(root, file))) throw new Error(`Required bundle artifact missing before ZIP: ${file}`);
  }
  const manifest = readJson(path.join(root, "manifest.json"), null);
  if (manifest?.commitSha !== commit) throw new Error("Staged manifest commit does not match HEAD.");
  const readme = readFileSync(path.join(root, "00-README-FIRST.md"), "utf8");
  if (!readme.includes(commit)) throw new Error("Staged README commit does not match HEAD.");
}

function verifyGeneratedBundle(file, { commitSha: expectedSha }) {
  const verifyRoot = path.join(artifactRoot, "bundle-verify");
  rmSync(verifyRoot, { recursive: true, force: true });
  mkdirSync(verifyRoot, { recursive: true });
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -Path '${file.replaceAll("'", "''")}' -DestinationPath '${verifyRoot.replaceAll("'", "''")}' -Force`], { stdio: "ignore" });
  assertNoSecrets(verifyRoot);
  verifyStaging(verifyRoot, expectedSha);
  const manifest = readJson(path.join(verifyRoot, "manifest.json"), null);
  const verification = { manifestCommitSha: manifest.commitSha, sourceSnapshotCommitSha: manifest.sourceSnapshot?.commitSha, requiredArtifactsPresent: true, secretExclusion: "passed" };
  rmSync(verifyRoot, { recursive: true, force: true });
  return verification;
}

function validateDistinctScreenshotEvidence(screenshots) {
  const hashes = new Map();
  for (const entry of screenshots) {
    const relative = String(entry.file ?? "").replace(/^screenshots\//, "");
    const file = path.join(artifactRoot, "screenshots", relative);
    if (!existsSync(file)) throw new Error("Screenshot evidence file is missing: " + entry.file);
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    const descriptor = { file: entry.file, screen: entry.screen, state: entry.state, persona: entry.persona, viewport: entry.viewport, hash };
    if (!hashes.has(hash)) hashes.set(hash, []);
    hashes.get(hash).push(descriptor);
  }
  const duplicates = Array.from(hashes.values())
    .filter((items) => new Set(items.map((item) => `${item.screen}|${item.state}|${item.persona}|${item.viewport}`)).size > 1)
    .map((items) => ({ hash: items[0].hash, entries: items }));
  if (duplicates.length) throw new Error("Duplicate screenshot evidence detected for distinct review states: " + JSON.stringify(duplicates, null, 2));
  return { checked: screenshots.length, duplicates };
}

function assertNoSecrets(root) {
  const files = listFiles(root);
  const forbidden = files.filter(isForbiddenPath);
  if (forbidden.length) throw new Error(`Forbidden secret-bearing paths staged: ${forbidden.map((file) => path.relative(root, file)).join(", ")}`);
  const suspicious = [];
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    if (relative === "source/scripts/ux-review-bundle.mjs") continue;
    if (!isTextLike(file)) continue;
    const content = readFileSync(file, "utf8");
    if (/sk_(?:test|live)_[A-Za-z0-9_-]+/.test(content) || /whsec_[A-Za-z0-9_-]+/.test(content) || /service_role["'\s:=]+eyJ/i.test(content) || /__clerk_db_jwt=(?!\[redacted\])[^&\s]+/i.test(content) || /\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/.test(content)) suspicious.push(path.relative(root, file));
  }
  if (suspicious.length) throw new Error(`Potential secrets detected in staged review bundle: ${suspicious.join(", ")}`);
}

function isForbiddenPath(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  return /(^|\/)\.env(?:\.|$)/.test(normalized) || normalized.includes("storagestate") || normalized.includes("cookie") || normalized.endsWith("trace.zip") || normalized.includes("node_modules") || normalized.includes("/.next/") || normalized.includes("/.git/");
}

function isTextLike(file) {
  return /\.(?:md|json|ts|tsx|js|mjs|css|html|txt|yml|yaml|sql)$/.test(file.toLowerCase());
}

function copyIfExists(from, to) {
  const source = path.isAbsolute(from) ? from : path.join(repoRoot, from);
  if (!existsSync(source)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(source, to, { recursive: true, filter: (src) => !isForbiddenPath(src) && !src.includes("node_modules") && !src.includes(".next") });
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const name of execFileSync("powershell.exe", ["-NoProfile", "-Command", `Get-ChildItem -LiteralPath '${current.replaceAll("'", "''")}' -Force | Select-Object -ExpandProperty FullName`], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean)) stack.push(name);
    } else {
      result.push(current);
    }
  }
  return result;
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

function gitText(args) {
  return execFileSync(git, args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function gitBlob(commit, file) {
  return execFileSync(git, ["show", `${commit}:${file}`], { cwd: repoRoot });
}

function appendNodeOption(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const pnpm = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\bin\\pnpm.cmd";
const git = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe";
const artifactRoot = path.join(repoRoot, "artifacts", "ux-review");
const staging = path.join(artifactRoot, "bundle-staging");
const zipPath = path.join(artifactRoot, "fairway-ux-review.zip");

const qa = spawnSync(pnpm, ["ux:qa"], { cwd: repoRoot, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS, "--use-system-ca") }, windowsHide: true, shell: true });
if (qa.error) console.error(`Experience QA could not start: ${qa.error.message}`);
if ((qa.status ?? 1) !== 0) process.exit(qa.status ?? 1);

rmSync(staging, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(staging, { recursive: true });

const commitSha = gitText(["rev-parse", "HEAD"]);
const branch = gitText(["branch", "--show-current"]);
const timestamp = new Date().toISOString();
const screenshotManifest = readJson(path.join(artifactRoot, "evidence", "screenshot-manifest.json"), []);
const accessibility = readJson(path.join(artifactRoot, "evidence", "accessibility-findings.json"), []);
const playwrightResults = readJson(path.join(repoRoot, "artifacts", "playwright", "results.json"), null);
const qualityFiles = listFiles(path.join(artifactRoot, "evidence")).filter((file) => file.endsWith("-quality.json"));
const quality = qualityFiles.flatMap((file) => {
  const value = readJson(file, { consoleErrors: [], failedRequests: [] });
  return [{ file: path.relative(artifactRoot, file).replaceAll("\\", "/"), ...value }];
});
const summary = buildSummary(playwrightResults, screenshotManifest, accessibility, quality);

writeFileSync(path.join(staging, "00-README-FIRST.md"), reviewReadme({ commitSha, branch, timestamp, summary }));
writeJson(path.join(staging, "manifest.json"), {
  project: "Fairway Network",
  slice: "VS1G.1 Experience QA Harness & Product Acceptance Infrastructure",
  commitSha,
  branch,
  dlsVersion: "0.1",
  generatedAt: timestamp,
  reviewStatus: "PENDING HUMAN REVIEW",
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

copySourceSnapshot();
assertNoSecrets(staging);

execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${staging.replaceAll("'", "''")}\\*' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`], { stdio: "ignore" });
const size = statSync(zipPath).size;
writeJson(path.join(artifactRoot, "bundle-summary.json"), { zipPath: path.relative(repoRoot, zipPath).replaceAll("\\", "/"), bytes: size, megabytes: Number((size / 1024 / 1024).toFixed(2)), generatedAt: timestamp, commitSha, branch });
console.log(`Generated ${path.relative(repoRoot, zipPath)} (${(size / 1024 / 1024).toFixed(2)} MB)`);

function buildSummary(results, screenshots, a11y, qualityEntries) {
  const tests = results?.stats ?? {};
  const violations = a11y.flatMap((entry) => entry.violations ?? []);
  const bySeverity = violations.reduce((acc, violation) => {
    const key = violation.impact ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const consoleErrors = qualityEntries.reduce((sum, entry) => sum + (entry.consoleErrors?.length ?? 0), 0);
  const failedRequests = qualityEntries.reduce((sum, entry) => sum + (entry.failedRequests?.length ?? 0), 0);
  return {
    goldenDemoFunctionalResult: tests.unexpected === 0 ? "passed" : "failed",
    facilitiesGoldenDemoResult: tests.unexpected === 0 ? "passed" : "failed",
    crossBrowserSmokeResult: tests.unexpected === 0 ? "passed" : "failed",
    responsiveChecks: "included in Playwright assertions",
    accessibilityFindingCountsBySeverity: bySeverity,
    accessibilityScreenCount: a11y.length,
    consoleErrorCount: consoleErrors,
    unexpectedNetworkErrorCount: failedRequests,
    screenshotGenerationResult: screenshots.length > 0 ? "passed" : "no screenshots generated",
    screenshotCount: screenshots.length,
    totalTests: tests.expected ?? null,
    failedTests: tests.unexpected ?? null,
    skippedTests: tests.skipped ?? null,
  };
}

function reviewReadme({ commitSha, branch, timestamp, summary }) {
  return `# Fairway UX Review Bundle\n\nProject: Fairway Network\nSlice: VS1G.1 - Experience QA Harness & Product Acceptance Infrastructure\nCommit SHA: ${commitSha}\nBranch: ${branch}\nDLS Version: 0.1\nGenerated: ${timestamp}\nProduct Acceptance: PENDING HUMAN REVIEW\n\n## Primary Review Objective\nEvaluate whether the VS1G member and facilities experience feels like one intentional, premium, mobile-first Fairway product before new product scope is layered on.\n\n## Golden Demo Sequence\n1. demo-active-birdie opens Member Home.\n2. Uses Play Now.\n3. Sees suite, credit, access, and active session state.\n4. Reviews My Golf / Golfer Passport demo data.\n5. Completes the session and sees completion feedback.\n6. facilities-user opens Cleaning Mode.\n7. Claims, starts, and completes the turnover task.\n8. Suite returns to ready inventory.\n\n## Personas Included\n- demo-active-birdie\n- new-golfer\n- power-tour-member\n- guest-host-member\n- constrained-member\n- facilities-user\n\n## Known Intentionally Deferred Features\nCompetition, Tour Stop, Who Needs a Fourth, real GHIN, real Uneekor ingestion, real Stripe, real Kisi, real waiver provider, smart waitlist, native apps, and broad UI redesign are out of scope.\n\n## Known Limitations\nAutomated accessibility checks are evidence, not certification. Visual baselines are not approved until human Product Acceptance. Authenticated Playwright trace ZIPs are retained locally on failure but excluded from this shareable ZIP because they can contain session tokens.\n\n## Automated Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`;
}

function copySourceSnapshot() {
  const tracked = gitText(["ls-files"]).split(/\r?\n/).filter(Boolean);
  const include = [/^app\//, /^src-page\//, /^src\//, /^tests\/experience\//, /^scripts\/(run-experience-qa|ux-review-bundle)\.mjs$/, /^playwright\.config\.ts$/, /^package\.json$/, /^pnpm-lock\.yaml$/, /^docs\//, /^README\.md$/];
  for (const file of tracked) {
    if (!include.some((pattern) => pattern.test(file))) continue;
    if (isForbiddenPath(file)) continue;
    copyIfExists(file, path.join(staging, "source", file));
  }
}

function assertNoSecrets(root) {
  const files = listFiles(root);
  const forbidden = files.filter(isForbiddenPath);
  if (forbidden.length) throw new Error(`Forbidden secret-bearing paths staged: ${forbidden.map((file) => path.relative(root, file)).join(", ")}`);
  const suspicious = [];
  for (const file of files) {
    if (!isTextLike(file)) continue;
    const content = readFileSync(file, "utf8");
    if (/sk_(?:test|live)_[A-Za-z0-9_-]+/.test(content) || /whsec_[A-Za-z0-9_-]+/.test(content) || /service_role["'\s:=]+eyJ/i.test(content)) suspicious.push(path.relative(root, file));
  }
  if (suspicious.length) throw new Error(`Potential secrets detected in staged review bundle: ${suspicious.join(", ")}`);
}

function isForbiddenPath(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  return /(^|\/)\.env(?:\.|$)/.test(normalized) || normalized.includes("storagestate") || normalized.includes("cookie") || normalized.endsWith("trace.zip") || normalized.includes("node_modules") || normalized.includes("/.next/");
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

function appendNodeOption(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}
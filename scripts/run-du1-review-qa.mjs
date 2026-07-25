import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FAIRWAY_DEMO_CLOCK_ISO } from "../src/demo-universe/universe.ts";

const repoRoot = process.cwd();
const git = process.env.FAIRWAY_GIT_EXECUTABLE ?? "git";
const reviewRootRelative = path.join("artifacts", "du1-remediation-r2-review");
const root = path.join(repoRoot, reviewRootRelative);
const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(repoRoot, "node_modules", "@playwright", "test", "cli.js");
const commitSha = gitText(["rev-parse", "HEAD"]);
assertCleanTrackedTree();
const env = {
  ...process.env,
  NODE_OPTIONS: append(process.env.NODE_OPTIONS, "--use-system-ca"),
  FAIRWAY_DEMO_MODE: "true",
  FAIRWAY_DEMO_CLOCK_ISO,
  FAIRWAY_DU1_REVIEW_COMMIT_SHA: commitSha,
  FAIRWAY_DU1_REVIEW_ROOT: reviewRootRelative,
  PLAYWRIGHT_BASE_URL: "http://localhost:3100",
};

await stopServer();
rmSync(path.join(root, "screenshots"), { recursive: true, force: true });
rmSync(path.join(root, "evidence"), { recursive: true, force: true });
rmSync(path.join(root, "playwright"), { recursive: true, force: true });
rmSync(path.join(root, "runtime"), { recursive: true, force: true });
mkdirSync(path.join(root, "playwright"), { recursive: true });
console.log(`DU1 R2 review: building committed revision ${commitSha}`);
run(process.execPath, [nextCli, "build"]);
console.log("DU1 R2 review: starting production server on 3100");
startServer();
try {
  await waitForServer();
  console.log("DU1 R2 review: running Playwright exact-world evidence");
  run(process.execPath, [playwrightCli, "test", "--config=playwright.du1.config.ts"]);
} finally {
  await stopServer();
}
assertCleanTrackedTree();
if (gitText(["rev-parse", "HEAD"]) !== commitSha) throw new Error("HEAD changed during DU1 R2 Experience QA.");
mkdirSync(path.join(root, "reports"), { recursive: true });
writeFileSync(path.join(root, "reports", "experience-qa-gate.json"), `${JSON.stringify({
  gate: "DU1 R2 Playwright Experience QA",
  logicalCommand: "pnpm demo:review:qa",
  status: "PASS",
  exitCode: 0,
  commitSha,
  completedAt: new Date().toISOString(),
}, null, 2)}\n`);

function run(file, args) {
  const result = spawnSync(file, args, { cwd: repoRoot, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${path.basename(file)} ${args.map((item) => path.basename(item) || item).join(" ")} status=${result.status ?? "null"} signal=${result.signal ?? "none"}`);
}

function startServer() {
  const ps = `$env:NODE_OPTIONS='${escapePs(env.NODE_OPTIONS)}'; $env:FAIRWAY_DEMO_MODE='true'; $env:FAIRWAY_DEMO_CLOCK_ISO='${FAIRWAY_DEMO_CLOCK_ISO}'; $env:FAIRWAY_DU1_REVIEW_COMMIT_SHA='${commitSha}'; Start-Process -FilePath '${escapePs(process.execPath)}' -ArgumentList @('${escapePs(nextCli)}','start','-p','3100') -WorkingDirectory '${escapePs(repoRoot)}' -WindowStyle Hidden -RedirectStandardOutput '${escapePs(path.join(root, "playwright", "next-start.out.log"))}' -RedirectStandardError '${escapePs(path.join(root, "playwright", "next-start.err.log"))}'`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    try {
      const response = await fetch("http://localhost:3100", { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("DU1 R2 production-like review server did not start.");
}

async function stopServer() {
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'node*' -and $_.CommandLine -like '*next*start*-p*3100*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => setTimeout(resolve, 750));
}

function assertCleanTrackedTree() {
  const dirty = gitText(["status", "--porcelain", "--untracked-files=no"]).split(/\r?\n/).filter(Boolean);
  if (dirty.length) throw new Error(`Cannot generate DU1 R2 review evidence: tracked tree is dirty.\n${dirty.join("\n")}`);
}

function gitText(args) {
  return execFileSync(git, args, { cwd: repoRoot, encoding: "utf8", windowsHide: true }).trim();
}

function append(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}

function escapePs(value) {
  return String(value ?? "").replaceAll("'", "''");
}

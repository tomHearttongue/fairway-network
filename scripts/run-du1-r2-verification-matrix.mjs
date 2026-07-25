import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./demo-universe-loader.mjs";

const repoRoot = process.cwd();
const git = process.env.FAIRWAY_GIT_EXECUTABLE ?? "git";
const reviewRootRelative = path.join("artifacts", "du1-remediation-r2-review");
const root = path.join(repoRoot, reviewRootRelative);
const transcriptRoot = path.join(root, "reports", "verification", "transcripts");
const matrixPath = path.join(root, "reports", "verification-matrix.json");
const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const commitSha = gitText(["rev-parse", "HEAD"]);
const env = {
  ...loadEnvFile(),
  ...process.env,
  FAIRWAY_DU1_REVIEW_ROOT: reviewRootRelative,
  NODE_OPTIONS: append(process.env.NODE_OPTIONS, "--use-system-ca"),
};
assertCleanTrackedTree();
mkdirSync(transcriptRoot, { recursive: true });

const gates = [];
let legacyVerifierServerStarted = false;
const commands = [
  gate("unit-tests", "pnpm test", process.execPath, ["node_modules/vitest/vitest.mjs", "run"]),
  gate("focused-round-2-tests", "pnpm exec vitest run tests/domains/du1-round2-remediation.test.ts", process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/domains/du1-round2-remediation.test.ts"]),
  gate("typecheck", "pnpm typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]),
  gate("production-build", "pnpm build", process.execPath, ["node_modules/next/dist/bin/next", "build"]),
  ...["1b", "1c", "1d", "1e", "1f", "1g"].map((slice) =>
    gate(`verify-vs${slice}`, `pnpm verify:vs${slice}`, process.execPath, [`scripts/verify-vertical-slice-${slice}.mjs`])),
  ...["normal", "busy-prime", "new-member", "facility-incident", "low-inventory"].map((scenario) =>
    gate(`demo-reset-${scenario}`, `pnpm demo:reset -- --scenario=${scenario} --yes`, process.execPath, ["scripts/demo-reset.mjs", `--scenario=${scenario}`, "--yes"], {
      FAIRWAY_DEMO_RESET_CONFIRM: "RESET_FAIRWAY_DEMO",
    })),
  gate("demo-verify", "pnpm demo:verify", process.execPath, ["scripts/demo-verify.mjs"]),
  gate("demo-audit", "pnpm demo:audit", process.execPath, ["scripts/demo-audit.mjs"]),
  gate("session-start-authority", "pnpm verify:du1:r2:session-start", process.execPath, ["scripts/verify-du1-session-start-authority.mjs"]),
];

try {
  validateExperienceQaGate();
  for (const command of commands) {
    if (command.id === "verify-vs1b") {
      legacyVerifierServerStarted = true;
      await startLegacyVerifierServer();
    }
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const result = spawnSync(command.executable, command.args, {
      cwd: repoRoot,
      env: { ...env, ...command.env },
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });
    const completedAt = new Date().toISOString();
    const transcript = sanitize([
      `logicalCommand: ${command.logicalCommand}`,
      `exitCode: ${result.status ?? "null"}`,
      `signal: ${result.signal ?? "none"}`,
      `launchError: ${result.error?.message ?? "none"}`,
      "",
      "stdout:",
      result.stdout ?? "",
      "",
      "stderr:",
      result.stderr ?? "",
    ].join("\n"));
    const transcriptRelative = `reports/verification/transcripts/${command.id}.txt`;
    const transcriptPath = path.join(root, transcriptRelative);
    writeFileSync(transcriptPath, transcript);
    const record = {
      id: command.id,
      logicalCommand: command.logicalCommand,
      status: !result.error && result.status === 0 ? "PASS" : "FAIL",
      exitCode: result.status,
      signal: result.signal,
      startedAt,
      completedAt,
      durationMs: Date.now() - started,
      transcriptPath: transcriptRelative,
      transcriptSha256: sha256(Buffer.from(transcript)),
    };
    gates.push(record);
    writeMatrix();
    if (record.status !== "PASS") throw new Error(`Verification gate failed: ${command.logicalCommand}`);
  }

  if (legacyVerifierServerStarted) {
    stopLegacyVerifierServer();
    legacyVerifierServerStarted = false;
    restoreTrackedGeneratedFile("next-env.d.ts");
  }
  assertCleanTrackedTree();
  if (gitText(["rev-parse", "HEAD"]) !== commitSha) throw new Error("HEAD changed during DU1 R2 verification.");
  writeMatrix();
  console.log(`DU1 R2 verification matrix: PASS (${gates.length} gates plus Experience QA)`);
} catch (error) {
  writeMatrix(String(error?.message ?? error));
  throw error;
} finally {
  if (legacyVerifierServerStarted) {
    stopLegacyVerifierServer();
    restoreTrackedGeneratedFile("next-env.d.ts");
  }
}

async function startLegacyVerifierServer() {
  stopLegacyVerifierServer();
  const stdoutPath = path.join(root, "reports", "verification", "legacy-server.out.log");
  const stderrPath = path.join(root, "reports", "verification", "legacy-server.err.log");
  mkdirSync(path.dirname(stdoutPath), { recursive: true });
  const script = `$env:NODE_OPTIONS='${escapePowerShell(env.NODE_OPTIONS)}'; Start-Process -FilePath '${escapePowerShell(process.execPath)}' -ArgumentList @('${escapePowerShell(nextCli)}','dev','-p','3000') -WorkingDirectory '${escapePowerShell(repoRoot)}' -WindowStyle Hidden -RedirectStandardOutput '${escapePowerShell(stdoutPath)}' -RedirectStandardError '${escapePowerShell(stderrPath)}'`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    try {
      const response = await fetch("http://localhost:3000", { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Legacy vertical-slice verifier server did not start.");
}

function stopLegacyVerifierServer() {
  const script = "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }";
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
}

function restoreTrackedGeneratedFile(relativePath) {
  const content = execFileSync(git, ["show", `${commitSha}:${relativePath}`], {
    cwd: repoRoot,
    windowsHide: true,
  });
  writeFileSync(path.join(repoRoot, relativePath), content);
}

function validateExperienceQaGate() {
  const file = path.join(root, "reports", "experience-qa-gate.json");
  if (!existsSync(file)) throw new Error("Experience QA gate evidence is missing. Run pnpm demo:review:qa first.");
  const qa = JSON.parse(readFileSync(file, "utf8"));
  if (qa.status !== "PASS" || qa.exitCode !== 0 || qa.commitSha !== commitSha) throw new Error("Experience QA gate does not match current committed revision.");
  gates.push({
    id: "playwright-experience-qa",
    logicalCommand: qa.logicalCommand,
    status: "PASS",
    exitCode: 0,
    signal: null,
    startedAt: null,
    completedAt: qa.completedAt,
    durationMs: null,
    transcriptPath: "playwright/results.json",
    transcriptSha256: sha256(readFileSync(path.join(root, "playwright", "results.json"))),
  });
}

function writeMatrix(failure = null) {
  mkdirSync(path.dirname(matrixPath), { recursive: true });
  writeFileSync(matrixPath, `${JSON.stringify({
    commitSha,
    generatedAt: new Date().toISOString(),
    status: failure ? "FAIL" : gates.every((item) => item.status === "PASS") ? "PASS" : "IN_PROGRESS",
    failure,
    gateCount: gates.length,
    gates,
  }, null, 2)}\n`);
}

function gate(id, logicalCommand, executable, args, extraEnv = {}) {
  return { id, logicalCommand, executable, args, env: extraEnv };
}

function assertCleanTrackedTree() {
  const dirty = gitText(["status", "--porcelain", "--untracked-files=no"]).split(/\r?\n/).filter(Boolean);
  if (dirty.length) throw new Error(`DU1 R2 verification requires a clean tracked tree.\n${dirty.join("\n")}`);
}

function gitText(args) {
  return execFileSync(git, args, { cwd: repoRoot, encoding: "utf8", windowsHide: true }).trim();
}

function sanitize(value) {
  return String(value)
    .replaceAll(repoRoot, "[REPO]")
    .replaceAll(repoRoot.replaceAll("\\", "/"), "[REPO]")
    .replace(/C:\\Users\\[^\\\r\n]+/gi, "[USER_HOME]")
    .replace(/([?&](?:token|ticket|session|jwt)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+\b/g, "[redacted-key]")
    .replace(/\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/g, "[redacted-session]");
}

function append(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}

function escapePowerShell(value) {
  return String(value ?? "").replaceAll("'", "''");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

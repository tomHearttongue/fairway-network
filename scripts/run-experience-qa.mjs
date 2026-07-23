import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const repoRoot = process.cwd();
const pnpm = "C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\bin\\pnpm.cmd";
const env = { ...process.env, NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS, "--use-system-ca") };

rmSync("artifacts/playwright", { recursive: true, force: true });
mkdirSync("artifacts/playwright", { recursive: true });
await stopPort3000();
buildApplication();
startProductionServer();
let exitCode = 1;
try {
  await waitForServer();
  const result = spawnSync(pnpm, ["exec", "playwright", "test"], { cwd: repoRoot, env, stdio: "inherit", windowsHide: true, shell: true });
  exitCode = result.status ?? 1;
} finally {
  await stopPort3000();
}
process.exit(exitCode);

function buildApplication() {
  const result = spawnSync(pnpm, ["build"], { cwd: repoRoot, env, stdio: "inherit", windowsHide: true, shell: true });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function startProductionServer() {
  const ps = `
    $env:NODE_OPTIONS='--use-system-ca'
    Start-Process -FilePath '${pnpm}' -ArgumentList 'start' -WorkingDirectory '${repoRoot.replaceAll("'", "''")}' -WindowStyle Hidden -RedirectStandardOutput '${repoRoot.replaceAll("'", "''")}\\artifacts\\playwright\\next-start.out.log' -RedirectStandardError '${repoRoot.replaceAll("'", "''")}\\artifacts\\playwright\\next-start.err.log'
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
}

function appendNodeOption(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}

async function waitForServer() {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 75_000) {
    try {
      const response = await fetch("http://localhost:3000", { redirect: "manual" });
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Next production server did not start: ${lastError?.message ?? lastError}`);
}

async function stopPort3000() {
  const script = "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }";
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

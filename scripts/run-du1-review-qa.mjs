import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { FAIRWAY_DEMO_CLOCK_ISO } from "../src/demo-universe/universe.ts";

const repoRoot = process.cwd();
const root = path.join(repoRoot, "artifacts", "du1-remediation-review");
const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(repoRoot, "node_modules", "@playwright", "test", "cli.js");
const env = {
  ...process.env,
  NODE_OPTIONS: append(process.env.NODE_OPTIONS, "--use-system-ca"),
  FAIRWAY_DEMO_MODE: "true",
  FAIRWAY_DEMO_CLOCK_ISO,
  PLAYWRIGHT_BASE_URL: "http://localhost:3100",
};

await stopServer();
rmSync(path.join(root, "screenshots"), { recursive: true, force: true });
rmSync(path.join(root, "evidence"), { recursive: true, force: true });
rmSync(path.join(root, "playwright"), { recursive: true, force: true });
mkdirSync(path.join(root, "playwright"), { recursive: true });
console.log("DU1 review: building production application");
run(process.execPath, [nextCli, "build"]);
console.log("DU1 review: starting production server on 3100");
startServer();
try {
  await waitForServer();
  console.log("DU1 review: running Playwright");
  run(process.execPath, [playwrightCli, "test", "--config=playwright.du1.config.ts"]);
} finally {
  await stopServer();
}

function run(file, args) {
  const result = spawnSync(file, args, { cwd: repoRoot, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${file} ${args.join(" ")} status=${result.status ?? "null"} signal=${result.signal ?? "none"}`);
}

function startServer() {
  const ps = `$env:NODE_OPTIONS='${env.NODE_OPTIONS}'; $env:FAIRWAY_DEMO_MODE='true'; $env:FAIRWAY_DEMO_CLOCK_ISO='${FAIRWAY_DEMO_CLOCK_ISO}'; Start-Process -FilePath '${process.execPath}' -ArgumentList @('${nextCli.replaceAll("'", "''")}','start','-p','3100') -WorkingDirectory '${repoRoot.replaceAll("'", "''")}' -WindowStyle Hidden -RedirectStandardOutput '${root.replaceAll("'", "''")}\\playwright\\next-start.out.log' -RedirectStandardError '${root.replaceAll("'", "''")}\\playwright\\next-start.err.log'`;
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
  throw new Error("DU1 production-like review server did not start.");
}

async function stopServer() {
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'node*' -and $_.CommandLine -like '*next*start*-p*3100*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => setTimeout(resolve, 750));
}

function append(value, option) {
  return value?.includes(option) ? value : `${value ? `${value} ` : ""}${option}`;
}

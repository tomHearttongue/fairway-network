import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FAIRWAY_DEMO_CLOCK_ISO, FAIRWAY_DEMO_UNIVERSE_SEED, FAIRWAY_DEMO_UNIVERSE_VERSION } from "@/demo-universe/universe";

const root = path.join("artifacts", "du1-remediation-r2-review");

export type StructuredAssertion = {
  id: string;
  sourcePath: string;
  comparator: "equals" | "contains" | "count";
  expected: string | number | boolean;
  actual: string | number | boolean;
  passed: true;
};

export type QualityCapture = {
  id: string;
  consoleErrors: Array<{ text: string; location: string }>;
  expectedCancellations: Array<{ url: string; failure: string }>;
  unexpectedNetworkFailures: Array<{ url: string; failure: string }>;
};

export function startQualityCapture(page: Page, id: string): QualityCapture {
  const result: QualityCapture = { id, consoleErrors: [], expectedCancellations: [], unexpectedNetworkFailures: [] };
  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push({ text: sanitize(message.text()), location: sanitize(message.location().url) });
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const item = { url: sanitize(request.url()), failure };
    const browserCancellation = /\b(?:ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT)\b/i.test(failure);
    if (browserCancellation) result.expectedCancellations.push(item);
    else result.unexpectedNetworkFailures.push(item);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) result.unexpectedNetworkFailures.push({ url: sanitize(response.url()), failure: `HTTP ${response.status()}` });
  });
  return result;
}

export async function captureDu1Screen(page: Page, testInfo: TestInfo, input: {
  order: number;
  step: number | null;
  screen: string;
  persona: string;
  personaDisplayName: string;
  personaEmail: string;
  scenario: string;
  state: string;
  fingerprint: string;
  resetExecutionId: string;
  flowExecutionId: string;
  reconciliationPath: string;
  assertions: StructuredAssertion[];
  qualityCaptureId: string;
  accessibilityEvidenceId: string;
}): Promise<void> {
  expect(input.assertions.length, `${input.screen} structured assertions`).toBeGreaterThan(0);
  expect(input.assertions.every((assertion) => assertion.passed), `${input.screen} reconciliation assertions`).toBe(true);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const viewport = testInfo.project.name;
  const actualViewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
  const fileName = `${String(input.order).padStart(2, "0")}-${slug(input.screen)}.png`;
  const relative = path.join("screenshots", viewport, input.scenario, input.persona, fileName).replaceAll("\\", "/");
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  const buffer = await page.screenshot({ path: absolute, fullPage: false });
  appendJson("evidence/screenshot-manifest.json", {
    file: relative,
    screen: input.screen,
    route: page.url().replace(/^https?:\/\/[^/]+/, ""),
    persona: input.persona,
    personaDisplayName: input.personaDisplayName,
    personaEmail: input.personaEmail,
    scenario: input.scenario,
    state: input.state,
    step: input.step,
    viewport,
    actualViewport,
    screenshotPixels: { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) },
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.length,
    exactCommitSha: requiredEnvironment("FAIRWAY_DU1_REVIEW_COMMIT_SHA"),
    universeVersion: FAIRWAY_DEMO_UNIVERSE_VERSION,
    universeSeed: FAIRWAY_DEMO_UNIVERSE_SEED,
    universeFingerprint: input.fingerprint,
    canonicalClockUtc: FAIRWAY_DEMO_CLOCK_ISO,
    canonicalClockLocal: "2026-07-23 3:00 PM Central Time",
    localTimezone: "America/Chicago",
    resetExecutionId: input.resetExecutionId,
    flowExecutionId: input.flowExecutionId,
    reconciliationPath: input.reconciliationPath,
    structuredAssertions: input.assertions,
    qualityCaptureId: input.qualityCaptureId,
    accessibilityEvidenceId: input.accessibilityEvidenceId,
  });
}

export async function runDu1A11y(page: Page, testInfo: TestInfo, screen: string, persona: string, scenario: string, state: string): Promise<string> {
  const evidenceId = `${testInfo.project.name}:${scenario}:${persona}:${slug(state)}`;
  const analysis = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  appendJson("evidence/accessibility.json", {
    id: evidenceId,
    project: testInfo.project.name,
    screen,
    persona,
    scenario,
    state,
    violationCount: analysis.violations.length,
    violations: analysis.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      nodes: item.nodes.slice(0, 5).map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
    })),
  });
  expect(analysis.violations, `${screen} accessibility findings`).toEqual([]);
  return evidenceId;
}

export function flushQuality(name: string, capture: QualityCapture): void {
  const file = path.join(root, "evidence", "quality", `${slug(name)}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(capture, null, 2)}\n`);
  expect(capture.consoleErrors, `${name} console errors`).toEqual([]);
  expect(capture.unexpectedNetworkFailures, `${name} unexpected network failures`).toEqual([]);
}

export function resetEvidenceFiles(): void {
  for (const file of ["evidence/screenshot-manifest.json", "evidence/accessibility.json"]) {
    const absolute = path.join(root, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, "[]\n");
  }
}

export function writeReconciliation(relative: string, value: unknown): string {
  const packageRelative = path.join("runtime", relative).replaceAll("\\", "/");
  const file = path.join(root, packageRelative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return packageRelative;
}

function appendJson(relative: string, value: unknown): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  let current: unknown[] = [];
  try { current = JSON.parse(readFileSync(file, "utf8")); } catch { current = []; }
  current.push(value);
  writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for DU1 review evidence.`);
  return value;
}

function sanitize(value: string): string {
  return value
    .replace(/([?&](?:__clerk_db_jwt|token|ticket|session|jwt)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/g, "[redacted]");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

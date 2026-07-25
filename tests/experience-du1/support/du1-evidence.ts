import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join("artifacts", "du1-remediation-review");

export type QualityCapture = {
  consoleErrors: Array<{ text: string; location: string }>;
  expectedCancellations: Array<{ url: string; failure: string }>;
  unexpectedNetworkFailures: Array<{ url: string; failure: string }>;
};

export function startQualityCapture(page: Page): QualityCapture {
  const result: QualityCapture = { consoleErrors: [], expectedCancellations: [], unexpectedNetworkFailures: [] };
  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push({ text: sanitize(message.text()), location: sanitize(message.location().url) });
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const item = { url: sanitize(request.url()), failure };
    const expectedRouteAbort = /^https?:\/\/localhost:3100\/(?:$|facilities\/?$)/.test(request.url());
    if (/(ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|aborted)/i.test(failure) && (request.method() === "GET" || expectedRouteAbort)) result.expectedCancellations.push(item);
    else result.unexpectedNetworkFailures.push(item);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) result.unexpectedNetworkFailures.push({ url: sanitize(response.url()), failure: `HTTP ${response.status()}` });
  });
  return result;
}

export async function captureDu1Screen(page: Page, testInfo: TestInfo, input: {
  order: number;
  screen: string;
  persona: string;
  scenario: string;
  state: string;
  fingerprint: string;
  resetExecutionId: string;
  reconciliationPath: string;
  assertions: string[];
}): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const viewport = testInfo.project.name;
  const actualViewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio }));
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
    scenario: input.scenario,
    state: input.state,
    viewport,
    actualViewport,
    screenshotPixels: { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) },
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.length,
    universeFingerprint: input.fingerprint,
    resetExecutionId: input.resetExecutionId,
    canonicalClockUtc: "2026-07-23T20:00:00.000Z",
    canonicalClockLocal: "2026-07-23 3:00 PM Central Time",
    reconciliationPath: input.reconciliationPath,
    assertions: input.assertions,
  });
}

export async function runDu1A11y(page: Page, testInfo: TestInfo, screen: string, persona: string, scenario: string): Promise<void> {
  const analysis = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  appendJson("evidence/accessibility.json", {
    project: testInfo.project.name,
    screen,
    persona,
    scenario,
    violationCount: analysis.violations.length,
    violations: analysis.violations.map((item) => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.slice(0, 5).map((node) => ({ target: node.target, failureSummary: node.failureSummary })) })),
  });
  expect(analysis.violations, `${screen} accessibility findings`).toEqual([]);
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

function appendJson(relative: string, value: unknown): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  let current: unknown[] = [];
  try { current = JSON.parse(readFileSync(file, "utf8")); } catch { current = []; }
  current.push(value);
  writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
}

function sanitize(value: string): string {
  return value
    .replace(/([?&](?:__clerk_db_jwt|token|ticket|session|jwt)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/g, "[redacted]");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

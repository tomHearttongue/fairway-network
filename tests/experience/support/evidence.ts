import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import type { PersonaKey } from "./personas";

const evidenceRoot = path.join("artifacts", "ux-review", "evidence");
const screenshotRoot = path.join("artifacts", "ux-review", "screenshots");

type ScreenshotMetadata = {
  file: string;
  screen: string;
  route: string;
  persona: PersonaKey;
  viewport: string;
  state: string;
  prdRequirementIds: string[];
  principles: string[];
  capability: string;
};

type QualityCapture = {
  consoleErrors: Array<{ type: string; text: string; location?: string; screen?: string }>;
  failedRequests: Array<{ url: string; method: string; failure: string; status?: number; screen?: string }>;
};

export function viewportName(testInfo: TestInfo): string {
  return testInfo.project.name.replace(/^review-/, "").replace(/^smoke-/, "smoke-");
}

export function startQualityCapture(page: Page): QualityCapture {
  const capture: QualityCapture = { consoleErrors: [], failedRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error") capture.consoleErrors.push({ type: message.type(), text: message.text(), location: message.location().url });
  });
  page.on("requestfailed", (request) => {
    capture.failedRequests.push({ url: sanitizeUrl(request.url()), method: request.method(), failure: request.failure()?.errorText ?? "unknown" });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) capture.failedRequests.push({ url: sanitizeUrl(response.url()), method: response.request().method(), failure: `HTTP ${status}`, status });
  });
  return capture;
}

export function flushQualityCapture(name: string, capture: QualityCapture): void {
  mkdirSync(evidenceRoot, { recursive: true });
  writeJson(path.join(evidenceRoot, `${safeName(name)}-quality.json`), capture);
}

export async function captureScreen(page: Page, testInfo: TestInfo, metadata: Omit<ScreenshotMetadata, "file" | "viewport"> & { order: number }): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const viewport = viewportName(testInfo);
  const fileName = `${String(metadata.order).padStart(2, "0")}-${safeName(metadata.screen)}.png`;
  const relativeFile = path.join(metadata.persona, viewport, fileName).replaceAll("\\", "/");
  const absoluteFile = path.join(screenshotRoot, relativeFile);
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  await page.screenshot({ path: absoluteFile, fullPage: true });
  appendManifest("screenshot-manifest.json", { ...metadata, viewport, file: `screenshots/${relativeFile}` });
}

export async function runA11y(page: Page, testInfo: TestInfo, screen: string, persona: PersonaKey): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  appendManifest("accessibility-findings.json", {
    project: testInfo.project.name,
    viewport: viewportName(testInfo),
    screen,
    persona,
    route: page.url().replace(/^https?:\/\/[^/]+/, ""),
    violationCount: results.violations.length,
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      nodes: violation.nodes.slice(0, 5).map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
    })),
  });
}

export async function expectResponsiveBasics(page: Page, label: string): Promise<void> {
  const basics = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      unlabeledButtons: buttons.filter((button) => !(button.innerText.trim() || button.getAttribute("aria-label") || button.getAttribute("title"))).length,
      unlabeledInputs: inputs.filter((input) => !(input.labels?.length || input.getAttribute("aria-label") || input.getAttribute("placeholder"))).length,
    };
  });
  expect(basics.overflow, `${label} should not horizontally overflow`).toBeLessThanOrEqual(2);
  expect(basics.unlabeledButtons, `${label} should not have unlabeled buttons`).toBe(0);
  expect(basics.unlabeledInputs, `${label} should not have unlabeled form controls`).toBe(0);
}

export function writeReviewNote(name: string, value: unknown): void {
  mkdirSync(evidenceRoot, { recursive: true });
  writeJson(path.join(evidenceRoot, `${safeName(name)}.json`), value);
}

function appendManifest(fileName: string, entry: unknown): void {
  mkdirSync(evidenceRoot, { recursive: true });
  const filePath = path.join(evidenceRoot, fileName);
  let entries: unknown[] = [];
  try { entries = JSON.parse(readFileSync(filePath, "utf8")); } catch { entries = []; }
  entries.push(entry);
  writeJson(filePath, entries);
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sanitizeUrl(value: string): string {
  return value.replace(/([?&](?:__clerk_db_jwt|token|ticket|session|jwt)=)[^&]+/gi, "$1[redacted]");
}
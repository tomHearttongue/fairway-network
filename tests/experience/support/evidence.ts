import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import type { PersonaKey } from "./personas";

const evidenceRoot = path.join("artifacts", "ux-review", "evidence");
const screenshotRoot = path.join("artifacts", "ux-review", "screenshots");

type ReviewPersona = PersonaKey | "unauthenticated";

type ScreenshotMetadata = {
  file: string;
  screenshotKind: "viewport";
  screen: string;
  route: string;
  persona: ReviewPersona;
  viewport: string;
  state: string;
  prdRequirementIds: string[];
  principles: string[];
  capability: string;
};

type NetworkEvidence = { url: string; method: string; failure: string; status?: number; classification: "expected-cancellation" | "unexpected-failure"; screen?: string };

type QualityCapture = {
  consoleErrors: Array<{ type: string; text: string; location?: string; screen?: string }>;
  expectedConsoleMessages: Array<{ type: string; text: string; location?: string; classification: "expected-dev-auth-noise" | "expected-navigation-fallback" }>;
  expectedRequestCancellations: NetworkEvidence[];
  unexpectedNetworkFailures: NetworkEvidence[];
};

export function viewportName(testInfo: TestInfo): string {
  return testInfo.project.name.replace(/^review-/, "").replace(/^smoke-/, "smoke-");
}

export function startQualityCapture(page: Page): QualityCapture {
  const capture: QualityCapture = { consoleErrors: [], expectedConsoleMessages: [], expectedRequestCancellations: [], unexpectedNetworkFailures: [] };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const entry = { type: message.type(), text: sanitizeText(message.text()), location: sanitizeUrl(message.location().url) };
    const classification = expectedConsoleClassification(entry);
    if (classification) capture.expectedConsoleMessages.push({ ...entry, classification });
    else capture.consoleErrors.push(entry);
  });
  page.on("requestfailed", (request) => {
    const evidence = { url: sanitizeUrl(request.url()), method: request.method(), failure: request.failure()?.errorText ?? "unknown" };
    if (isExpectedCancellation(evidence)) capture.expectedRequestCancellations.push({ ...evidence, classification: "expected-cancellation" });
    else capture.unexpectedNetworkFailures.push({ ...evidence, classification: "unexpected-failure" });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) capture.unexpectedNetworkFailures.push({ url: sanitizeUrl(response.url()), method: response.request().method(), failure: `HTTP ${status}`, status, classification: "unexpected-failure" });
  });
  return capture;
}

export function flushQualityCapture(name: string, capture: QualityCapture): void {
  mkdirSync(evidenceRoot, { recursive: true });
  writeJson(path.join(evidenceRoot, `${safeName(name)}-quality.json`), capture);
}

export async function captureScreen(page: Page, testInfo: TestInfo, metadata: Omit<ScreenshotMetadata, "file" | "viewport" | "screenshotKind"> & { order: number }): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const viewport = viewportName(testInfo);
  const fileName = `${String(metadata.order).padStart(2, "0")}-${safeName(metadata.screen)}.png`;
  const relativeFile = path.join(metadata.persona, viewport, fileName).replaceAll("\\", "/");
  const absoluteFile = path.join(screenshotRoot, relativeFile);
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  await page.screenshot({ path: absoluteFile, fullPage: false });
  appendManifest("screenshot-manifest.json", { ...metadata, screenshotKind: "viewport", viewport, file: `screenshots/${relativeFile}` });
}

export async function runA11y(page: Page, testInfo: TestInfo, screen: string, persona: ReviewPersona): Promise<void> {
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
    const isVisible = (element: HTMLElement) => Boolean(((element as any).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? (element.offsetWidth || element.offsetHeight || element.getClientRects().length)));
    const isThirdPartyAuthControl = (element: HTMLElement) => Boolean(element.closest(".cl-rootBox, .cl-userButtonBox, [class*=\"cl-\"], [data-clerk-element], [data-clerk-component]"));
    const hasAccessibleName = (element: HTMLElement) => Boolean(
      element.innerText.trim() ||
      element.textContent?.trim() ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("aria-labelledby") ||
      element.querySelector("img[alt]")?.getAttribute("alt") ||
      element.querySelector("svg title")?.textContent?.trim(),
    );
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("main button, nav button"));
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      unlabeledButtons: buttons.filter((button) => isVisible(button) && !isThirdPartyAuthControl(button) && !hasAccessibleName(button)).length,
      unlabeledButtonSamples: buttons
        .filter((button) => isVisible(button) && !isThirdPartyAuthControl(button) && !hasAccessibleName(button))
        .slice(0, 5)
        .map((button) => button.outerHTML.replace(/\s+/g, " ").slice(0, 250)),
      unlabeledInputs: inputs.filter((input) => isVisible(input) && !(input.labels?.length || input.getAttribute("aria-label") || input.getAttribute("placeholder"))).length,
    };
  });
  expect(basics.overflow, `${label} should not horizontally overflow`).toBeLessThanOrEqual(2);
  expect(basics.unlabeledButtons, `${label} should not have unlabeled Fairway-owned buttons: ${JSON.stringify(basics.unlabeledButtonSamples)}`).toBe(0);
  expect(basics.unlabeledInputs, `${label} should not have unlabeled form controls`).toBe(0);
}

export function writeReviewNote(name: string, value: unknown): void {
  mkdirSync(evidenceRoot, { recursive: true });
  writeJson(path.join(evidenceRoot, `${safeName(name)}.json`), value);
}

function isExpectedCancellation(input: { url: string; method: string; failure: string }): boolean {
  if (!/(ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|aborted)/i.test(input.failure)) return false;
  if (/localhost:3000\/(?:$|\?|api\/member\/availability|_next\/static|__nextjs_font)/.test(input.url)) return true;
  return input.method === "GET" && /https:\/\/img\.clerk\.com\//.test(input.url);
}

function expectedConsoleClassification(input: { text: string; location?: string }): "expected-dev-auth-noise" | "expected-navigation-fallback" | null {
  if (/Cookie .+ has been rejected for invalid domain/i.test(input.text) && /clerk\.accounts\.dev/.test(input.location ?? input.text)) return "expected-dev-auth-noise";
  if (/Failed to fetch RSC payload/i.test(input.text) && /Falling back to browser navigation/i.test(input.text)) return "expected-navigation-fallback";
  return null;
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
  return value
    .replace(/([?&](?:__clerk_db_jwt|token|ticket|session|jwt)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\/sessions\/sess_[^/?\s]+/gi, "/sessions/[redacted-session]")
    .replace(/\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/g, "[redacted-token]");
}

function sanitizeText(value: string): string {
  return sanitizeUrl(value).replace(/\b(?:dvb|sess)_[A-Za-z0-9_-]+\b/g, "[redacted-token]");
}

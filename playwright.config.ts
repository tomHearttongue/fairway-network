import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices, type Project } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const webkitExecutable = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", "webkit-2311", "Playwright.exe");
const webkitAvailable = existsSync(webkitExecutable);
if (!webkitAvailable) {
  mkdirSync("artifacts/ux-review/evidence", { recursive: true });
  writeFileSync("artifacts/ux-review/evidence/webkit-environment.json", JSON.stringify({ status: "unavailable", reason: "Playwright WebKit executable is not present on this Windows dev machine. Chromium and Firefox smoke coverage still runs; WebKit should be enabled automatically when the executable exists." }, null, 2));
}

const projects: Project[] = [
  {
    name: "review-mobile-primary",
    testMatch: /.*(golden-review|persona-gallery)\.spec\.ts/,
    use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
  },
  {
    name: "review-mobile-compact",
    testMatch: /.*golden-review\.spec\.ts/,
    use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
  },
  {
    name: "review-desktop",
    testMatch: /.*golden-review\.spec\.ts/,
    use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
  },
  {
    name: "review-presentation",
    testMatch: /.*golden-review\.spec\.ts/,
    use: { browserName: "chromium", viewport: { width: 1600, height: 900 } },
  },
  {
    name: "smoke-chromium",
    testMatch: /.*cross-browser-smoke\.spec\.ts/,
    use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
  },
  {
    name: "smoke-firefox",
    testMatch: /.*cross-browser-smoke\.spec\.ts/,
    use: { browserName: "firefox", viewport: { width: 390, height: 844 } },
  },
];

if (webkitAvailable) {
  projects.push({
    name: "smoke-webkit",
    testMatch: /.*cross-browser-smoke\.spec\.ts/,
    use: { browserName: "webkit", viewport: { width: 390, height: 844 } },
  });
}

export default defineConfig({
  testDir: "./tests/experience",
  outputDir: "./artifacts/playwright/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/experience/support/global-setup.ts",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/playwright/results.json" }],
    ["html", { outputFolder: "artifacts/playwright/playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects,
});
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/experience-du1",
  globalSetup: "./tests/experience-du1/support/global-setup.ts",
  outputDir: "./artifacts/du1-remediation-r2-review/playwright/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/du1-remediation-r2-review/playwright/results.json" }],
    ["html", { outputFolder: "artifacts/du1-remediation-r2-review/playwright/report", open: "never" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    browserName: "chromium",
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "mobile-primary", use: { viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "presentation", use: { viewport: { width: 1600, height: 900 } } },
  ],
});

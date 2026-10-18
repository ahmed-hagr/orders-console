import { defineConfig } from "@playwright/test";

/**
 * Browser tests against the real app. Needs MongoDB running and seeded (npm run seed).
 * Uses the installed Google Chrome; set PW_CHANNEL=chromium after `npx playwright install chromium` to use Playwright's own.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    channel: process.env.PW_CHANNEL || "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  // Starts API + web if they aren't already running; reuses them if they are.
  webServer: {
    command: "npm run dev",
    cwd: "../..",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

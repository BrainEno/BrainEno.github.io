import { defineConfig } from "@playwright/test";

// Run against the domain-root production export, not the development server.
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: ".qa/browser-results",
  use: {
    baseURL: "http://127.0.0.1:3311",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: "node scripts/preview.mjs",
    env: { PORT: "3311", HOST: "127.0.0.1" },
    url: "http://127.0.0.1:3311/",
  },
});

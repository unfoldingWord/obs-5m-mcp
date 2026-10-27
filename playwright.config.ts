import { defineConfig } from "@playwright/test";

// Smoke test of the built site against the local Worker.
// Run `npm run build:web` first; `npm run test:e2e` starts `wrangler dev`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:8790" },
  webServer: {
    command: "npx wrangler dev --port 8790",
    url: "http://127.0.0.1:8790/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

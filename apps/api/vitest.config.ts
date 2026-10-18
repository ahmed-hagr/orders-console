import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      MONGO_URI: "mongodb://set-by-test-helper",
      JWT_SECRET: "test-secret-that-is-definitely-longer-than-32-chars",
      JWT_TTL: "1h",
      STATS_DELAY_MIN_MS: "0",
      STATS_DELAY_MAX_MS: "0",
      LOGIN_RATE_LIMIT: "1000",
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000, // first run downloads a mongod binary
  },
});

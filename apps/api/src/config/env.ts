import { existsSync } from "node:fs";
import { z } from "zod";

// Load apps/api/.env when present. Real deployments pass env vars directly.
if (existsSync(".env")) process.loadEnvFile(".env");

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  // No default on purpose: the contractor's hard-coded secret is exactly what we're removing.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "JWT_TTL must look like 30m, 8h or 1d")
    .default("8h"),
  PORT: z.coerce.number().int().default(4000),
  STATS_DELAY_MIN_MS: z.coerce.number().int().min(0).default(3000),
  STATS_DELAY_MAX_MS: z.coerce.number().int().min(0).default(6000),
  /** 0..1. Share of stats calls that fail with 503, to show the error state. Keep 0 outside demos. */
  STATS_FAIL_RATE: z.coerce.number().min(0).max(1).default(0),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment. Copy .env.example to apps/api/.env and fix:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

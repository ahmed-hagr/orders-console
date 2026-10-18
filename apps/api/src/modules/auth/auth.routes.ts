import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.ts";
import { requireAuth } from "../../middleware/requireAuth.ts";
import * as ctrl from "./auth.controller.ts";

export function authRouter() {
  const router = Router();
  // Created per app instance so each test app gets its own counter.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.LOGIN_RATE_LIMIT,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "rate_limited", message: "Too many sign-in attempts. Try again in 15 minutes" },
  });

  router.post("/login", loginLimiter, ctrl.login);
  router.post("/logout", ctrl.logout);
  router.get("/me", requireAuth, ctrl.me);
  return router;
}

import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes.ts";
import { errorHandler, notFound } from "./middleware/errorHandler.ts";

/** Builds the app without listening, so tests and scripts use the real middleware chain. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple"); // no nested objects from ?a[b]=c
  app.use(helmet());
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter());

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}

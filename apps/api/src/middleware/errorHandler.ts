import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { HttpError } from "../lib/httpError.ts";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "not_found", message: "No such endpoint" });
}

// Express 5 forwards rejected promises from async handlers here.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return res.status(400).json({ error: "validation_failed", message: "Some fields are invalid", fields });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message, fields: err.fields });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: "bad_id", message: `Invalid ${err.path}` });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "bad_json", message: "Request body is not valid JSON" });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: "internal", message: "Something went wrong on our side" });
}

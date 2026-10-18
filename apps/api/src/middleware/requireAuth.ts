import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.ts";
import { User } from "../modules/auth/user.model.ts";

export const SESSION_COOKIE = "oc_session";

interface SessionClaims {
  sub: string;
}

/**
 * Replaces the contractor's middleware:
 * - token only from the httpOnly cookie, never from the query string
 * - jwt.verify (signature + exp) with the algorithm pinned, instead of jwt.decode
 * - role read from the database, so a demoted or deleted user loses access at once
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) {
    return res.status(401).json({ error: "unauthenticated", message: "Sign in to continue" });
  }

  let claims: SessionClaims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as SessionClaims;
  } catch {
    return res.status(401).json({ error: "unauthenticated", message: "Your session expired. Sign in again" });
  }

  const user = await User.findById(claims.sub).select("email role").lean();
  if (!user) {
    return res.status(401).json({ error: "unauthenticated", message: "Sign in to continue" });
  }

  req.user = { id: String(user._id), role: user.role, email: user.email };
  next();
}

import type { CookieOptions, Request, Response } from "express";
import { LoginInput } from "@oc/shared";
import ms from "./ttl.ts";
import { env, isProd } from "../../config/env.ts";
import { SESSION_COOKIE } from "../../middleware/requireAuth.ts";
import * as auth from "./auth.service.ts";

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "strict",
  secure: isProd,
  path: "/api",
  maxAge: ms(env.JWT_TTL),
});

export async function login(req: Request, res: Response) {
  const input = LoginInput.parse(req.body);
  const { token, user } = await auth.login(input);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.json({ user });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await auth.getUser(req.user!.id);
  res.json({ user });
}

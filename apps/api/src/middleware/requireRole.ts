import type { NextFunction, Request, Response } from "express";
import type { Role } from "@oc/shared";

/** Server-side role check. The React AdminOnly component is only a usability hint. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden", message: "You don't have permission to do this" });
    }
    next();
  };

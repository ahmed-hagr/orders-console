import type { Role } from "@oc/shared";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; email: string };
    }
  }
}

export {};

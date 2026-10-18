import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.ts";
import { requireRole } from "../../middleware/requireRole.ts";
import * as ctrl from "./orders.controller.ts";

export function ordersRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get("/", ctrl.list);
  router.get("/stats", ctrl.stats);
  router.post("/", ctrl.create);
  router.delete("/:id", requireRole("admin"), ctrl.remove);
  return router;
}

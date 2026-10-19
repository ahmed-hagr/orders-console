import type { Request, Response } from "express";
import { CreateOrderInput, IDEMPOTENCY_HEADER, IdempotencyKey, ListOrdersQuery } from "@oc/shared";
import { env } from "../../config/env.ts";
import { HttpError } from "../../lib/httpError.ts";
import * as orders from "./orders.service.ts";

export async function list(req: Request, res: Response) {
  const query = ListOrdersQuery.parse(req.query);
  res.json(await orders.listOrders(query));
}

export async function create(req: Request, res: Response) {
  const parsedKey = IdempotencyKey.safeParse(req.get(IDEMPOTENCY_HEADER));
  if (!parsedKey.success) {
    throw new HttpError(400, "idempotency_key_required", `Send a UUID in the ${IDEMPOTENCY_HEADER} header`);
  }
  const input = CreateOrderInput.parse(req.body);
  const { order, replayed } = await orders.createOrder(input, req.user!.id, parsedKey.data);
  res.setHeader("Idempotent-Replayed", String(replayed));
  res.status(replayed ? 200 : 201).json({ order, replayed });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await orders.softDeleteOrder(req.params.id, req.user!.id);
  res.status(204).end();
}

/** O1: deliberately slow. Stops early, without querying, if the client goes away. */
export async function stats(req: Request, res: Response) {
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });
  const stats = await orders.getStatsWithDelay(
    { minMs: env.STATS_DELAY_MIN_MS, maxMs: env.STATS_DELAY_MAX_MS, failRate: env.STATS_FAIL_RATE },
    abort.signal,
  );
  res.json(stats);
}

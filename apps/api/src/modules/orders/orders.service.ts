import { Types } from "mongoose";
import {
  ORDER_STATUSES,
  toMinor,
  type CreateOrderParsed,
  type ListOrdersParsed,
  type OrderDTO,
  type OrderStats,
  type Page,
} from "@oc/shared";
import { HttpError } from "../../lib/httpError.ts";
import { hashBody } from "../../lib/requestHash.ts";
import { nextOrderNumber } from "./counter.model.ts";
import { cursorFilter, encodeCursor, sortSpec } from "./cursor.ts";
import { toOrderDTO } from "./order.mapper.ts";
import { Order, tokenizeName, type OrderDoc } from "./order.model.ts";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listOrders(q: ListOrdersParsed): Promise<Page<OrderDTO>> {
  const and: Record<string, unknown>[] = [{ deletedAt: null }];
  if (q.status) and.push({ status: q.status });
  if (q.q) {
    const prefix = new RegExp(`^${escapeRegex(q.q.toLowerCase())}`);
    and.push({ $or: [{ nameTokens: prefix }, { email: prefix }] });
  }
  if (q.cursor) and.push(cursorFilter(q.sort, q.cursor));

  const { field, dir } = sortSpec(q.sort);
  const rows = await Order.find({ $and: and })
    .sort({ [field]: dir, _id: dir })
    .limit(q.limit + 1) // one extra row tells us whether a next page exists
    .lean<OrderDoc[]>();

  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page.map(toOrderDTO),
    nextCursor: rows.length > q.limit && last ? encodeCursor(q.sort, last) : null,
  };
}

export interface CreateResult {
  order: OrderDTO;
  replayed: boolean;
}

const isDuplicateKey = (err: unknown, field: string): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: number }).code === 11000 &&
  field in ((err as { keyPattern?: object }).keyPattern ?? {});

async function replay(userId: Types.ObjectId, key: string, bodyHash: string): Promise<CreateResult | null> {
  const existing = await Order.findOne({ createdBy: userId, idempotencyKey: key }).lean<OrderDoc>();
  if (!existing) return null;
  if (existing.bodyHash !== bodyHash) {
    throw new HttpError(422, "idempotency_key_reused", "This Idempotency-Key was already used for a different order");
  }
  return { order: toOrderDTO(existing), replayed: true };
}

/**
 * Creates an order at most once per (user, idempotency key).
 * The unique index is the guarantee; the findOne before inserting only saves an order number on plain retries.
 */
export async function createOrder(input: CreateOrderParsed, userIdStr: string, key: string): Promise<CreateResult> {
  const userId = new Types.ObjectId(userIdStr);
  const bodyHash = hashBody(input);

  const earlier = await replay(userId, key, bodyHash);
  if (earlier) return earlier;

  const items = input.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceMinor: toMinor(i.unitPrice) }));
  const totalMinor = items.reduce((sum, i) => sum + i.quantity * i.unitPriceMinor, 0);

  try {
    const doc = await Order.create({
      orderNumber: await nextOrderNumber(),
      customerName: input.customerName,
      nameTokens: tokenizeName(input.customerName),
      email: input.email,
      phone: input.phone,
      status: "pending",
      items,
      totalMinor,
      createdBy: userId,
      idempotencyKey: key,
      bodyHash,
    });
    return { order: toOrderDTO(doc.toObject() as OrderDoc), replayed: false };
  } catch (err) {
    // A parallel request with the same key won the insert. Return its order instead.
    if (!isDuplicateKey(err, "idempotencyKey")) throw err;
    const winner = await replay(userId, key, bodyHash);
    if (!winner) throw err;
    return winner;
  }
}

export async function softDeleteOrder(id: string, userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, "bad_id", "Invalid order id");
  const res = await Order.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: new Types.ObjectId(userId) } },
  );
  if (res.matchedCount === 0) throw new HttpError(404, "not_found", "Order not found or already deleted");
}

/** Midnight in Asia/Riyadh (UTC+3, no DST) as a UTC Date. */
export const startOfRiyadhDay = (now = new Date()): Date => {
  const offset = 3 * 3_600_000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
};

export async function getStats(): Promise<OrderStats> {
  const since = startOfRiyadhDay();
  const [result] = await Order.aggregate<{
    byStatus: { _id: string; n: number }[];
    today: { total: number }[];
  }>([
    { $match: { deletedAt: null } },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
        today: [
          { $match: { createdAt: { $gte: since }, status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: "$totalMinor" } } },
        ],
      },
    },
  ]);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as OrderStats["byStatus"];
  for (const row of result?.byStatus ?? []) byStatus[row._id as keyof typeof byStatus] = row.n;
  return { byStatus, revenueTodayMinor: result?.today[0]?.total ?? 0, since: since.toISOString() };
}

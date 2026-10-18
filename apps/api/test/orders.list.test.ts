import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import type TestAgent from "supertest/lib/agent";
import type { OrderDTO, OrderSort } from "@oc/shared";
import { Order, tokenizeName } from "../src/modules/orders/order.model.ts";
import { AGENT, loginAs, seedUsers, startTestApp } from "./helpers.ts";

let ctx: Awaited<ReturnType<typeof startTestApp>>;
let agent: TestAgent;
const N = 237;
const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
const NAMES = ["Noura Al-Harbi", "Faisal Al-Otaibi", "Reem Al-Dosari", "Omar Al-Ghamdi"];

beforeAll(async () => {
  ctx = await startTestApp();
  await seedUsers();
  agent = await loginAs(ctx.app, AGENT);
  const base = Date.UTC(2026, 9, 1);
  await Order.collection.insertMany(
    Array.from({ length: N }, (_, i) => {
      const name = NAMES[i % NAMES.length]!;
      return {
        _id: new Types.ObjectId(),
        orderNumber: i + 1,
        customerName: name,
        nameTokens: tokenizeName(name),
        email: `${name.split(" ")[0]!.toLowerCase()}${i}@example.com`,
        status: STATUSES[i % 5],
        items: [{ name: "x", quantity: 1, unitPriceMinor: 100 }],
        // Many ties on purpose: only 20 distinct timestamps and 7 distinct totals.
        createdAt: new Date(base + (i % 20) * 60_000),
        totalMinor: 1000 * ((i % 7) + 1),
        deletedAt: null,
      };
    }),
  );
  await Order.syncIndexes();
});
afterAll(() => ctx.stop());

async function walk(query: Record<string, string>): Promise<OrderDTO[]> {
  const all: OrderDTO[] = [];
  let cursor: string | null = null;
  do {
    const res: { body: { items: OrderDTO[]; nextCursor: string | null } } = await agent
      .get("/api/orders")
      .query({ ...query, limit: "50", ...(cursor ? { cursor } : {}) })
      .expect(200);
    all.push(...res.body.items);
    cursor = res.body.nextCursor;
  } while (cursor);
  return all;
}

describe("GET /api/orders keyset pagination", () => {
  it.each<OrderSort>(["date_desc", "date_asc", "amount_desc", "amount_asc"])(
    "returns every row exactly once, in order, for %s",
    async (sort) => {
      const rows = await walk({ sort });
      expect(rows).toHaveLength(N);
      expect(new Set(rows.map((r) => r.id)).size).toBe(N);

      const key = (r: OrderDTO) => (sort.startsWith("date") ? Date.parse(r.createdAt) : r.totalMinor);
      const dir = sort.endsWith("asc") ? 1 : -1;
      for (let i = 1; i < rows.length; i++) expect(Math.sign(key(rows[i]!) - key(rows[i - 1]!)) * dir).toBeGreaterThanOrEqual(0);
    },
  );

  it("filters by status across pages", async () => {
    const rows = await walk({ status: "shipped", sort: "amount_desc" });
    expect(rows.length).toBe(Math.ceil((N - 2) / 5));
    expect(rows.every((r) => r.status === "shipped")).toBe(true);
  });

  it("searches by anchored prefix of a name word or the email", async () => {
    const byWord = await walk({ q: "noura" });
    expect(byWord.length).toBeGreaterThan(0);
    expect(byWord.every((r) => r.customerName.startsWith("Noura"))).toBe(true);
    expect((await walk({ q: "al-harbi" })).length).toBe(byWord.length);
    expect((await walk({ q: "oura" })).length).toBe(0); // anchored, so it can use the index
    expect((await walk({ q: "faisal1" })).every((r) => r.email.startsWith("faisal1"))).toBe(true);
  });

  it("treats regex characters in the search as plain text", async () => {
    await agent.get("/api/orders").query({ q: ".*" }).expect(200).then((r) => expect(r.body.items).toHaveLength(0));
  });

  it("rejects a tampered cursor or one from another sort", async () => {
    await agent.get("/api/orders").query({ cursor: "garbage" }).expect(400);
    const first = await agent.get("/api/orders").query({ sort: "date_desc", limit: "10" }).expect(200);
    await agent.get("/api/orders").query({ sort: "amount_asc", cursor: first.body.nextCursor }).expect(400);
  });

  it("rejects unknown status and out-of-range limit", async () => {
    await agent.get("/api/orders").query({ status: "lost" }).expect(400);
    await agent.get("/api/orders").query({ limit: "5000" }).expect(400);
  });

  it("uses an index for status + sort with no in-memory SORT stage", async () => {
    const explained = (await Order.find({ deletedAt: null, status: "paid" })
      .sort({ createdAt: -1, _id: -1 })
      .limit(51)
      .explain("queryPlanner")) as unknown as { queryPlanner: { winningPlan: unknown } };
    const plan = JSON.stringify(explained.queryPlanner.winningPlan);
    expect(plan).toContain("IXSCAN");
    expect(plan).toContain("status_1_createdAt_-1__id_-1");
    expect(plan).not.toMatch(/"stage":"SORT"/);
  });
});

describe("GET /api/orders/stats", () => {
  it("returns counts by status", async () => {
    const res = await agent.get("/api/orders/stats").expect(200);
    const total = Object.values(res.body.byStatus as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(N);
  });
});

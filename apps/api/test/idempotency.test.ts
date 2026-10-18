import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent";
import { Order } from "../src/modules/orders/order.model.ts";
import { ADMIN, AGENT, loginAs, seedUsers, startTestApp } from "./helpers.ts";

const body = {
  customerName: "Noura Al-Harbi",
  email: "Noura@Example.com",
  items: [
    { name: "Desk lamp", quantity: 2, unitPrice: 149.5 },
    { name: "Kettle", quantity: 1, unitPrice: 89.99 },
  ],
};

let ctx: Awaited<ReturnType<typeof startTestApp>>;
let agent: TestAgent;

beforeAll(async () => {
  ctx = await startTestApp();
  await seedUsers();
  agent = await loginAs(ctx.app, AGENT);
});
afterAll(() => ctx.stop());
beforeEach(() => Order.deleteMany({}));

const post = (key: string | undefined, payload: object = body, as = agent) => {
  const req = as.post("/api/orders").send(payload);
  return key ? req.set("Idempotency-Key", key) : req;
};

describe("POST /api/orders idempotency", () => {
  it("creates exactly one order when the same request is fired twice in parallel", async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([post(key), post(key)]);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.order.id).toBe(b.body.order.id);
    expect(await Order.countDocuments({ idempotencyKey: key })).toBe(1);
  });

  it("still creates one order under 10 parallel retries", async () => {
    const key = randomUUID();
    const res = await Promise.all(Array.from({ length: 10 }, () => post(key)));

    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(res.map((r) => r.body.order.id)).size).toBe(1);
    expect(await Order.countDocuments({})).toBe(1);
  });

  it("replays the first response on a later retry", async () => {
    const key = randomUUID();
    const first = await post(key).expect(201);
    const retry = await post(key).expect(200);

    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.body.order).toEqual(first.body.order);
  });

  it("rejects the same key with a different body", async () => {
    const key = randomUUID();
    await post(key).expect(201);
    const res = await post(key, { ...body, customerName: "Someone Else" }).expect(422);

    expect(res.body.error).toBe("idempotency_key_reused");
    expect(await Order.countDocuments({})).toBe(1);
  });

  it("requires a UUID Idempotency-Key", async () => {
    await post(undefined).expect(400);
    await post("not-a-uuid").expect(400);
    expect(await Order.countDocuments({})).toBe(0);
  });

  it("scopes keys per user, so two agents can't collide", async () => {
    const key = randomUUID();
    const admin = await loginAs(ctx.app, ADMIN);
    await post(key).expect(201);
    await post(key, body, admin).expect(201);
    expect(await Order.countDocuments({ idempotencyKey: key })).toBe(2);
  });

  it("recalculates the total on the server in halalas and normalises the email", async () => {
    const res = await post(randomUUID(), { ...body, totalMinor: 1 }).expect(201);
    expect(res.body.order.totalMinor).toBe(2 * 14950 + 8999);
    expect(res.body.order.email).toBe("noura@example.com");
  });

  it("validates the body on the server", async () => {
    const res = await post(randomUUID(), { customerName: "N", email: "nope", items: [] }).expect(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(["customerName", "email", "items"]));
  });
});

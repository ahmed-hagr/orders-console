import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Order } from "../src/modules/orders/order.model.ts";
import { ADMIN, AGENT, loginAs, seedUsers, startTestApp } from "./helpers.ts";

let ctx: Awaited<ReturnType<typeof startTestApp>>;
let ids: Awaited<ReturnType<typeof seedUsers>>;
const SECRET = process.env.JWT_SECRET!;

beforeAll(async () => {
  ctx = await startTestApp();
  ids = await seedUsers();
});
afterAll(async () => {
  await ctx?.stop();
});

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const withCookie = (token: string) => request(ctx.app).get("/api/orders").set("Cookie", `oc_session=${token}`);

describe("auth fixes from the code review", () => {
  it("rejects requests without a session", async () => {
    await request(ctx.app).get("/api/orders").expect(401);
  });

  it("ignores a token passed in the query string", async () => {
    const token = jwt.sign({}, SECRET, { subject: ids.adminId });
    await request(ctx.app).get(`/api/orders?token=${token}`).expect(401);
  });

  it("rejects an unsigned (alg: none) token claiming admin", async () => {
    const forged = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: ids.adminId, role: "admin" })}.`;
    await withCookie(forged).expect(401);
  });

  it("rejects a token signed with the old hard-coded secret", async () => {
    await withCookie(jwt.sign({}, "sarh-secret-2026", { subject: ids.adminId })).expect(401);
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, { subject: ids.adminId });
    await withCookie(expired).expect(401);
  });

  it("blocks NoSQL operator injection in login", async () => {
    await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: ADMIN.email, password: { $ne: null } })
      .expect(400);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const a = await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: ADMIN.email, password: "wrong" })
      .expect(401);
    const b = await request(ctx.app)
      .post("/api/auth/login")
      .send({ email: "nobody@sarh.test", password: "wrong" })
      .expect(401);
    expect(a.body).toEqual(b.body);
  });

  it("sets an httpOnly, SameSite=Strict cookie and never returns the token in the body", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send(AGENT).expect(200);
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
  });

  it("returns 403 when an agent deletes, and lets an admin soft-delete once", async () => {
    const order = await Order.create({
      orderNumber: 1,
      customerName: "Test",
      nameTokens: ["test"],
      email: "t@example.com",
      items: [{ name: "x", quantity: 1, unitPriceMinor: 100 }],
      totalMinor: 100,
    });
    const agent = await loginAs(ctx.app, AGENT);
    const admin = await loginAs(ctx.app, ADMIN);

    await agent.delete(`/api/orders/${order.id}`).expect(403);
    await admin.delete(`/api/orders/${order.id}`).expect(204);
    await admin.delete(`/api/orders/${order.id}`).expect(404);
    await admin.delete("/api/orders/not-an-id").expect(400);

    const stored = await Order.findById(order.id).lean();
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(String(stored?.deletedBy)).toBe(ids.adminId);
  });

  it("drops access as soon as the user is removed, even with a valid token", async () => {
    const token = jwt.sign({}, SECRET, { subject: "64b7f0000000000000000000" });
    await withCookie(token).expect(401);
  });
});

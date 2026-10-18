/**
 * R2 proof: fires the same create request twice in parallel and shows exactly one order exists.
 *
 *   npm run prove:idempotency                         (starts the API in-process on a random port)
 *   API_URL=http://localhost:4000 npm run prove:idempotency   (targets a running API)
 *
 * Needs a seeded database (npm run seed).
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { env } from "../src/config/env.ts";
import { connectMongo, disconnectMongo } from "../src/db/mongo.ts";
import { createApp } from "../src/app.ts";
import { Order } from "../src/modules/orders/order.model.ts";

const PARALLEL = Number(process.env.PARALLEL ?? 2);

await connectMongo(env.MONGO_URI);
let base = process.env.API_URL;
let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
if (!base) {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "agent@sarh.test", password: "Agent#2026" }),
});
if (!login.ok) throw new Error(`Login failed (${login.status}). Did you run npm run seed?`);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const key = randomUUID();
const body = JSON.stringify({
  customerName: "Proof Customer",
  email: "proof@example.com",
  items: [{ name: "Desk lamp", quantity: 2, unitPrice: 149.5 }],
});

console.log(`Idempotency-Key: ${key}`);
console.log(`Sending ${PARALLEL} identical POST /api/orders requests in parallel…`);

const responses = await Promise.all(
  Array.from({ length: PARALLEL }, () =>
    fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": key, cookie },
      body,
    }).then(async (r) => ({ status: r.status, body: (await r.json()) as { order?: { id: string; orderNumber: number }; replayed?: boolean } })),
  ),
);

responses.forEach((r, i) =>
  console.log(`  request ${i + 1}: HTTP ${r.status}  order #${r.body.order?.orderNumber}  id ${r.body.order?.id}  replayed=${r.body.replayed}`),
);

const count = await Order.countDocuments({ idempotencyKey: key });
const ids = new Set(responses.map((r) => r.body.order?.id));
const created = responses.filter((r) => r.status === 201).length;
const ok = count === 1 && ids.size === 1 && created === 1;

console.log(`Orders in the database with this key: ${count}`);
console.log(ok ? "PASS: exactly one order was created." : "FAIL: duplicate or missing order.");

server?.close();
await disconnectMongo();
process.exit(ok ? 0 : 1);

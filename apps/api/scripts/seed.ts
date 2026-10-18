/**
 * Seeds 2 users and 50,000 orders. Safe to re-run: it wipes orders, users and the counter first.
 *   npm run seed            (50,000 orders)
 *   SEED_ORDERS=5000 npm run seed
 */
import { Types } from "mongoose";
import { ORDER_STATUSES, type OrderStatus } from "@oc/shared";
import { env } from "../src/config/env.ts";
import { connectMongo, disconnectMongo } from "../src/db/mongo.ts";
import { User } from "../src/modules/auth/user.model.ts";
import { hashPassword } from "../src/modules/auth/auth.service.ts";
import { Order, tokenizeName } from "../src/modules/orders/order.model.ts";
import { setOrderCounter } from "../src/modules/orders/counter.model.ts";

const TOTAL = Number(process.env.SEED_ORDERS ?? 50_000);
const BATCH = 5_000;
const DAYS = 90;

export const SEED_USERS = [
  { email: "admin@sarh.test", name: "Operations Admin", password: "Admin#2026", role: "admin" as const },
  { email: "agent@sarh.test", name: "Phone Agent", password: "Agent#2026", role: "agent" as const },
];

const FIRST = ["Abdullah", "Noura", "Faisal", "Reem", "Omar", "Lama", "Khalid", "Sara", "Yousef", "Hessa", "Majed", "Dana", "Turki", "Maha", "Saad", "Jana", "Nasser", "Lulwa", "Ibrahim", "Ghada", "Fahad", "Amal", "Sultan", "Rania", "Bandar", "Hind", "Mishal", "Nouf", "Ziyad", "Shahad"];
const LAST = ["Al-Harbi", "Al-Qahtani", "Al-Otaibi", "Al-Dosari", "Al-Shehri", "Al-Zahrani", "Al-Ghamdi", "Al-Mutairi", "Al-Subaie", "Al-Anazi", "Al-Shammari", "Al-Rashid", "Al-Juhani", "Al-Malki", "Al-Saud", "Al-Amri"];
const DOMAINS = ["gmail.com", "outlook.sa", "hotmail.com", "icloud.com", "yahoo.com"];
const PRODUCTS = ["Desk lamp", "Office chair", "USB-C hub", "Notebook pack", "Water bottle", "Arabic coffee set", "Prayer mat", "Phone case", "Backpack", "Wireless mouse", "Dates gift box", "Oud perfume", "Kettle", "Bluetooth speaker", "Thobe"];
const STATUS_WEIGHTS: [OrderStatus, number][] = [["pending", 0.15], ["paid", 0.2], ["shipped", 0.2], ["delivered", 0.35], ["cancelled", 0.1]];

// Deterministic so every reviewer gets the same data.
let seed = 20261018;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const pickStatus = (): OrderStatus => {
  let r = rnd();
  for (const [s, w] of STATUS_WEIGHTS) if ((r -= w) < 0) return s;
  return "delivered";
};

function makeOrder(n: number, now: number) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const name = `${first} ${last}`;
  const email = `${first}.${last.replace("Al-", "")}${Math.floor(rnd() * 900) + 100}@${pick(DOMAINS)}`.toLowerCase();
  const items = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({
    name: pick(PRODUCTS),
    quantity: 1 + Math.floor(rnd() * 4),
    unitPriceMinor: Math.round((15 + rnd() * 900) * 100),
  }));
  // Spread over the last 90 days; minutes are truncated so some rows share a timestamp (exercises the _id tie-breaker).
  const createdAt = new Date(Math.floor((now - rnd() * DAYS * 86_400_000) / 60_000) * 60_000);
  return {
    _id: new Types.ObjectId(),
    orderNumber: n,
    customerName: name,
    nameTokens: tokenizeName(name),
    email,
    status: pickStatus(),
    items,
    totalMinor: items.reduce((s, i) => s + i.quantity * i.unitPriceMinor, 0),
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

async function main() {
  const started = Date.now();
  await connectMongo(env.MONGO_URI);
  console.log(`Connected to ${env.MONGO_URI.replace(/\/\/[^@]*@/, "//***@")}`);

  await Promise.all([Order.deleteMany({}), User.deleteMany({})]);

  for (const u of SEED_USERS) {
    await User.create({ email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) });
  }
  console.log(`Users: ${SEED_USERS.map((u) => `${u.email} (${u.role})`).join(", ")}`);

  const now = Date.now();
  for (let done = 0; done < TOTAL; done += BATCH) {
    const size = Math.min(BATCH, TOTAL - done);
    const docs = Array.from({ length: size }, (_, i) => makeOrder(done + i + 1, now));
    // Raw driver insert: skips Mongoose document overhead, which matters at 50k rows.
    await Order.collection.insertMany(docs, { ordered: false });
    process.stdout.write(`\rOrders: ${(done + size).toLocaleString("en-US")} / ${TOTAL.toLocaleString("en-US")}`);
  }
  await setOrderCounter(TOTAL);

  const counts = await Order.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  console.log(`\nBy status: ${ORDER_STATUSES.map((s) => `${s} ${counts.find((c) => c._id === s)?.n ?? 0}`).join(", ")}`);
  console.log(`Indexes: ${(await Order.listIndexes()).map((i) => JSON.stringify(i.key)).join(" ")}`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  await disconnectMongo();
}

await main();

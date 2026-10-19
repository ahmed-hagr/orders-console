import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { connectMongo } from "../src/db/mongo.ts";
import { User } from "../src/modules/auth/user.model.ts";
import { hashPassword } from "../src/modules/auth/auth.service.ts";
import "../src/modules/orders/order.model.ts";

export const ADMIN = { email: "admin@sarh.test", password: "Admin#2026" };
export const AGENT = { email: "agent@sarh.test", password: "Agent#2026" };

const shouldFallbackToExternalMongo = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Operation not permitted") || msg.includes('code "48"');
};

const buildExternalTestUri = (): string => {
  const base = process.env.TEST_MONGO_URI_BASE ?? "mongodb://127.0.0.1:27017";
  const db = `orders_console_test_${randomUUID().replace(/-/g, "")}`;
  return `${base}/${db}`;
};

/** Real mongod (temporary data dir) + the real Express app. */
export async function startTestApp() {
  let mongo: MongoMemoryServer | null = null;
  let usingExternalMongo = false;
  try {
    mongo = await MongoMemoryServer.create();
    await connectMongo(mongo.getUri());
  } catch (err) {
    if (!shouldFallbackToExternalMongo(err)) throw err;
    usingExternalMongo = true;
    await connectMongo(buildExternalTestUri());
  }

  // A real listening server: supertest otherwise attaches listeners to a fresh one per request.
  const app: Server = createApp().listen(0);
  return {
    app,
    async stop() {
      if (usingExternalMongo && mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
      await new Promise((resolve) => app.close(resolve));
      await mongoose.disconnect();
      await mongo?.stop();
    },
  };
}

export async function seedUsers() {
  await User.deleteMany({});
  const [admin, agent] = await Promise.all([
    User.create({ email: ADMIN.email, name: "Admin", role: "admin", passwordHash: await hashPassword(ADMIN.password) }),
    User.create({ email: AGENT.email, name: "Agent", role: "agent", passwordHash: await hashPassword(AGENT.password) }),
  ]);
  return { adminId: String(admin._id), agentId: String(agent._id) };
}

export async function loginAs(app: Server, user: { email: string; password: string }) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send(user).expect(200);
  return agent;
}

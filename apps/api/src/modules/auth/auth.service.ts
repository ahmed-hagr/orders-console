import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { LoginInput, UserDTO } from "@oc/shared";
import { env } from "../../config/env.ts";
import { HttpError } from "../../lib/httpError.ts";
import { User } from "./user.model.ts";

export const BCRYPT_COST = 10;

// Compared against when the email doesn't exist, so both paths take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

export async function login({ email, password }: LoginInput): Promise<{ token: string; user: UserDTO }> {
  // Query by email only (a validated string). The password never goes into the query.
  const user = await User.findOne({ email }).select("+passwordHash").lean();
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "invalid_credentials", "Wrong email or password");

  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_TTL as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
  return { token, user: { id: String(user._id), email: user.email, name: user.name, role: user.role } };
}

export async function getUser(id: string): Promise<UserDTO | null> {
  const user = await User.findById(id).lean();
  return user ? { id: String(user._id), email: user.email, name: user.name, role: user.role } : null;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

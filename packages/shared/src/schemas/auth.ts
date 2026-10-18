import { z } from "zod";

// Both fields must be plain strings. This is what stops a body like
// {"password": {"$ne": null}} from reaching a Mongo query.
export const LoginInput = z.object({
  email: z.string({ error: "Enter your email" }).trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

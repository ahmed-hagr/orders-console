import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "agent"], required: true },
  },
  { timestamps: true },
);

export const User = model("User", UserSchema);

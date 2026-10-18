import { Schema, Types, model, type InferSchemaType } from "mongoose";
import { ORDER_STATUSES } from "@oc/shared";

const LineItemSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    orderNumber: { type: Number, required: true },
    customerName: { type: String, required: true },
    /** Lower-case words of the name plus the whole name, for indexed prefix search. */
    nameTokens: { type: [String], required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: "pending" },
    items: { type: [LineItemSchema], required: true },
    totalMinor: { type: Number, required: true },
    createdBy: { type: Types.ObjectId, ref: "User" },
    idempotencyKey: { type: String },
    bodyHash: { type: String },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// R1: one index per (filter, sort) shape. _id is the tie-breaker the keyset cursor needs.
OrderSchema.index({ createdAt: -1, _id: -1 });
OrderSchema.index({ totalMinor: -1, _id: -1 });
OrderSchema.index({ status: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ status: 1, totalMinor: -1, _id: -1 });
// Anchored prefix regexes (/^term/) on these use index bounds instead of a collection scan.
OrderSchema.index({ email: 1 });
OrderSchema.index({ nameTokens: 1 });

OrderSchema.index({ orderNumber: 1 }, { unique: true });

// R2: the no-duplicates guarantee. Seeded orders have no key, so the partial filter skips them.
OrderSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: Types.ObjectId };
export const Order = model("Order", OrderSchema);

export const tokenizeName = (name: string): string[] => {
  const lower = name.trim().toLowerCase().replace(/\s+/g, " ");
  return [...new Set([lower, ...lower.split(" ")])];
};

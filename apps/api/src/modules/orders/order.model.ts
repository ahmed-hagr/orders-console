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

const ACTIVE_ONLY = { partialFilterExpression: { deletedAt: null } } as const;

// R1 list indexes for active orders only. _id is the keyset tie-breaker.
OrderSchema.index({ createdAt: -1, _id: -1 }, ACTIVE_ONLY);
OrderSchema.index({ totalMinor: -1, _id: -1 }, ACTIVE_ONLY);
OrderSchema.index({ status: 1, createdAt: -1, _id: -1 }, ACTIVE_ONLY);
OrderSchema.index({ status: 1, totalMinor: -1, _id: -1 }, ACTIVE_ONLY);
// Anchored prefix regexes (/^term/) use index bounds; partial keeps index size focused on list paths.
OrderSchema.index({ email: 1 }, ACTIVE_ONLY);
OrderSchema.index({ nameTokens: 1 }, ACTIVE_ONLY);

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

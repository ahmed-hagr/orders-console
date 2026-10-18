import { Schema, model } from "mongoose";

const CounterSchema = new Schema({ _id: String, seq: { type: Number, required: true } });
const Counter = model("Counter", CounterSchema);

/** Atomically reserves the next human-readable order number. */
export async function nextOrderNumber(): Promise<number> {
  const c = await Counter.findOneAndUpdate({ _id: "orders" }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return c.seq;
}

export async function setOrderCounter(seq: number): Promise<void> {
  await Counter.updateOne({ _id: "orders" }, { $set: { seq } }, { upsert: true });
}

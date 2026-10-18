import mongoose from "mongoose";

export async function connectMongo(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  // Build the indexes declared on every registered model before the first query relies on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

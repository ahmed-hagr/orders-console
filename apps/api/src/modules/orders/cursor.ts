import { Types } from "mongoose";
import type { OrderSort } from "@oc/shared";
import { HttpError } from "../../lib/httpError.ts";

export interface SortSpec {
  field: "createdAt" | "totalMinor";
  dir: 1 | -1;
}

export const sortSpec = (sort: OrderSort): SortSpec => ({
  field: sort.startsWith("date") ? "createdAt" : "totalMinor",
  dir: sort.endsWith("asc") ? 1 : -1,
});

interface CursorPayload {
  s: OrderSort;
  v: string | number;
  id: string;
}

export function encodeCursor(sort: OrderSort, row: { _id: Types.ObjectId; createdAt: Date; totalMinor: number }): string {
  const { field } = sortSpec(sort);
  const v = field === "createdAt" ? row.createdAt.toISOString() : row.totalMinor;
  const payload: CursorPayload = { s: sort, v, id: String(row._id) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** Turns a cursor into a filter for "rows strictly after the last row I saw". */
export function cursorFilter(sort: OrderSort, cursor: string): Record<string, unknown> {
  let p: CursorPayload;
  try {
    p = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
  } catch {
    throw new HttpError(400, "bad_cursor", "The page cursor is invalid. Reload the list");
  }
  if (p.s !== sort || !Types.ObjectId.isValid(p.id)) {
    throw new HttpError(400, "bad_cursor", "The page cursor doesn't match the current sort. Reload the list");
  }

  const { field, dir } = sortSpec(sort);
  const value = field === "createdAt" ? new Date(p.v) : Number(p.v);
  if (field === "createdAt" ? Number.isNaN((value as Date).getTime()) : !Number.isFinite(value)) {
    throw new HttpError(400, "bad_cursor", "The page cursor is invalid. Reload the list");
  }
  const op = dir === -1 ? "$lt" : "$gt";
  const id = new Types.ObjectId(p.id);
  return { $or: [{ [field]: { [op]: value } }, { [field]: value, _id: { [op]: id } }] };
}

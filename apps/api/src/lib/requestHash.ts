import { createHash } from "node:crypto";

/** Hash of the validated create body, used to spot a key reused with a different payload. */
export const hashBody = (body: unknown): string => createHash("sha256").update(JSON.stringify(body)).digest("hex");

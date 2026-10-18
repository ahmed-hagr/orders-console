import type { Rule } from "antd/es/form";
import type { z } from "zod";

/** Uses a field of a shared Zod schema as an antd Form rule, so the form and the API validate the same way. */
export const zodRule = (schema: z.ZodType): Rule => ({
  validator: async (_rule, value: unknown) => {
    const result = schema.safeParse(value);
    if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid value");
  },
});

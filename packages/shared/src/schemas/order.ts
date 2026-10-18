import { z } from "zod";

export const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
export const OrderStatus = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const SORTS = ["date_desc", "date_asc", "amount_desc", "amount_asc"] as const;
export const OrderSort = z.enum(SORTS);
export type OrderSort = z.infer<typeof OrderSort>;

export const MAX_ITEMS = 5;

const hasAtMostTwoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

export const LineItemInput = z.object({
  name: z.string().trim().min(1, "Enter the item name").max(80),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(99, "Quantity must be 99 or less"),
  unitPrice: z.coerce
    .number()
    .positive("Price must be above 0")
    .max(100_000, "Price must be 100,000 or less")
    .refine(hasAtMostTwoDecimals, "Use at most two decimals"),
});
export type LineItemInput = z.infer<typeof LineItemInput>;

export const CustomerName = z.string().trim().min(2, "Enter at least 2 characters").max(120);
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email, like name@example.com"));
export const Phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,20}$/, "Enter a phone number with digits only")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const CreateOrderInput = z.object({
  customerName: CustomerName,
  email: Email,
  phone: Phone,
  items: z
    .array(LineItemInput)
    .min(1, "Add at least one item")
    .max(MAX_ITEMS, `An order can have at most ${MAX_ITEMS} items`),
});
export type CreateOrderInput = z.input<typeof CreateOrderInput>;
export type CreateOrderParsed = z.output<typeof CreateOrderInput>;

export const ListOrdersQuery = z.object({
  status: OrderStatus.optional(),
  q: z.string().trim().max(80).optional(),
  sort: OrderSort.default("date_desc"),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListOrdersQuery = z.input<typeof ListOrdersQuery>;
export type ListOrdersParsed = z.output<typeof ListOrdersQuery>;

/** Client-generated key that makes POST /api/orders safe to retry. */
export const IdempotencyKey = z.uuid("Idempotency-Key must be a UUID");
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

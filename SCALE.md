# Scaling to 5 million orders

**Scenario:** 100× today's data, three developers, agents in two countries using the console all day.
The goal is to change only what breaks at that size and keep what still works.

## What I would change

1. **Search.** Today a prefix regex on `nameTokens` or `email` is combined with any sort ([`orders.service.ts`](apps/api/src/modules/orders/orders.service.ts)). At 5M rows a short prefix like "a" matches hundreds of thousands of rows, and MongoDB then has to sort them all for every page (spilling to disk past 100 MB).
   - Fast exact paths: order number, normalised email, and E.164 phone, each on its own index. That's what agents type most when a customer is on the phone.
   - Name search needs at least 3 characters and returns results by relevance, not by an arbitrary sort.
   - If fuzzy name search is truly needed, use a search index (Atlas Search, or a self-hosted engine fed by change streams) instead of regex.

2. **Stats.** `getStats()` runs a `$facet` over every live order on each call. Today the 3–6 s delay is artificial; at 5M rows it would be real. Replace it with a small `daily_stats` collection keyed by `(country, day, status)`. Create and status-change paths `$inc` it in the same request, and a nightly job reconciles it against the source. The endpoint then reads about 30 tiny documents.

3. **Two countries.** "Today" is hard-coded to Asia/Riyadh (`startOfRiyadhDay`).
   - Add a `country` field to orders and a `timezone` to users.
   - Compute "today" per agent.
   - If agents only work their own country's orders, prefix the list indexes with it: `{country, status, createdAt, _id}`. Same keyset design, smaller index ranges.

4. **Hot data vs history.** Soft-deleted rows stay in every index, and `deletedAt: null` is checked after the index scan. Move deleted orders and orders delivered more than 18 months ago into an `orders_archive` collection, so the indexes agents hit cover only live work. Clear `idempotencyKey` and `bodyHash` after 7 days (a nightly `$unset`); a retry never arrives a week later, and the unique index shrinks.

5. **Operations.** Run a three-node replica set for failover; today's single node is a single point of failure. Keep list and create reads on the primary, because an agent must see the order they just made. Send stats and reports to a secondary. Turn on the slow-query log and keep the test that asserts the winning query plan ([`orders.list.test.ts`](apps/api/test/orders.list.test.ts)), so a missing index fails CI instead of production.

## What I would deliberately keep

- **Keyset pagination and one index per filter/sort shape.** Page cost depends on page size, not table size, so it's the part of the design that already scales.
- **The unique-index idempotency guarantee.** It's atomic on one document and needs no new infrastructure.
- **One repo, one API, shared Zod schemas, a plain layered structure.** With three developers, the cost of a change is the bottleneck, not machines.
- **httpOnly cookie sessions with the role re-read on every request.** It's one indexed lookup by `_id`; cache it for 30 s if it ever shows up in profiles.
- **No total counts.** "Loaded 50, scroll for more" is honest and free.

## What I would refuse to build, even if asked

- **Exact totals on every filter change**, or "page 1 of 100,000" with jump-to-page. Each one is a full count or a deep `skip`. I'd offer approximate counts on request instead.
- **"Delete all cancelled orders" as a hard delete.** Finance, disputes and tax retention depend on that history. I'd offer hiding by default and an admin-only, logged archive.
- **Substring regex search (`/.*term.*/`) over 5M rows.** It can't use an index, and one slow query hurts every agent.
- **Microservices, an event bus or multi-region active-active writes** for three developers. One primary region with nearby reads is enough at this size; the rest is operational load with no customer benefit.
- **Permission checks that exist only in the UI**, and full-table exports streamed to the browser. Large exports become a server-side job that emails a link.

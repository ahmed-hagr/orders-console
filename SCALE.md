# Scaling to 5 million orders

**Scenario:** 100× today's data, three developers, agents in two countries using the console all day.

**Approach:** change only what breaks at that size, keep what still works, and refuse work that adds load without helping agents.

**At a glance**

- **Change:** search, stats, time zones, archiving old data, a replica set.
- **Keep:** keyset pagination, the duplicate guarantee, one repo, cookie sessions, no total counts.
- **Refuse:** exact counts, hard deletes, substring regex search, microservices, UI-only permissions.

## What I would change

### 1. Search

- **Problem:** a prefix regex on `nameTokens` or `email` is combined with any sort ([`orders.service.ts`](apps/api/src/modules/orders/orders.service.ts)). At 5M rows a short prefix like "a" matches hundreds of thousands of rows, and MongoDB has to sort them all for every page (spilling to disk past 100 MB).
- **Change:** fast exact paths for what agents type most when a customer is on the phone (order number, normalised email, E.164 phone), each on its own index. Name search needs at least 3 characters and returns results by relevance. If fuzzy search is truly needed, use a search index (Atlas Search, or a self-hosted engine fed by change streams) instead of regex.

### 2. Stats

- **Problem:** `getStats()` runs a `$facet` over every live order on each call. Today the 3–6 s delay is artificial; at 5M rows it would be real.
- **Change:** a small `daily_stats` collection keyed by `(country, day, status)`. Create and status-change paths `$inc` it in the same request, and a nightly job reconciles it against the source. The endpoint then reads about 30 tiny documents.

### 3. Two countries

- **Problem:** "today" is hard-coded to Asia/Riyadh (`startOfRiyadhDay`).
- **Change:** add a `country` field to orders and a `timezone` to users, and compute "today" per agent. If agents only work their own country's orders, prefix the list indexes with it (`{country, status, createdAt, _id}`): same keyset design, smaller index ranges.

### 4. Hot data vs history

- **Problem:** soft-deleted rows stay in every index, and `deletedAt: null` is checked after the index scan. Idempotency keys stay forever.
- **Change:** move deleted orders and orders delivered more than 18 months ago into an `orders_archive` collection, so the indexes agents hit cover only live work. Clear `idempotencyKey` and `bodyHash` after 7 days with a nightly `$unset`; a retry never arrives a week later, and the unique index shrinks.

### 5. Operations

- **Problem:** today's single MongoDB node is a single point of failure.
- **Change:** a three-node replica set. List and create reads stay on the primary, because an agent must see the order they just made; stats and reports go to a secondary. Turn on the slow-query log and keep the test that asserts the winning query plan ([`orders.list.test.ts`](apps/api/test/orders.list.test.ts)), so a missing index fails CI instead of production.

## What I would deliberately keep

- **Keyset pagination and one index per filter/sort shape.** Page cost depends on page size, not table size, so this part already scales.
- **The unique-index idempotency guarantee.** Atomic on one document, with no new infrastructure.
- **One repo, one API, shared Zod schemas, a plain layered structure.** With three developers, the cost of a change is the bottleneck, not machines.
- **httpOnly cookie sessions with the role re-read on every request.** One indexed lookup by `_id`; cache it for 30 s if it ever shows up in profiles.
- **No total counts.** "Loaded 50, scroll for more" is honest and free.

## What I would refuse to build, even if asked

- **Exact totals on every filter change**, or "page 1 of 100,000" with jump-to-page. Each is a full count or a deep `skip`. I'd offer approximate counts on request instead.
- **"Delete all cancelled orders" as a hard delete.** Finance, disputes and tax retention depend on that history. I'd offer hiding by default and an admin-only, logged archive.
- **Substring regex search (`/.*term.*/`) over 5M rows.** It can't use an index, and one slow query hurts every agent.
- **Microservices, an event bus or multi-region active-active writes** for three developers. One primary region with nearby reads is enough at this size; the rest is operational load with no customer benefit.
- **Permission checks that exist only in the UI**, and full-table exports streamed to the browser. Large exports become a server-side job that emails a link.

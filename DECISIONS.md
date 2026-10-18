# Decisions

## 1. No duplicate orders: the idempotency key lives on the order (R2)

**Decision.** The client sends a UUID `Idempotency-Key` per order being entered and reuses it on every retry. The server stores it on the order under a unique partial index on `(createdBy, idempotencyKey)`. A second insert fails with E11000, and the server answers with the existing order (200). A SHA-256 of the body catches a key reused for a different order (422).

**Alternative considered.** A separate `idempotency_keys` collection holding status and the cached response, written in a transaction with the order. This is the Stripe-style design, and it can replay any endpoint's response.

**Why I rejected it.** Multi-document transactions need a replica set, which conflicts with "runs locally in five minutes". A single-document insert is already atomic in MongoDB, so the order itself can carry the guarantee. One collection, one index, nothing to keep in sync.

**Limits.** The guarantee covers retries of the _same attempt_. If an agent reloads the page and types the order again, that's a new key and a real duplicate; catching that would need a soft "possible duplicate" warning (same email + items within N minutes), which is advice to the agent, not a guarantee. Keys never expire, and they are scoped per user.

## 2. Pagination: keyset cursor instead of skip/limit (R1)

**Decision.** The cursor is the last row's `(sort value, _id)`, and the next page is "strictly after" it. There is one compound index per filter/sort shape (`{status, createdAt, _id}` and so on), so MongoDB walks the index with no SORT stage. I fetch `limit + 1` rows to know whether another page exists, and I don't send a total count.

**Alternative considered.** `skip`/`limit` with numbered pages and a `countDocuments` total. It's simpler, and agents know page numbers from spreadsheets.

**Why I rejected it.** `skip` reads and discards every skipped row, so page 900 of 50,000 is slow. Rows also shift when new orders arrive, which shows duplicates or hides rows mid-scroll in a console that is written to all day. A count on every filter change is the most expensive query on the screen. The cost of my choice: no "jump to page 400" and no exact total. For finding one order, search plus filters matters more.

## 3. Server state: TanStack Query keyed by the filters (R1 correctness)

**Decision.** The list uses `useInfiniteQuery` with the filters as the query key. Each filter combination is its own cache entry, a response can only land in the entry it was requested for, and the table always reads the entry for the _current_ filters. The old request is aborted through `signal`, but that only saves work; correctness comes from the key.

**Alternative considered.** A hand-written `useEffect` with an `AbortController` and a "latest request id" guard. There's no dependency, and it's easy to explain.

**Why I rejected it.** The hand-written version is correct only if every code path remembers the guard: pagination, retries, refetch after a create, and the stats bar all need the same care. TanStack gives that guarantee structurally, plus cancellation on unmount (which O1 needs) and cache invalidation after create or delete. The trade-off is a dependency and a mental model the team must learn. For a list that is the core of the product, I think that's worth it.

## What I used AI tools for

I used Claude Code (Claude Opus 5.5) as a pair programmer working under my direction. Every commit it helped write carries a `Co-Authored-By` line.

- **I set the direction.** I worked through the brief, chose the stack (MongoDB, Express, React 19, Ant Design, Tailwind), and settled the approach for each hard problem after we compared options. I decided what to build, what to skip and in what order.
- **Claude did most of the typing.** It wrote the first drafts of the code, tests, seed and proof scripts, and these documents, and ran the type checks and tests.
- **I tested and steered.** I ran the app myself and sent back what was wrong. I spotted the stats request firing twice in DevTools (React StrictMode cancelling the first request, which is intended), found that signing out didn't redirect to the login page (fixed in `ec12868`), and asked for the lint setup, the code cleanups and the documentation pass.
- **I own the result.** I reviewed the decisions in this file and can explain, defend and change any part of the code live.

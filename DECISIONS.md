# Decisions

Three decisions, each with the alternative I seriously considered and why I rejected it.

| #   | Decision                 | What I chose                                       | What I rejected                                     |
| --- | ------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| 1   | No duplicate orders (R2) | Idempotency key on the order, under a unique index | A separate key collection written in a transaction  |
| 2   | Pagination (R1)          | Keyset cursor on `(sort value, _id)`               | `skip`/`limit` with page numbers and a total count  |
| 3   | Server state (R1)        | TanStack Query keyed by the filters                | Hand-written `useEffect` + abort + request-id guard |

## 1. No duplicate orders: the idempotency key lives on the order

**Decision.** The client sends a UUID `Idempotency-Key` per order being entered and reuses it on every retry. The server stores it on the order under a unique partial index on `(createdBy, idempotencyKey)`. A second insert fails with E11000, and the server answers with the existing order (200). A SHA-256 of the body catches a key reused for a different order (422).

**Alternative.** A separate `idempotency_keys` collection holding status and the cached response, written in a transaction with the order: the Stripe-style design, which can replay any endpoint's response.

**Why not.** Multi-document transactions need a replica set, which conflicts with "runs locally in five minutes". A single-document insert is already atomic in MongoDB, so the order itself can carry the guarantee: one collection, one index, nothing to keep in sync.

**Trade-off.** The guarantee covers retries of the _same attempt_. If an agent reloads the page and types the order again, that's a new key and a real duplicate; catching it would need a soft "possible duplicate" warning, which is advice, not a guarantee. Keys never expire, and they're scoped per user.

## 2. Pagination: keyset cursor instead of skip/limit

**Decision.** The cursor is the last row's `(sort value, _id)`, and the next page is "strictly after" it. One compound index per filter/sort shape (`{status, createdAt, _id}` and so on) lets MongoDB walk the index with no SORT stage. I fetch `limit + 1` rows to know whether another page exists, and send no total count.

**Alternative.** `skip`/`limit` with numbered pages and a `countDocuments` total. It's simpler, and agents know page numbers from spreadsheets.

**Why not.** `skip` reads and discards every skipped row, so page 900 of 50,000 is slow. Rows shift when new orders arrive, showing duplicates or hiding rows mid-scroll in a console written to all day. And a count on every filter change is the most expensive query on the screen.

**Trade-off.** No "jump to page 400" and no exact total. For finding one order, search plus filters matters more.

## 3. Server state: TanStack Query keyed by the filters

**Decision.** The list uses `useInfiniteQuery` with the filters as the query key. Each filter combination is its own cache entry, a response can only land in the entry it was requested for, and the table always reads the entry for the _current_ filters. The old request is aborted through `signal`, but that only saves work; correctness comes from the key.

**Alternative.** A hand-written `useEffect` with an `AbortController` and a "latest request id" guard. No dependency, and easy to explain.

**Why not.** It's correct only if every code path remembers the guard: pagination, retries, refetch after a create, and the stats bar all need the same care. TanStack makes the guarantee structural, and adds cancellation on unmount (which O1 needs) and cache invalidation after create or delete.

**Trade-off.** A dependency and a mental model the team must learn. For a list that is the core of the product, it's worth it.

## What I used AI tools for

I used Claude Code (Claude Opus 5.5) as a pair programmer working under my direction.

- **I set the direction.** I worked through the brief, chose the stack (MongoDB, Express, React 19, Ant Design, Tailwind), and settled the approach for each hard problem after we compared options. I decided what to build, what to skip and in what order.
- **Claude did most of the typing.** It wrote the first drafts of the code, tests, seed and proof scripts, and these documents, and ran the type checks and tests.
- **I tested and steered.** I ran the app myself and sent back what was wrong. I spotted the stats request firing twice in DevTools (React StrictMode cancelling the first request, which is intended), found that signing out didn't redirect to the login page (since fixed), and asked for the lint setup, the code cleanups and the documentation pass.
- **I own the result.** I reviewed the decisions in this file and can explain, defend and change any part of the code live.

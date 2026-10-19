# Orders Console

An operations console for finding orders fast and creating phone orders that can never be duplicated.
React 19 + Ant Design + Tailwind on the front end, Express 5 + MongoDB on the back end, in one npm-workspaces repo.

```
apps/api        Express 5 API (routes → controller → service → model)
apps/web        React 19 + Vite, Ant Design 6 components, Tailwind 4 layout
packages/shared Zod schemas and types used by both, so client and server validate identically
```

## Run it

You need **Node 20.19+ or 22.12+** (22 recommended; Vite 7 requires it) and **MongoDB 7** listening on `localhost:27017`, either installed locally or via `npm run db:up` (Docker).

```bash
npm install
cp .env.example apps/api/.env      # then set JWT_SECRET to 32+ random characters
npm run seed                       # 2 users + 50,000 orders, about 3 seconds
npm run dev                        # API on :4000, web on http://localhost:5173
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
The API refuses to start without one.

| Account           | Password     | Role                      |
| ----------------- | ------------ | ------------------------- |
| `admin@sarh.test` | `Admin#2026` | admin (can delete orders) |
| `agent@sarh.test` | `Agent#2026` | agent                     |

### Tests and the duplicate proof

```bash
npm test                    # API tests against a real, temporary mongod (downloaded on first run)
npm run check               # typecheck + lint + format check + tests, all workspaces
npm run prove:idempotency   # R2 proof against your seeded database
npm run test:e2e            # R1 browser test (Playwright, uses your installed Chrome)
```

`prove:idempotency` logs in as the agent, sends the same `POST /api/orders` twice in parallel with one `Idempotency-Key`, and prints:

```
request 1: HTTP 201  order #50001  replayed=false
request 2: HTTP 200  order #50001  replayed=true
Orders in the database with this key: 1
PASS: exactly one order was created.
```

Set `PARALLEL=10` to fire ten at once.

### The R1 browser test

Locally every request is fast and they come back in order, so clicking quickly by hand can't produce "an earlier, slower request".
[`e2e/rapid-filter.spec.ts`](apps/web/e2e/rapid-filter.spec.ts) creates that race on purpose with Playwright:

1. It holds the Pending response for 2 s and the Shipped response for 1 s, and lets Cancelled through at once.
2. It clicks Pending, Shipped, Cancelled 100 ms apart.
3. The responses arrive in the order Cancelled, Shipped, Pending, the stale ones last.
4. It checks that the table still shows only Cancelled orders, with the Cancelled filter selected and in the URL.

```
clicked Pending -> Shipped -> Cancelled; responses delivered: cancelled -> shipped -> pending
✓ R1: an earlier, slower response never overwrites the latest filter
```

I also checked that the test can fail: against a naive `useEffect` fetch with no abort and no "latest wins" guard, it fails because stale Pending rows appear under the Cancelled filter.
`npm run test:e2e` needs MongoDB running and seeded. It starts the API and web app if they aren't already running.
It uses your installed Google Chrome; to use Playwright's own browser instead, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

To see the stats error state by hand, set `STATS_FAIL_RATE=1` in `apps/api/.env` and restart the API.

## How the two hard problems are solved

**R1, a fast list that never shows stale results.**

- Keyset pagination on `(sort field, _id)`: no `skip`, and no `countDocuments` per request. Pages are fetched as `limit + 1` to know whether another page exists.
- One compound index per filter/sort shape, declared in [`order.model.ts`](apps/api/src/modules/orders/order.model.ts):
  `{createdAt,_id}`, `{totalMinor,_id}`, `{status,createdAt,_id}`, `{status,totalMinor,_id}`.
- Search uses anchored prefixes (`/^term/`) on `email` and `nameTokens`, which use index bounds. The trade-off: "oura" does not find "Noura".
- The browser renders an antd virtual table and loads the next cursor page on scroll.
- Stale responses: each filter combination is its own TanStack Query cache entry. A response can only land in the entry it was requested for, and the table always shows the entry for the current filters. The old request is also aborted, but that only saves work; correctness comes from the key. See [`useOrdersQuery.ts`](apps/web/src/features/orders/useOrdersQuery.ts).

**R2, no duplicate orders.**

- The client creates a UUID `Idempotency-Key` per order being entered. Retries and resubmits reuse it; a new one is issued only after success.
- The server inserts the order with `{createdBy, idempotencyKey}` under a **unique partial index**. A second insert fails with E11000, and the server answers with the first order (200, `Idempotent-Replayed: true`).
- The same key with a different body gets 422.
- This is atomic on a single document, so it needs no transaction and no replica set.
- See [`orders.service.ts`](apps/api/src/modules/orders/orders.service.ts). The limits are in DECISIONS.md.

## Code review: the contractor's `auth.ts`

| #   | Problem                                                                                                                                                                                                           | Kind               | What I changed                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `jwt.decode()` never checks the signature. Anyone can craft `{"role":"admin"}` (or `alg: none`) and become admin.                                                                                                 | Security, critical | `jwt.verify()` with `algorithms: ["HS256"]` pinned. Test: forged and `alg: none` tokens get 401.                                                          |
| 2   | `exp` is never checked, and `jwt.sign` sets no expiry, so tokens live forever.                                                                                                                                    | Security           | `expiresIn: JWT_TTL` (default 8h); `verify` enforces it. Test: expired token gets 401.                                                                    |
| 3   | Secret hard-coded in source (`"sarh-secret-2026"`), so anyone with repo access can mint tokens.                                                                                                                   | Security           | Read from env and validated with Zod at startup; the process exits if it is missing or under 32 chars. Test: a token signed with the old secret gets 401. |
| 4   | Token accepted from `?token=`, so it leaks into server logs, browser history and the Referer header.                                                                                                              | Security           | Token only from an httpOnly cookie. Test: `?token=` is ignored.                                                                                           |
| 5   | Delete route has no server-side authorization ("admin check is done in the React AdminOnly component"). Any agent can call the API directly.                                                                      | Security           | `requireRole("admin")` middleware returns 403. `AdminOnly` now only hides the button.                                                                     |
| 6   | Login compares plain-text passwords in the query, so passwords are stored in plain text.                                                                                                                          | Security           | bcrypt hashes (`select: false`). Login finds by email, then `bcrypt.compare`.                                                                             |
| 7   | NoSQL injection: `req.body.password` goes into the Mongo query unvalidated, so `{"password": {"$ne": null}}` logs in as anyone. (The original uses Prisma-style syntax, but against Mongo this is the real risk.) | Security           | Body parsed with a Zod schema (strings only) before any query; the password never enters a query. Test: gets 400.                                         |
| 8   | No rate limit on login, so password guessing is free.                                                                                                                                                             | Security           | `express-rate-limit`: 10 attempts per 15 min per IP.                                                                                                      |
| 9   | Role and user are trusted from the token, so a demoted or deleted user keeps access until the token expires (never, here).                                                                                        | Design / security  | `requireAuth` loads the user's current role from the DB on every request.                                                                                 |
| 10  | Async handlers with no error handling. Under Express 4 a DB error is an unhandled rejection and the request hangs.                                                                                                | Design             | Express 5 forwards async errors to one error handler that maps Zod/HTTP/cast errors and never leaks stack traces.                                         |
| 11  | `:id` isn't validated, `delete` returns `{ok:true}` even when nothing matched, and the hard delete leaves no trace.                                                                                               | Design             | Invalid id gets 400, missing gets 404. Soft delete with `deletedAt` / `deletedBy`.                                                                        |
| 12  | `req.user = payload` with no typing; `requireAuth` is not reusable for roles.                                                                                                                                     | Design             | Typed `req.user`; separate `requireAuth` and `requireRole`.                                                                                               |

All of these are covered in [`auth.test.ts`](apps/api/test/auth.test.ts).

**Where the token lives:** in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api`, served same-origin through the Vite proxy, so page JavaScript never sees it.
That protects against XSS _stealing_ the token, and SameSite=Strict plus JSON-only endpoints block cross-site request forgery.
It does not protect against XSS _using_ the session while the page is open, since injected script can still call the API as the user. Preventing XSS in the first place (React escaping, no `dangerouslySetInnerHTML`, CSP) still matters.

## Product question: "Delete all cancelled orders"

First I'd ask what problem the cancelled orders cause today: a cluttered list, slow screens, or storage cost?
Then I'd ask who else relies on them: finance for refunds and chargebacks, support for disputes, reporting for cancellation rates, and tax record retention.
I'd also ask whether a cancelled order is ever reopened, and who should be allowed to press the button.
If she can't answer, I'd propose hiding cancelled orders by default instead; the status filter already exists, so they stay one click away.
If storage turns out to be the real reason, I'd propose an admin-only, logged, reversible archive. I wouldn't build a hard delete.

## What I skipped and why

- **O2, optimistic create.** The brief says pick at most one; I chose O1 (slow stats) because it reuses the abort handling from R1.
- **Total match count.** `countDocuments` on every filter change is the slowest part of a list at scale, so the UI shows "N loaded, scroll for more" instead.
- **Substring search.** Search is prefix-only so it stays on an index. Substring search would need a text or Atlas Search index (see SCALE.md).
- **Idempotency key expiry.** Keys stay on the order forever. That's cheap at this size, but it means a key can never be reused.
- **More front-end tests.** The browser suite covers the R1 race only. The create form, delete and stats states are covered by API tests and checked by hand.
- **CSRF token.** Relying on SameSite=Strict + same-origin + JSON-only bodies. A cross-origin deployment would need a token.
- **Bundle size.** The production bundle is about 420 kB gzipped, mostly antd. Route-level code splitting would fix it but adds nothing to this review.
- **Gap-free order numbers.** When two copies of the same request arrive together, both reserve an order number before the unique index picks a winner, so the loser's number is never used (for example #50003). The numbers stay unique and increasing; only the gaps are visible.
- **Screen recording.** Screenshots are below instead.

## Screenshots

|                                                                                                                                                                                         |                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1, the browser test.** Pending, Shipped and Cancelled responses are delivered stale-last, and the table still shows the latest filter. ![](docs/screenshots/02-rapid-filter-e2e.png) | **R1, the result.** After three quick clicks, only Cancelled orders are shown. ![](docs/screenshots/03-rapid-filter-result.png)                                     |
| **R2, the create form.** Validated with the shared schemas. The Idempotency-Key at the bottom stays the same across retries. ![](docs/screenshots/04-create-order-drawer.png)           | **R2, the duplicate proof.** Two identical requests in parallel: one 201, one replayed 200, one order in the database. ![](docs/screenshots/06-duplicate-proof.png) |

More: [orders list](docs/screenshots/01-orders-list.png), [order created](docs/screenshots/05-order-created.png), [proof output as text](docs/screenshots/prove-idempotency.txt), [e2e output as text](docs/screenshots/rapid-filter-e2e.txt).

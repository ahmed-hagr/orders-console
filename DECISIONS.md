# Decisions

> TODO: write each decision in your own words, 5–8 lines each: the decision, one alternative you
> seriously considered, and why you rejected it. Reviewers read this file first and will ask you to
> defend it live. The notes under each heading are prompts, not the answer.

## 1. No duplicate orders: idempotency key on the order document (R2)

Prompts:

- Chosen: client UUID per order being entered, stored on the order, unique partial index on `(createdBy, idempotencyKey)`; E11000 is turned into a 200 replay; body hash detects a key reused with a different payload (422).
- Alternative: a separate `idempotency_keys` collection (status, response) written in a transaction with the order. Why rejected: multi-document transactions need a replica set, which makes "runs locally in five minutes" harder, and the single-document insert is already atomic.
- Other alternative: a natural-key check (same email + items within N minutes). Why it's not the guarantee: it blocks legitimate repeat orders and still races without a unique index.
- Limits: an agent who reloads the page and re-enters the order gets a new key, so that's a real duplicate. Keys never expire. Keys are scoped per user.

## 2. Pagination: keyset cursor instead of skip/limit

Prompts:

- Chosen: cursor = last row's `(sort value, _id)`, one compound index per filter/sort shape, `limit + 1` lookahead, no total count.
- Alternative: `skip`/`limit` with page numbers. Why rejected: `skip` gets slower the deeper you page, and rows shift (duplicates or gaps) when orders are created while an agent scrolls.
- Cost: no "jump to page 400", no exact total.

## 3. Your choice (for example state management or monorepo structure)

Prompts:

- TanStack Query keyed by filters vs a hand-written `useEffect` + `AbortController` + request-id guard. Which guarantees "latest wins" and why.
- Or: npm workspaces with a shared Zod package vs separate repos / duplicated validation.

## What I used AI tools for

> TODO: be specific and honest, for example: discussed the brief and approach with Claude Code, it scaffolded
> the monorepo and wrote first drafts of X/Y/Z, I reviewed, changed A/B, and wrote this file myself.

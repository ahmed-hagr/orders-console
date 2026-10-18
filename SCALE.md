# Scaling to 5 million orders

> TODO: one page, in your own words. Scenario: 5M orders, three developers, agents in two countries
> using the console all day. Ground it in this codebase. Prompts below.

## What I would change

- Search: prefix regex on `nameTokens` / `email` stops being selective. Consider a dedicated search index (Atlas Search or a self-hosted equivalent) or a normalised phone/email exact-match lookup.
- Search + non-date sort can't be served by one index (in-memory SORT on the matches). Cap result sets or restrict sort while searching.
- Stats: a full `$group` over 5M rows every call. Pre-aggregate (counters updated on write, or a materialised view refreshed every minute).
- Two countries: time zones (stats are hard-coded to Asia/Riyadh), region-aware "today", latency (read replicas near agents?).
- Idempotency keys: add a TTL or move them out of the order once the retry window has passed.

## What I would deliberately keep

- Keyset pagination and the compound indexes: they don't degrade with table size.
- The single-document idempotency guarantee.
- One repo, shared Zod schemas, a plain layered API: three developers don't need microservices.

## What I would refuse to build

- Prompts: exact total counts on every filter change; "delete all X" hard deletes; offset pagination / jump to page N; client-side only permission checks…

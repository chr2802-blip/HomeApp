# Send a list to the household's Nemlig basket

- **Date** — 2026-10-11
- **Branch** — `ccr-94071e10-mzpo0s`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

A "Send to Nemlig" button on a shopping list. It searches nemlig.com for every open line,
shows a review where each product can be swapped or skipped, fills the basket, and
reports what was added, skipped and failed. The ask named the nemlig-shopper Python package
and env-var credentials. What it turned out to mean was a TypeScript port of that package's
client, and one sealed login per home, kept on `/settings`. The app is multi-home, so one
installation-wide login would have filled one person's basket from everybody's lists.

## The route

Read the codebase and the package's source, then proposed a plan and waited. The user changed
the credentials to one per home and asked to have the flow walked through in words before
saying go. Then: schema and migration, `secret-box`, the client, the pure basket module,
the actions, the sheet and the Settings card. Rough screenshots went out against a local
stub. After that came unit, integration and browser tests, and the docs.

One loop: the integration test caught `pickBestMatch` choosing "Mælkechokolade" for "mælk".
Both names merely *contained* the word. Danish puts the head noun last, so a term ending a
compound now outranks one starting it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | Two rounds of plan before building: credentials per home, then the flow in words |
| Reading the codebase | 15% | Settings, sheets, actions, homeDb, rate limits, the Anthropic stub as a model |
| Building | 40% | Client, matching, actions, two components, stub, demo seed |
| Tests | 20% | Unit (client + matching + basket + seal), integration (actions), one browser spec |
| Review, CI, deploy | 10% | |

## What should have been quicker

- **Nemlig cannot be reached from this container** (the proxy answers 403), so no part of
  the client has been run against the real API. It was built from nemlig-shopper's source
  and its test fixtures, and every guess about Nemlig's answers is one of those. A stub
  had to be written before anything could be screenshotted, and that was the largest
  single detour.
- The basket page's address (`nemlig.com/basket`) could not be confirmed either. A web
  search and a fetch both failed, and it is taken from the package, which links to it four
  times.

- An integration test compared rows ordered by the database (`orderBy: { key: "asc" }`)
  with the same keys sorted in JavaScript. With Danish keys the two disagree whenever the
  database's collation is locale-aware: "æg" sorts as "aeg" there, but after "mælk" by
  bytes. It passed here and failed on the next machine. Compare as a map, or sort in JS on
  both sides.

## What CLAUDE.md did not say

How to work on a feature whose third party is unreachable from the container. The answer
here, which is now in CLAUDE.md under the Nemlig section, follows `anthropic-stub.mjs`:
an env var pointing the client at a stub, the stub started per worker by Playwright, and
`db:demo` assuming it.

## Decided rather than known

- Nemlig's response shapes, including a 200 carrying `ErrorCode` counted as a refusal,
  which the package itself does not check.
- The scoring in `pickBestMatch`: an exact word scores 4, a compound ending 3, a compound
  start 1, ties keep Nemlig's order.
- Every list shows the button, not only lists tracking amounts, because `trackAmounts` is
  off by default.
- Rate limits: 80 searches and 20 sends per person per quarter-hour, and the default 8 for
  login attempts.
- The remembered product is proposed even when today's search did not return it, shown
  without a price.
- `NEMLIG_BUDGET_MS` is 40s and `NEMLIG_CALL_TIMEOUT_MS` is 8s, which keeps both loops
  inside the 60s `maxDuration`.

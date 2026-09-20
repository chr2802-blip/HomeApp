# Import a recipe from an Instagram or Facebook reel

- **Date** — 2026-09-20
- **Branch** — `claude/reel-metadata-extraction-i5py7e`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"The reel from insta and fb does not work" — the link importer reached a reel, found no
`schema.org/Recipe` markup and correctly refused it. The ask was to read the recipe out
of the reel's own description instead, and to take the video's thumbnail as its picture.

What it turned out to mean is two different problems wearing one sentence: *reading* a
caption as a recipe (pure text work, entirely ours) and *getting* the caption at all
(Meta's to allow, and they largely do not). Splitting those two apart before writing
anything is most of why this went straight through.

## The route

Read the existing importer and its three test files → established that the sandbox's
egress proxy blocks `instagram.com`, so the fetching half could not be verified here at
all → asked the one question that changed the shape of the work (what to do when the
fetch is refused) → parser, then sources, then wiring, then UI → tests at each layer →
full `verify`.

Two loops worth naming, both cheap:

- The first cut of `parseRecipeFromCaption` had a muddled `start` expression and a
  no-heading branch whose index arithmetic said `firstHeadingAt === 0 ? 0 : 1` where it
  could only ever mean `1`. Rewritten into `splitBody` before the tests were written —
  the confusion was visible in the code, not found by a failure.
- One test failure, and it was the useful kind: "Klar på 25 minutter i alt" was being
  read as the recipe's last *step*. The time was already in its own field, so the line
  had to be dropped once read. That is now `isTotalTimeLine`, and it is the only
  behaviour here that a review would not have thought to look for.

No red CI, no review round, no question that had to wait.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | Mostly establishing what *cannot* be verified from here. |
| Reading the codebase | 20% | `recipe-import.ts`, `embed.ts`, the dialog, and the three test files' house style. |
| Building | 30% | Three modules; the parser is most of it. |
| Tests | 25% | 37 new unit, 3 integration, 2 browser. |
| Review, CI, deploy | 15% | Standing up Postgres and a browser binary in this container. |

## What should have been quicker

**Getting the suites runnable took longer than writing the feature's hardest function.**
The container arrived with no `node_modules`, no Postgres and a Playwright browser two
versions off what the lockfile wants — so `npm ci`, `initdb`, a cluster, an `.env`, and
symlinking `chromium_headless_shell-1243` onto the installed `-1194` all happened
*after* the code was written, which is exactly the wrong order: had the browser suite
been unavailable, two of the tests above would have been written blind.

None of that is in CLAUDE.md, and none of it is discoverable from `npm run verify`
failing — `verify` fails at lint, which tells you nothing about the three separate
things actually missing. The commands are now written down (below), so the next session
in a fresh container can start them in the first minute and read code while they run.

**The second cost was smaller and avoidable**: `ImportedRecipe` gained a field, and
three existing expectations across two suites broke on it. Fixed with one regex, but the
shape of those tests — a full `toEqual` on the whole record — means every future field
does the same thing again. Not worth changing now; worth knowing before adding the next.

## What CLAUDE.md did not say

1. **How to bring a bare container up to the point `npm run verify` can run.** Now in
   this note rather than CLAUDE.md, because it is about this sandbox and not about the
   app: `npm ci`; `initdb -D … -U postgres -A trust` as the `postgres` user and
   `pg_ctl start` on 5432; an `.env` with `DATABASE_URL`/`DIRECT_URL` pointing at it
   plus `AUTH_SECRET` and `CRON_SECRET`; and, where `/opt/pw-browsers` holds a different
   build number than the lockfile wants, symlink the expected directory onto the
   installed one rather than running `playwright install`. And `E2E_WORKERS=2`: the
   suite's default worker count exhausts this container, which costs a whole `git push`
   — the pre-push hook gets as far as the browser suite, fails there, and the five
   minutes before it are spent again on the retry. If a third session pays this
   again it has stopped being a note and wants a script.

2. **That a reel is a deliberate non-target of the link importer.** CLAUDE.md said
   `notARecipe` covered "a reel, a shop page" as though a reel were simply one more
   unreadable page. It was the one case with a recipe genuinely on it. That sentence is
   corrected and the whole route is now written up under **A reel keeps its recipe in
   the caption**, in the same commit.

3. **That two modules already knew which hosts are social video.** `embed.ts` knew, for
   building an iframe; the importer now needs to know, for deciding which route a link
   takes. Kept apart on purpose, and CLAUDE.md now says why — otherwise the next session
   sees duplication and merges them.

## Decided rather than known

- **The fetch half is unverified.** `instagram.com` is blocked by this sandbox's proxy,
  so every claim about what Instagram answers a signed-out request with is reasoning,
  not measurement. `/embed/captioned/` is asked first on the understanding that it is
  the page Instagram's own embed widget loads; if it turns out to be walled too, the
  paste box is the feature and the automatic route is a bonus. **This is the thing to
  check first against production.**
- **Facebook is the weakest of the three.** It has no unauthenticated caption endpoint
  worth the name; its own page's `og:description` and the post plugin are tried, and may
  well both refuse. TikTok, which was not asked for, is the most likely to work, because
  its oEmbed is genuinely open — it came almost free once the route existed.
- **Three ingredient-shaped lines** is the bar for reading a caption with no headings as
  a recipe. Chosen, not derived: two is a line like "3 ting du skal vide" followed by a
  number.
- **The total time is read only beside a phrase meaning the whole dish.** A bare "20
  min" is ignored. The conservative direction, on the same reasoning the schema.org path
  uses: nothing said is null, never zero.
- **The paste box is reachable on purpose, not only after a failure.** Partly UX — a
  cook who knows how this reel ends should not wait out two timeouts — and partly so the
  browser test can drive the whole route with no network, which is the house style in
  `e2e/recipe-import.spec.ts`.

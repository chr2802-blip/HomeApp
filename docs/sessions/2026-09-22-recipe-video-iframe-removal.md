# Remove the embedded video from a recipe page

- **Date** — 2026-09-22
- **Branch** — `claude/recipe-video-iframe-removal-8apwns`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

The embedded video (an Instagram/YouTube/etc. iframe) on a recipe's own page took up too
much of the screen. Replace it with a "Go to link" button beside "Start cooking", so a
recipe with a video link gets a way to reach it that costs one row instead of a widget's
worth of height — and so a video-only recipe, which previously had no button of any kind
below the fold, gets one too.

## The route

Straight through: find `SocialVideoEmbed` and its one call site on `/recipes/[id]`, delete
the call, add a `videoHref` (via the same `safeExternalHref` the embed component already
used for its own "open on Instagram instead" fallback) and a second `ButtonLink` beside
"Start cooking". `SocialVideoEmbed` had no other caller, so the component file went with it
rather than being left as dead code. Updated the three e2e tests that asserted an `iframe`
existed to assert a "Go to link" anchor instead, and added one asserting both buttons show
together — the case the old code never drew a button for at all.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | One call site, one component — small blast radius once found. |
| Reading the codebase | 10 min | `embed.ts`, `video-embed.tsx`, the recipe page, and the design doc's own account of why the embed exists. |
| Building | 10 min | The page edit itself; `safeExternalHref` already existed for exactly this. |
| Tests | 20 min | Rewriting the three iframe-asserting e2e tests, plus `npm run setup` on a cold container. |
| Review, CI, deploy | — | Not yet pushed. |

## What should have been quicker

Nothing stood out — `safeExternalHref` already existed for the fallback link inside
`SocialVideoEmbed`, so there was no new URL-safety code to write, and the e2e tests named
exactly which assertions needed to change (`page.locator("iframe")`).

## What CLAUDE.md did not say

Nothing new — the video-embed area was already documented in
`docs/design/recipes.md` ("A reel keeps its recipe in the caption" section), which this
session updated in place: it said the recipe page "plays [the video] through the embed
`embed.ts` already builds," which stopped being true, and now says the page offers a
"Go to link" button, with a line on why the iframe was tried and taken back out.

## Decided rather than known

- The button's label, "Go to link" — the user's own phrasing for the ask. No existing
  external-link button elsewhere in the app to match wording against.
- `variant="secondary"` for it, so "Start cooking" (the primary action, when there are
  steps to turn) keeps the home's own accent colour and the video link reads as the
  lesser of the two rather than competing with it.
- `parseSocialEmbed` in `embed.ts` was left as is: it is still used, unrelated to this
  change, to decide the video badge on the recipes list (`hasVideo` in
  `/recipes/page.tsx`). Only the component that turned its `src` into an `<iframe>` was
  removed.

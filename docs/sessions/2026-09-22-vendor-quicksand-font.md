# Vendor the heading font instead of fetching it from Google at build time

- **Date** — 2026-09-22
- **Branch** — `claude/vendor-quicksand-font`
- **PR** — not yet
- **Reached production** — not yet

## The idea

An unrelated PR's CI (`#100`) was red on "Browser tests": `next build` failed inside
`next/font` with `TypeError: Cannot read properties of null (reading '1')` in
`src/app/layout.tsx`. It reproduced identically on a re-run. Neither the diff on that PR
nor `layout.tsx` itself had anything to do with each other — this is `next/font/google`
making a live request to Google Fonts on every production build, and Google's edge
occasionally answering with something the loader's own regex can't parse.

## The route

Ruled it out as the other PR's problem (error names a service its diff doesn't touch,
reproduced identically on a re-run), then looked for a real fix rather than just hoping
for a luckier build: this is a documented failure mode for `next/font/google` in CI, and
the standard fix is to stop fetching the font live at build time at all. Downloaded the
same Latin-subset file Google was serving for the app's three heading weights (500, 600,
700 all resolve to one variable-width `.woff2`, so one file covers the whole range),
checked it into the repo, and switched `layout.tsx` from `next/font/google` to
`next/font/local`. Verified the build actually bundles the local file (checked
`.next/static/media` for a 28,244-byte woff2 matching the vendored one) and that the full
`npm run verify` suite still passes.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | Reading the CI logs on the other PR to identify the real error under the generic "failed" |
| Reading the codebase | 5 min | `layout.tsx`'s font setup, confirming nothing else touches it |
| Building | 15 min | Fetching the actual font bytes Google was serving, working out that Quicksand's three weights share one variable file, writing the `next/font/local` config |
| Tests | ~6 min | Cold `next build` to confirm the bundle no longer names Google Fonts, then full `npm run verify` |
| Review, CI, deploy | — | not yet |

## What should have been quicker

Nothing here cost more than it should have — the CI logs named the exact file and line,
and confirming "same URL for all three weights" only took one look at the raw CSS Google
returns.

## What CLAUDE.md did not say

Nothing in `CLAUDE.md` mentioned that the heading font is fetched live at build time, or
that doing so is a known source of CI flakiness. Worth a line if this repo ever adds a
second Google font — the same problem would recur silently until a build happened to land
on an unlucky moment.

## Decided rather than known

Chose to vendor the font as a single variable-weight `.woff2` (`weight: "500 700"`) rather
than three separate static files, because Google was already serving one physical file for
all three requested weights under the Latin subset — matching what the live loader would
have downloaded anyway, just fetched once instead of on every build.

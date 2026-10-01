# Rename the pantry: "Lager" in Danish

- **Date** — 2026-10-01
- **Branch** — `ccr-819b3ad6-drwpg9`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The pantry now holds far more than food (toilet paper, baby things), so its name should
say so: "Lager" in Danish. The English name was not given; "Storage" was chosen.

## The route

Grep of `src/lib/copy/` for every phrase saying pantry/spisekammer/forråd → rewrite those
phrases → update the tests and e2e specs that match the old wording → unit + integration
pantry/copy/language tests → screenshots at 390×844 in both languages → verify.
Copy only: the route (`/pantry`), the `PantryItem` model and code identifiers are untouched.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | English name had to be decided |
| Reading the codebase | short | the copy catalogue made every phrase one grep away |
| Building | short | |
| Tests | short | |
| Screenshots | most of it | dev database unmigrated; seed script wrote the wrong relation names |

## What should have been quicker

The screenshot: `npm run setup` leaves the dev database without tables, and the seed
script guessed `homes`/`activeHomeId` on `User` before finding `memberships`/`activeHome`.
Two failed seed runs.

Then the push: three pre-push runs each failed one different, unrelated browser test
(dialogs back button, a sheet's close animation, ai-wait), each passing alone. `E2E_WORKERS=3`
and `=2` both failed; `=1` passed in 11 minutes. About 30 minutes of the session.

## What CLAUDE.md did not say

The seed details, and that only one worker reliably gets a push through here — now written under "A dev database for screenshots has nobody in it" and beside `E2E_WORKERS`.

## Decided rather than known

- English name "Storage" (Danish "Lager" was asked for). The Danish phrasing "på lageret".
- The page's intro line changed from "basics"/"basisvarer" to "things"/"ting".
- The dashboard's "i forrådet" became "på lageret" too, so the app uses one name.

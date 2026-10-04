# A demo household and a screenshot command, and the ai-wait flake

- **Date** — 2026-10-04
- **Branch** — `ccr-b2daef22-pf2k8p`
- **PR** — not yet
- **Reached production** — not applicable (dev tooling only)

## The idea

"We have had a lot of sessions and a lot of notes about what could be faster — anything to
implement?" Meaning: read every note's "what should have been quicker", find what keeps
coming back, and remove it.

## The route

Read all 76 notes' "what should have been quicker" sections → tallied → the screenshot
cost is the most repeated by far → `npm run db:demo` (`scripts/demo-seed.ts`) and
`npm run screenshot` (`scripts/screenshot.ts`), sharing `scripts/demo-cast.ts` → shot the
dashboard, lists and pantry in English, Danish and empty → CLAUDE.md's screenshot paragraphs
rewritten around the two commands.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | Reading 76 notes' one section each |
| Reading the codebase | 15% | Schema, e2e session cookie, time helpers |
| Building | 50% | Seed content in two languages is most of it |
| Tests | 15% | Ran both commands for real; lint and types |
| Review, CI, deploy | 10% | |

## What should have been quicker

Nothing in this session cost twice. What it fixes: about a dozen notes from 2026-09-22 onward
named screenshots as their biggest cost. Most wrote a throwaway seed from scratch and
guessed a name wrong (`List.name`, `SAGE`, `PASTA_RICE_GRAINS`, `homes`/`activeHomeId`),
or lost a run to the dev overlay or to an animation that had already finished. Three notes
in a row asked for this helper, and the "three times is a convention" rule had been
satisfied since 2026-09-27.

How the rest of the notes tallied, for whoever picks the next one:

1. **The pre-push browser suite dropping one unrelated test to contention** (5+ notes,
   ~30 minutes in 2026-10-01). `ai-wait.spec.ts` was flaky on `main` itself in 2026-09-27,
   so that is a real race to fix, not only CPU contention.
2. **A new model with no `homeId` has to be named in five places**, only one enforced;
   the storage breakdown fails silently (2026-09-26-recipe-ratings).
3. **A new AI reader must satisfy five files**, one of them unchecked (`FEATURE_NAME` in
   `ai-spend.tsx`) (2026-09-25-pantry-shelves).
4. **The one-spec e2e loop is mostly `next build`** (2026-09-26, two notes). Nothing to fix
   cheaply; the screenshot command removes the commonest reason to need it.

## What CLAUDE.md did not say

Nothing new was found missing. The screenshot paragraphs in Commands and Working style now
point at the two commands rather than at a throwaway, and keep only the facts a script
these commands do not cover would still need.

Seen while checking the output: in a Danish home, the dashboard's days-ahead tiles break
"Kyllingekarry" and "Tomatsuppe" mid-word ("Kyllingekar / ry"). Not fixed here.

## Second half: the `ai-wait.spec.ts` flake

Asked to fix the top item on the list above. Reproduced first: 1 in 36 loaded runs on the
unchanged spec, timing out on `save.arrived` with the save **already made** (the
failure screenshot is the saved recipe page). The first guess, a click before hydration
falling back to a native submit, was wrong: the trace has neither a POST nor a GET with
the form in its query string. Instrumenting a copy (`page.on("request")`, a log in the
route handler, `navigator.serviceWorker.controller` at the click) over 270 loaded runs
gave the answer: all 8 failures had the worker in control and no route call, and none of
the 141 runs without a controlling worker failed. A request through the worker never
reaches `page.route`. `test.use({ serviceWorkers: "block" })`, now `ROUTES_REQUESTS` in
the fixtures, took it to 0 in 270. `cook-mode.spec.ts` and `animation.spec.ts` route too
and were exposed the same way, so they use it as well, and `tests/unit/e2e-routes.test.ts`
refuses a routing spec that does not.

**What should have been quicker:** a probe that only *waited for* the worker to take
control (to force the failure) passed with control on its first run, which read as
disproving the worker. Control makes the miss possible, not certain, so one run proved
nothing. Counting outcomes against the controller state over a few hundred runs settled
it in one go and should have been the first experiment. Two other things cost time: the
`line` reporter interleaves workers' stdout so it could not be tied to a test (the JSON
reporter keeps it per result), and a second batch wiped `test-results/`, trace included,
before it was read. The 2026-09-23 note had already warned about that.

The other failures named in the notes (`dialogs`, a sheet's close animation, `meals`) do
not route, so they are not this; contention is still the likeliest explanation there.

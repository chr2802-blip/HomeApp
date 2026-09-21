# Split the recipe importer into extraction and one AI reading

- **Date** — 2026-09-21
- **Branch** — `claude/recipe-importer-two-stage-spucdw`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"The importer is too flaky and introduces too many issues and duplicates — extract the text
first, then let an AI unify it." What it turned out to mean is narrower and more structural
than a list of bugs: the app had **two programs each deciding what a recipe was**, and both
were pattern-matchers being asked a question patterns cannot answer. The duplicates were not
a bug in either; they were what a selector does when a CMS nests `recipeIngredient` inside
`recipeIngredient` or writes a step as `<li><p>`.

That difference is the whole session. The ask reads as "add an AI step"; the work was
"delete one of the two readers and give the other one job", and almost every decision below
falls out of that rather than out of the model call.

## The route

Read the four importer files end to end (`recipe-import.ts`, `reel-import.ts`,
`caption-recipe.ts`, and the action), then `recipes.ts` — which turned out to be the file
that decided the design, see below. Put four questions to the user before planning, because
each one changed the shape of the work: what happens with no key, which model, how much to
persist, and what to do about units. Wrote the plan, got it approved, built it in the order
extract → normalize → orchestrate → client → tests → docs.

Loops worth naming:

- **The e2e suite had to be re-planned mid-build.** Two existing browser tests drove the
  paste box end to end and passed because the old parser needed no network. With the reader
  being a model call they would all have come back "couldn't read that just now" — the plan
  said to accept that and lose the coverage. Building it made the loss obvious enough to fix
  instead: a stub Messages API per worker, pointed at by `ANTHROPIC_BASE_URL`. That was an
  unplanned half hour and the single best thing in the change.
- **One render bug found by writing the test, not by thinking.** `unit` with no `amount`
  renders "knivspids salt", which `shoppingText` reads as an ingredient *called* knivspids
  salt. Fixed by only ever writing a unit behind an amount.
- **A wrong assumption caught by a test written for a different reason.** A test that only
  meant to check `zodOutputFormat` accepts a zod v4 schema printed the converted schema, and
  the enum was gone — demoted to a line of description. The whole units design had been
  resting on the API enforcing a list it never receives. Ten minutes to find, twenty to fix
  properly (`canonicalUnit`, checking on the way back against `UNIT_WORDS`), and it would
  otherwise have shipped as a guarantee that was not one. This is the strongest argument in
  the session for writing the boring compatibility test.
- **One browser test failed once and never again.** `pantry.spec.ts` → "the pantry is
  reached from the home's own name, and kept there" failed in one of four full runs and
  passed in the other three and on its own. The diff touches nothing in the pantry, the
  lists or the home menu, so the likeliest link is load: this change adds a stub server per
  worker, so a two-worker run now starts four processes instead of two on a container that
  is not generous. Recorded rather than papered over — that test already wraps its edit
  click in `retry`, which suggests it has been marginal before. If it turns up again in CI
  it wants a real look, not a longer timeout.
- **The sandbox had no Postgres and the wrong Playwright browser build.** Started the system
  cluster by hand and symlinked the expected browser path at the installed one. Neither is
  committed; both cost time that had nothing to do with the change.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15m | Mostly reading `recipes.ts` and realising the units question existed |
| Reading the codebase | 25m | Four importer files, plus the four downstream readers of an ingredient line |
| Building | 60m | Three new modules, one rewritten orchestrator, client and config |
| Tests | 50m | Three unit files rewritten, integration re-stubbed, the e2e stub server |
| Review, CI, deploy | 20m | Full `verify`, including a Postgres and a browser that had to be made to exist |

## What should have been quicker

**Working out that an ingredient line is a typed interface, not free text.** Nothing said
so. `Recipe.ingredients` is `String`, the form is a `<textarea>`, and the recipe page just
prints the lines — so the obvious reading is that the importer may write whatever it likes.
It may not: `shoppingText` strips a *known* unit word after a leading amount and cuts at the
first comma, `pantryKey` is built on the result, and `@@unique([homeId, key])` is built on
that. Four features read those lines and none of them would error on a badly shaped one.

Finding this took reading `recipes.ts`, `pantry.ts`, `lists.ts` and `meal-suggestions.ts`
and noticing they all funnel through the same two functions. It was also the single highest
risk in the change: Gemini's proposed schema specified English units (`tsp`, `tbsp`, `cup`),
which would have silently stopped the pantry matching on every newly imported recipe —
no error, no failing test, just a cupboard that gradually stopped working. That is exactly
the class of bug `CLAUDE.md` exists to prevent and it was not in it.

**The second cost was smaller and the same shape**: nothing said the browser suite had no
way to exercise a server-side third-party call, so the plan budgeted for losing that
coverage rather than for building the twenty lines that keep it.

## What CLAUDE.md did not say

1. **That an ingredient line has a contract, and where it is written.** Now in `CLAUDE.md`
   under *An import is two stages*, as three rules with the reason attached (comma, unit
   behind an amount, no heading lines) plus the `UNITS` ⊆ `UNIT_WORDS` binding — and enforced
   by `tests/unit/recipe-normalize.test.ts`, which runs every unit in the enum through
   `shoppingText`. The convention needed a test because the failure is silent; a paragraph
   alone would not have been enough.
2. **That a server-side third-party call can be stubbed for the browser suite.** Now in
   `CLAUDE.md` under the same heading, naming `e2e/helpers/anthropic-stub.mjs` and
   `ANTHROPIC_BASE_URL`. The pattern generalises to anything else this app ever calls out to.
3. **That a structured output constrains less than its zod schema does.** Now in `CLAUDE.md`
   under *An import is two stages* and at length in `docs/design/recipes.md`: the SDK drops
   what the wire format cannot carry, so validate on receipt. This generalises well beyond
   the importer and is the finding here most likely to save somebody else an afternoon.
4. **What the deployment's function time limit actually is.** Still not known. `maxDuration`
   is set to 60 on `/recipes` as a backstop, and the plan flagged checking it against the
   Vercel plan's cap — which cannot be done from here. If imports start dying at a suspiciously
   round number of seconds in production, that is this.

## Decided rather than known

- **An unrecognised unit is dropped rather than refused.** The recipe loses that one word.
  The alternative — the SDK's own behaviour, throwing on the whole answer — loses the recipe.
  Neither has been seen happen yet.
- **`claude-sonnet-5` at `low` effort.** The user chose Sonnet over Opus on cost. Low effort
  is mine: the job is mechanical once the language is understood. If imports come back
  mis-split on awkward captions, raise the effort before changing the model.
- **`MAX_INPUT_CHARS = 24_000` and a 12,000-character body-text cap.** Both round numbers
  picked to bound a pathological page, neither measured against a real long recipe blog.
- **`NORMALIZE_TIMEOUT_MS = 25_000`.** Chosen to sit inside a 60-second function with an
  8-second page fetch in front of it, not from any measurement of how long the call takes.
- **The body-text fallback is new behaviour, not a refactor.** A page with no structured data
  used to be refused and now gets read. It is the change most likely to produce a surprising
  import, and it is safe only because the reader can answer "this is not a recipe" — which is
  a judgement being trusted, not a guarantee.
- **The prompt-injection position is "say so in the system prompt and refuse".** The text is
  attacker-chosen and goes to a model whose output is written into a form. The blast radius
  is small — a cook reviews it before saving — but it is untested, because testing it means
  asserting what a model does with a hostile page.
- **Groups are computed and then thrown away.** The model reasons about components so it does
  not merge the dough's butter with the filling's, and then the rendering flattens them. A
  recipe with two components loses the labels on its ingredients (the steps keep theirs). The
  alternative was heading lines, which `writeRecipesToList` would put on the shopping list.

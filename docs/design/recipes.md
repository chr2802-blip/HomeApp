# Recipes: categories, the new-recipe dialog, and importing from a link or a reel

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## A recipe is filed under one category or several

`RecipeCategoryLink` is the pairing, and a recipe has at least one: a lasagne is both a
weeknight dinner and Italian, and being made to choose means filing it under whichever
came to mind first and then failing to find it under the other. The recipes page shows it
under each of its headings — until a filter is on, where only the heading that was asked
for is drawn.

The picker sends one `CATEGORY_FIELD` entry per box ticked, so it is read with
`readCategoryChoice` rather than through the schema: `readForm` builds its object with
`Object.fromEntries`, which keeps only the last of a repeated field. An action checks
every chosen id through `homeDb` before writing, and **a recipe left under no heading is
refused** — it would still be saved, and simply not appear on the page that lists the
household's recipes.

A category that still holds recipes cannot be deleted, by the action and by the foreign
key both. Untick it on those recipes first.

## A new recipe starts by asking how, not with a field buried in the form

`NewRecipeDialog` (`src/components/new-recipe-dialog.tsx`) is what the "New recipe"
button on `/recipes` opens, and it is a small choice before it is a form: **Start from
scratch** or **Import from a link**, because the two ways of beginning a recipe are a
decision the cook makes once, up front, not a field to notice partway down a form they
have already started filling in. `/recipes/new` and `/recipes/[id]/edit` are the plain,
unlinked pages this dialog's `RecipeFields`/`RecipeForm` grew from — they still work as
direct links, but the dialog is what the button actually opens, and it carries no import
step of its own.

The dialog has three steps (`"choose" | "url" | "form"`), all inside the one `Modal` so
opening it never feels like leaving the page: **choose** offers the two buttons above;
**url** is `RecipeImportField`, on its own rather than as a field on the create form,
because fetching is a side trip that may fail and folding it into the same submit as
saving would make one Save button mean two different things; **form** is the ordinary
`RecipeFields`, seeded with either nothing or whatever came back from the fetch. The step
resets to **choose** on every *open* rather than on close — resetting on close would
show the sheet flashing back to the choice screen while it is still animating away.

**The button reads the clipboard before it decides which step that is.** A cook who
copied a recipe's own link specifically to bring here did not copy it to be asked
"how do you want to start" — `clipboardRecipeUrl` checks, and a web address found there
sends `openFresh` straight to **url** with it already seeded, where `RecipeImportField`
starts the same fetch a press of the button would, once, on arrival. That check runs
*before* the sheet opens rather than after, so it is never seen choosing: opening on
**choose** and then jumping to **url** a moment later would show exactly the flash the
close-vs-open reset above exists to avoid. Anything else on the clipboard — nothing,
plain text, a browser that will not say (Safari has no `readText` at all; Chrome can
refuse silently when the page lacks focus) — is treated the same as if there had been
nothing to check, which is the ordinary **choose** screen this always showed.

**A browser that will not say is not always a browser that says so**, which is why that
read is raced against `CLIPBOARD_GRACE_MS`. `readText()` can sit unresolved behind a
permission decision nobody is going to make — a headless Chromium with the permission
ungranted does exactly this — and since the sheet opens *after* the check, a promise
that never settles is a "New recipe" button that does nothing at all: no sheet, no
error, nothing to see. Not waiting past half a second turns that back into the same
"nothing to prefill" every other unanswerable clipboard is. The browser suite pins it
with a `readText` stubbed to never settle, because a browser that merely *refuses* —
which is what CI's does — takes the `catch` and never visits this path. Choosing
**Import from a link** by hand always starts blank, even moments after an automatic
fetch from the clipboard found something: a deliberate press is not the clipboard
speaking again.

**Importing is two stages, and the split is the point.** It was not always: the first
version had one program per route — `parseRecipeFromHtml` picking fields out of a page's
`schema.org` markup, and a page of heuristics taking a reel's caption apart by line length
and heading words — and each of them was, in its own way, the thing that decided what a
recipe was.

Neither was badly written. Both were pattern-matchers being asked a question patterns
cannot answer, and they failed in the two ways that follows from:

**Duplicates.** Markup is written by a site's CMS, not by the cook, and the shapes are
endless. A container tagged `recipeIngredient` whose children carry the same attribute
returned every line twice. A `HowToSection` with both a `name` and a `text` saying the same
thing contributed both. Steps written `<li><p>…</p></li>` matched both halves of a `li, p`
selector and came back in pairs. A selector cannot see that two lines are the same
ingredient; it can only be aimed more carefully, and the next site is aimed differently.

**Disagreement.** A caption read as a recipe by one program and a page read as a recipe by
another meant that what a cook got depended on which door they came in by. The heuristic
side had thresholds to be wrong about — `looksLikeIngredient` said a line under 45
characters with no full stop and at most six words, `INGREDIENTS_WITHOUT_HEADING` said three
of them before a caption counted — and a caption that missed one was cut in half at the
wrong line or refused outright.

So the reading moved to one place and the parsers kept only the half they were good at.

**Stage one gathers text.** `src/lib/recipe-extract.ts` reads the JSON-LD block first
because it is self-contained, fills in blank fields from Microdata because a page mixing the
two is common and complete in neither alone is not a page to give up on, and labels what it
found (`TITLE:`, `INGREDIENTS:`, `INSTRUCTIONS:`) so the reader knows which of it the site
itself called its ingredients. `src/lib/reel-import.ts` does the equivalent for a reel: the
addresses that will hand over a caption to a caller with no account, and the reading of what
comes back. Neither decides anything. Their only failure is a page with no text on it.

**A page publishing nothing structured now falls back to its visible words**, which the old
importer refused outright. That refusal was right at the time — a scraper guessing which
paragraphs are ingredients fills a cook's form with a cookie banner, and clearing that out
costs more than typing the recipe would have. It stopped being right the moment the guess
moved somewhere that can answer "there is no recipe here". The furniture goes first
(`script`, `style`, `nav`, `header`, `footer`, `form`, `aside`) and the text is capped:
the reader is being asked to find a recipe, not to read a comment section.

**Stage two is `src/lib/recipe-normalize.ts`**, one `claude-sonnet-5` call with a
zod-constrained answer, and it is the only thing in this app that reads text as a recipe.
Sonnet rather than the largest model, and `low` effort, because the job is mechanical once
the language is understood — this is tidying a caption, not inventing a dish — and because a
failure is visible immediately: the form opens pre-filled and wrong in front of the person
who pasted the link, not quietly into a database. Structured output goes through
`messages.parse` with `zodOutputFormat`, so the schema that describes the answer and the
schema that validates it are the same object.

**There is deliberately no fallback to the old parsers.** They were deleted rather than kept
as a floor for when the key is missing or the API is down. A floor made of the thing that was
getting it wrong is two answers to the same question, which is the failure mode most of the
conventions in `CLAUDE.md` exist to prevent — and it is worse here than usual, because the
worse answer would arrive silently and look exactly like the better one. No key is a refusal,
with the paste box and the plain create form beside it, and the failure is written to the log
as one JSON line: a household quietly unable to import anything for a week because a key
expired looks, from the outside, exactly like a household that stopped importing.

**The rendering back down to two text blocks is the part that had to be exactly right.** A
recipe is stored as it always was — one ingredient to a line, one step to a line — and
nothing else in the app moved. But an ingredient line is not free text: the recipe page
splits it with `ingredientLines`, `writeRecipesToList` turns each one into an errand through
`shoppingText`, `pantryKey` matches it against the cupboard, and `staplesOf` ranks meal
suggestions on it. So `renderNormalized` is written against what those four can take apart:

- **Everything discretionary goes after a comma.** `shoppingText` cuts a line at its first
  comma, so "Salt, efter smag" becomes "Salt" and finds the cupboard's salt. In brackets it
  would become "Salt (efter smag)" and match nothing — the same line, the same information,
  and a pantry that has silently stopped working.
- **A unit is only ever written behind an amount.** `shoppingText` strips a unit word only
  where an amount preceded it, so "knivspids salt" is a thing to buy called knivspids salt.
- **A component is never a heading line of its own.** "Til dressingen:" would read perfectly
  well on the recipe page and would also go onto the shopping list as an errand. So the
  groups live in the model's reasoning — which is what stops the dough's butter being merged
  with the filling's — and surface only as a prefix on the steps, which nothing parses.
- **Amounts are written as a cook writes them**: `1.5` becomes `1½`, and anything that is not
  a familiar fraction gets a comma. Both shapes are ones `LEADING_AMOUNT` already matches.

**And the units are a closed list bound to `UNIT_WORDS`.** This is the rule with the least
obvious failure and the worst one. `shoppingText` strips a unit word **it recognises**; one
it has never heard of stays attached to the ingredient. A model writing "2 tablespoons salt"
— perfectly good English — produces a shopping row reading "Tablespoons salt", which matches
no pantry entry and never merges with the "Salt" the last recipe added. Nothing errors.

**Where that list is enforced turned out not to be where it was written.** The schema says
`z.enum(UNITS)`, and the natural assumption is that the model therefore cannot answer
anything else. It can: the SDK converts the schema for the wire and drops the keywords the
API's own format does not carry, so the enum arrives as a plain `{"type": "string"}` with the
values written into its `description`. A structured output constrains less than its zod
schema reads as though it does — worth knowing generally, and not something a type error
would ever have revealed.

**The same trap had a second door, and that one reached production.** The unit was fixed;
`totalTimeMinutes: z.number().int().positive()` was not. `positive` is a constraint the wire
format cannot carry either, so it arrived at the model as a line of description — and a
model with a number-shaped field in front of it answers `0` for "the text did not say" often
enough that it happened within hours. The API considered that answer entirely valid. The SDK
then validated it against the original zod schema on the way back, threw, and every cook saw
"Couldn't read that recipe just now" on a recipe that was perfectly fine.

So the rule is now general rather than about units: **the schema asserts only what is worth
losing the entire import over**, and `renderNormalized` coerces everything else, where a
wrong value costs one field instead of the recipe. A zero or a negative becomes null; a
fraction is rounded. What is left that can still fail is a recipe with no title and nothing
to cook, which is a recipe there is nothing to show anyway.

Loosening the fields turned up a third edge in the same corner, caught by a test rather than
by production this time: **`.describe()` has to come before `.nullish()`.** The other way
round, the converter hoists the inner type into `$defs` and drops every description — so the
unit list, "the ingredient alone, not '1 stort hakket løg'", "a decimal, never 1 1/2", all of
it, silently gone from what the model receives. With the constraints no longer travelling
either, those descriptions are most of what shapes the answer, and losing them would have
degraded every import with nothing to show for it.

So the field is a plain string now, honestly, and `canonicalUnit` is the check: on the way
back, lower-cased, kept only if it is in `UNIT_WORDS`. It asks `UNIT_WORDS` rather than
`UNITS` because the real question is not "is this one of the ones we suggested" but "can
`shoppingText` strip this off the front of an ingredient" — so a model answering "gram"
instead of "g" is fine, and one answering "sticks" loses that one word and nothing else.
Dropping beats refusing: the stricter alternative is what the SDK does by default, which is
to throw on the whole answer, losing a good recipe over a single wrong noun.

`tests/unit/recipe-normalize.test.ts` runs every value in `UNITS` through `shoppingText` and
asserts what comes out, so the offered list and the enforced one cannot part company — the
same arrangement `tests/unit/storage.test.ts` has for a kind's name in TypeScript and its
colour in the stylesheet. It also asserts that the wire schema carries no enum at all, as a
canary: if a future SDK starts carrying it, the check here could be tightened.

For the same reason the recipe **keeps its own language**. A Danish reel stays Danish: the
units a Danish kitchen writes are the ones the pantry was built on, and translating would be
the importer rewriting a recipe rather than cleaning it.

**A page's own `totalTime` still beats the reader's.** `PT1H30M` in a schema.org field is
the site stating the answer outright; a number read back out of prose is an inference,
however good. Recorded as a single number of minutes rather than prep and cook apart, because
nothing in this app answers a question the two would disagree about: the recipe list's time
filter (`RecipeDirectory`) is a straight "under 30 minutes or not", the same question a cook
actually has on a Tuesday.

**A link that will not import is not a dead end.** `notARecipe` on `ImportOutcome` marks
every failure where trying the same link again will do the same thing — a shop page, a reel
whose description could not be got at, a reader that would not answer — as distinct from a
mistyped address or a page that would not load, which are worth retrying as typed.
`NewRecipeDialog` turns that flag into a "Start from scratch" button and the paste box beside
the error, which matters most when a clipboard link sent the dialog straight to the **url**
step with no **choose** screen behind it. The flag, not the error string, is what the client
checks: `recipe-import.ts` pulls in `sharp` and `recipe-normalize.ts` pulls in the Anthropic
SDK, neither of which may be bundled into a client component. Only types cross.

The three failures are worded differently on purpose, because they ask the cook for different
things. Meta refusing a signed-out request says nothing about the post. A description that
was read and is not a recipe is usually `og:description`'s truncated copy of one, which
pasting the whole thing fixes. The reader being down is this app's own fault and will pass.

**The link is fetched from this app's own server, not the cook's browser**, so it is checked
the way a server fetching an address it was merely handed has to be: `isBlockedHost` refuses
the machine's own network (loopback, link-local, the private ranges) before anything is
requested, and the response's own `url` is checked again after redirects — a page can send an
outside address to an inside one. Size and time are both bounded, because the page is
whoever pasted the link's choice, not this app's. **The importer is also rate limited now**
(`checkRateLimit("import", …)`, the audit's S3), which matters more than it did: an import
spends a model call as well as two fetches.

**And the text is data, never instructions.** It comes from a page whoever pasted the link
did not write, and it is going to a model. The system prompt says so outright, and a page
that addresses the reader — asking it to ignore its rules, to write something particular into
the recipe — is a page with no recipe on it: `isRecipe: false`. The blast radius is small
either way (text into a form a cook reviews before saving), but it is the kind of small that
only stays small on purpose.

**The recipe's own picture comes back too, fetched and stored the same way any upload is**,
and **only once the reading has come back good** — there is no point storing bytes for a page
that turned out not to be a recipe. `image` is usually relative to the page it was found on,
so it is resolved against the address this app actually landed on, not the link that was
pasted; for a reel that is whichever of `captionSources`' addresses answered, which is why
the resolution happens there rather than downstream. The result is checked by `isBlockedHost`
exactly as the page's own redirect is. The bytes are downscaled server-side (in
`downscaleForStorage`, the one place in the app doing on the server what `lib/downscale.ts`
does in the browser, because there is no canvas here) and written through `storePhoto`, which
measures them exactly as it measures any other upload. A picture that cannot be fetched or
does not survive that check is left out, quietly — decoration for a recipe that is otherwise
complete, never a reason to refuse one that was.

The video link and categories are the create form's own fields regardless of how it was
reached, since no page publishes either in any standard way and they are this household's
choices to make.

**What the reader wants checked is said, not swallowed.** `needsReview` and `reviewReason`
come back from the schema and reach the form as one amber line above the fields: a caption
that stopped mid-sentence, amounts it sent the reader to a link for. A recipe that needs
checking is more use than no recipe, and the form is already the step where the checking
happens — this only says where to look. It is the same vocabulary `ActionResult.note` uses
for what the pantry left off a shopping list, and for the same reason: something quietly
missing reads as something the app lost.

## A reel keeps its recipe in the caption, so that is what is extracted

A reel is the one link a page's markup can only ever be silent about. Instagram, Facebook
and TikTok publish no `schema.org/Recipe` and are not going to, so the page loads perfectly
and has nothing on it for `recipe-extract.ts` to find. What a recipe reel has instead is the
paragraph under the video: whoever posted it wrote the ingredients and the steps there,
because there is nowhere else on that page to put them.

So **a reel takes a second route through stage one**, chosen by `isReelUrl` before anything
is fetched. There is one opinion in this app about what counts as a reel and it is
`captionSources` in `src/lib/reel-import.ts`: a link it has no addresses for is not a reel,
and takes the ordinary route. `parseSocialEmbed` in `embed.ts` knows the same hosts for a
different job — building an iframe `src` for the browser — and the two are deliberately
apart, because one is about what this app fetches and the other about what the recipe page
renders.

**What it is not any more is a second route through the *reading*.** It was, and
`caption-recipe.ts` was 382 lines of heuristics doing it: heading sets in two languages, a
`looksLikeIngredient` that called a line shopping if it was under 45 characters with no full
stop and at most six words, a `runOfIngredients` counting how many such lines a caption
opened with, and a bar of three before any of it counted as a recipe at all. Every one of
those numbers was a guess, and the module has been deleted. A caption now goes to the same
reader a web page's text goes to, so a description means one thing in this app however it
arrived. What is left here is extraction: which addresses to ask, and how to get a caption
out of what each one answers.

**None of the addresses is a supported API, and the design says so out loud.** Instagram's
`/embed/captioned/` is the page its own embed widget loads; Meta's real oEmbed needs an app
token this household does not have; TikTok's oEmbed is the one genuinely open endpoint of the three. The sources
are therefore a list tried in order, best first, and **all of them failing is an ordinary
outcome rather than a bug** — Meta refuses a signed-out request from a datacenter often
enough that a feature resting on it alone would be a feature that works on a laptop and not
on Vercel. Once a caption *has* been read the chain stops: there is nothing another address
could add, and asking Instagram twice will not change the reader's mind about whether the
text is a recipe.

### Then the markup went, and the caption was still in the page

The first version of this read two places: a `.Caption` element on the embed page, and
`og:description` on everything else. Within a fortnight of shipping it, both Instagram
addresses started answering the same way — 200 OK, no login wall, six hundred kilobytes,
`hasCaptionElement` false and `hasOgDescription` false. The `reel_caption_source`
diagnostics written for exactly this moment said one more thing the raw failure never
could: the two bodies were **within thirty-five bytes of each other**, which is the
difference between the two addresses appearing in them and nothing else. The same
application shell, for the post page and the embed page alike. Asking as a crawler rather
than as a browser had made no difference either.

An application shell still has to *get* the post from somewhere, and a page that made a
second request for it would be a page that rendered a frame late — so Instagram inlines it,
as JSON, in a `<script>` tag. That is what `captionFromEmbeddedJson` reads, and it is
deliberately the **third** place looked rather than the first: the caption element and
`og:description` are Instagram stating what the post says, and this is reading over its
shoulder. It is also the one most likely to survive the next redesign, because those names
are an API's field names rather than a page's class names — three generations of them are
in circulation at once (`edge_media_to_caption`, `caption.text`, `caption_text`), which is
itself the evidence that the names outlive the markup.

**The object is lifted out by matching braces and handed to `JSON.parse`, never picked
apart by pattern.** A caption is free text: it contains quotes, braces and escaped
newlines, and a regex that reads one caption correctly is a regex that truncates the next
one at its first `"`. Matching braces is more code and cannot be wrong about where the
object ends.

Two smaller things came out of the same log. The `/p/` embed address is now asked as well
as the reel-shaped one, since a reel is also a post and the two are not obviously served by
the same thing. And the diagnostics gained `mentionsCode` and `hasInlineMediaJson`, which
are the pair that says whether reading the page harder could ever have worked: a body that
never mentions the post's own code was never told which post it is for, and no parser can
find a caption that was not sent. That is the difference between "a shape we have not
learned yet", which is an afternoon, and "there is nothing there", which is not a parsing
problem at all.

**Which is why the paste box is the load-bearing half.** `importPastedCaption` takes a
description the cook pasted themselves straight to stage two — no fetch, no markup, nothing
anyone else can refuse. It is offered on any `notARecipe` failure *and* from a button under
the link field, so a cook who already knows how this reel ends does not sit through two
eight-second timeouts to be handed a box they were always going to use. It has quietly
become the answer to a second kind of failure as well: with the reader being the only reader,
a key that has stopped working leaves the box as the only way in, and it still is one.

**A reel fills the video link, which an ordinary recipe page does not.** There the pasted
link *is* the video, so `ImportedRecipe.videoUrl` carries it and the recipe page plays it
through the embed `embed.ts` already builds — including on the paste route, where it is the
one thing the pasted text cannot say. The poster frame is the nearest thing a reel has to a
photograph of the finished dish and is stored exactly as any upload is, quietly failing like
any other picture rather than refusing a recipe whose text was perfectly good. Its address
is resolved against whichever source answered rather than against the reel link, which has
to stay what it is so the video points at the post.

## The same recipe, read at the hob

A recipe page is a reference document: ingredients on the left, a numbered method on the
right, everything visible at once. That is the right shape for deciding what to cook and
for putting the shopping on a list. It is the wrong shape for standing at the stove, where
the question is never "what does this recipe contain" but "what am I doing now, and what
do I need in front of me for it" — and answering it from the reference shape means
reading a step, looking across at the ingredients, working out which of the eleven lines
that step meant, and doing it again for the next one, with wet hands.

**Action mode is the second reading, not a second recipe.** One step to a screen, the
ingredients that step uses beside it, and the pages turned like a cookbook's. Nothing
about the recipe changes.

### What the two text blocks cannot say

Everything action mode needs was already stored except one thing: nothing in
`ingredients` points at anything in `instructions`. They are two independent blocks of
text written by two different sentences of the same cook.

The tempting way to bridge them is to match words — take "Kog kartoflerne i 10 minutter",
look for ingredient lines mentioning kartofler, show those. It reads as obvious and it is
the same mistake this app already made once, in the same file's history: a pattern-matcher
asked a question patterns cannot answer. "Vend dem i olien" names no ingredient at all.
"Salt" appears in a step about salting the water and in one about seasoning at the end,
and only one of them means the cupboard's salt. A recipe with both smør in the dough and
smør in the filling has two right answers and the matcher picks whichever is written
first. Each of those is a wrong ingredient shown confidently to somebody cooking.

So it is read once, by the thing equipped to read it, and stored.

### The breakdown holds no text, and that is the whole of its safety

`Recipe.cookSteps` is one entry per line of `instructions`, in order, each naming
*indices* into `ingredientLines(ingredients)` and the step's own minutes:

```json
{ "v": 1, "steps": [{ "uses": [0, 3], "minutes": 10 }, { "uses": [], "minutes": null }] }
```

It was tempting to store the steps' text here too, which would have made every reader
simpler. It would also have been a second answer to "what are the steps" — the failure
mode most of `CLAUDE.md` exists to prevent, and worse here than usual, because the copy
that quietly disagreed would be the one somebody is holding at the hob while the recipe
page shows the other. Storing positions instead means the steps are `instructions` and an
ingredient is its own stored line, verbatim, with nothing anywhere to drift from.

What positions cost is that they are only meaningful against the exact text they were
derived from. Insert a line at the top of the ingredients and every index is off by one,
with no step having changed. So:

**A write that changes `ingredients` or `instructions` also writes `cookSteps`** — to a
fresh breakdown, or to null where the reader could not answer. That is the invariant, it
lives in `createRecipe` and `updateRecipe`, and `tests/integration/recipes.test.ts` holds
it from both sides: a changed block clears it, an unchanged one leaves it alone.

**And the count is the net under that.** `cookSteps` in `src/lib/cook.ts` refuses a stored
breakdown *whole* unless it holds exactly one entry per instruction line. Not the entry
that looks wrong — all of them. There is no way to tell which of a stale breakdown's
entries still line up, and half a right answer is indistinguishable from a wrong one when
what it produces is a plausible list of ingredients under a step. An index past the end of
the ingredients is the one thing dropped on its own, because what is left is still a
subset of what that step genuinely referred to.

A fingerprint of the source text would have been the stricter guard, and was left out: it
is a second column to keep in step, and the invariant above is what actually holds this
together. The count check costs nothing and catches the shape of failure that matters.

### An unprepared recipe still cooks

Every recipe written before this existed has no breakdown, and so does one saved while the
reader was down. Those show their steps plainly — no ingredients, no timers — with the
offer to prepare them on the first page.

That is honest degradation rather than a floor made of the thing that was getting it
wrong. Showing no ingredients says "this has not been worked out"; showing guessed ones
says "these are the ingredients for this step", which is a sentence the app would have no
grounds for. The same reasoning that deleted the heuristic caption parser rather than
keeping it as a fallback.

### A second question, not a second reader

`prepareCookSteps` (`src/lib/cook-steps.ts`) is a model call sitting beside
`normalizeRecipe`, and the distinction between them is what makes it allowed to exist.

The normalizer is asked **"is there a recipe in this text, and what is it"**, about text
nobody in the household wrote — a scraped page, a caption, something that may not be a
recipe at all. This one is asked **"how is this household's own recipe cooked"**, about
lines that are already stored, already numbered, and already the answer to what the recipe
contains. Neither can give the other's answer, so there is nothing for them to disagree
about. Two readers of the same text would have been the old `caption-recipe.ts` mistake
wearing a new hat.

It follows that **the ingredient lines are handed over and never rewritten**. They are the
contract `shoppingText`, `pantryKey`, `writeRecipesToList` and `staplesOf` all read, and
the whole point of the answer coming back as numbers is that no new wording of an
ingredient enters the system. The steps it may rewrite — a run-on instruction covering
three jobs becomes three steps, a component heading is carried into the steps it belongs
to rather than left as a screen to swipe past — and that rewrite goes into
`Recipe.instructions`, the one copy both readings share.

The two traps from the importer apply here unchanged, and for the same reasons: **nothing
in the schema narrows a value**, because a constraint the wire format drops is one the
model can innocently break and the SDK then throws the whole answer away; and **every
`.describe()` comes before its `.nullish()`**, or the converter hoists the type into
`$defs` and the description never travels. `uses` is the field that matters most — without
its description the numbers coming back are anchored to nothing.

### It runs inside Save, which is a cost accepted on purpose

Preparing a recipe happens in the same press that saves it, so the cook is waiting on a
model call behind a pending button. The alternative — return immediately and prepare it in
the background — saves those seconds and spends something worse: the recipe's own steps
would rewrite themselves a few seconds after the cook had finished reading them, on a page
they were already looking at. A press that takes a moment is comprehensible. A page that
changes by itself is not.

It runs only where the answer could have changed: a title-only edit does not re-read, which
also stops the steps drifting a little further from the cook's own words on every unrelated
save. `prepareRecipeSteps` is the same work on request, from inside action mode, for a
recipe that has never had it.

A reader that is down never fails a save. The recipe stores exactly as typed and the column
clears — nothing about a model being unavailable should stand between somebody and writing
down a recipe.

### The surface, and why it is portalled

Action mode is a route (`/recipes/[id]/cook`) so it has an address: the phone's back
gesture leaves it, and a screen locked mid-dinner comes back to the same step.

It draws itself as a `fixed inset-0 z-50` surface **portalled to `document.body`**, and
that is not a preference. The app's layout animates the page it renders with a keyframe
that puts a `transform` on an ancestor, and a transformed ancestor contains a fixed child —
rendered in place, the surface would be trapped under the header and the tab bar for as
long as that animation ran. Portalling also clears the tab bar's own `z-40`, and
`data-theme` still reaches it, since that lives on `<html>`. `e2e/cook-mode.spec.ts` asks
the browser what is actually at the tab bar's coordinates, because that is the assertion
that would fail if this were ever moved back.

Being outside the frame means it pads its own `env(safe-area-inset-*)`: nothing else is
doing it, and every inset is zero in a desktop browser, so getting it wrong is invisible
until somebody holds a phone.

The turn is a leaf swinging about its spine — two keyframes under a perspective, forward
from the left edge and back from the right — replayed by a `key` on the page, because an
animation runs on mount and a transition needs a state the browser has already painted.
**Leftwards turns forward**, which is what lifting a book's right-hand page over does and
what every gallery on the phone already means by the gesture. The gesture itself is
`meal-week.tsx`'s, down and up with a threshold and no live drag, because two swipes in one
app that disagree about what a swipe is are worse than either.

The screen stays awake for as long as it is open, with no toggle: somebody who has opened
the cooking view has already said what they are doing for the next half hour.
`ScreenAwakeToggle` and this share `useWakeLock` rather than keeping two copies of the
awkward parts — asking, being refused, and getting the lock back after the tab was hidden.

Timers live above the pages rather than on them, so turning to the next step does not end
the one counting down on the last. They are in memory only and do not notify: a timer that
survived leaving would want the service worker, which is a feature of its own, and the wake
lock is what keeps the phone showing them meanwhile.

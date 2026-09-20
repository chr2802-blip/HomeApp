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

**Importing reads the page's own structured data rather than scraping it.**
`src/lib/recipe-import.ts` reads the `schema.org/Recipe` markup almost every recipe site
already publishes for search engines, in whichever of its two standard shapes that
site's own software produced: **JSON-LD**, one self-contained `<script>` block, read
first because there is nothing to gather; and **Microdata**, `itemscope`/`itemtype`/
`itemprop` attributes scattered across the page's own elements, read with `cheerio`
because a proper parser is what scattered attributes need. A page publishing both is not
unheard of, and one field missing from whichever came first is filled in from the
other — a recipe is refused only when neither has enough to cook from. A page with
neither, or with a name but nothing to cook, is refused rather than guessed at from
prose: a wrong guess dropped silently into the form is worse than a cook typing it in by
hand, which is what happens either way once the fields are left blank.

**A link that reaches a page with nothing to cook from is not a dead end.** `notARecipe`
on `ImportOutcome` marks exactly that failure — a shop page, anything the parser
above refuses — as distinct from a mistyped address or a page that would not load, which
are worth retrying as typed rather than abandoning. `NewRecipeDialog` turns that flag into
a "Start from scratch" button beside the error, which matters most when a clipboard link
sent the dialog straight to the **url** step with no **choose** screen already behind it
to fall back to. The flag, not the error string, is what the client checks:
`recipe-import.ts` pulls in `sharp` for the image work below, which cannot be bundled into
the client component showing the error, so nothing runtime from that module may be
imported there — only its types already were.

The link is fetched from this app's own server, not the cook's browser, so it is checked
the way a server fetching an address it was merely handed has to be: `isBlockedHost`
refuses the machine's own network (loopback, link-local, the private ranges) before
anything is requested, and the response's own `url` is checked again after redirects —
a page can send an outside address to an inside one. Size and time are both bounded,
because the page is whoever pasted the link's choice, not this app's.

**The recipe's own picture comes back too, fetched and stored the same way any upload
is.** `image` in JSON-LD or Microdata is usually relative to the page it was found on,
so it is resolved against the address this app actually landed on, not the link that
was pasted — and the result is checked by `isBlockedHost` exactly as the page's own
redirect is, because a page's markup pointing at an internal address is no more to be
trusted than a redirect doing the same. The bytes are downscaled server-side (in
`downscaleForStorage`, the one place in the app doing on the server what
`lib/downscale.ts` does in the browser, because there is no canvas here) to the same
`MAX_EDGE`/`THUMB_EDGE` and written through `storePhoto`, which measures them exactly as
it measures any other upload. A picture that cannot be fetched or does not survive that
check is left out, quietly — decoration for a recipe that is otherwise complete, never a
reason to refuse one that was.

The title, ingredients, instructions, picture and total time come back from a fetch; the
video link and categories are the create form's own fields regardless of how it was
reached, since schema.org has nothing standard to say about either and they are this
household's choices to make either way. Time is a schema.org field like the others, read
as `totalTime` where a site publishes it and as `prepTime` plus `cookTime` where it does
not — both in `PT1H30M`-style ISO 8601, the one shape the standard allows. Recorded as a
single number of minutes rather than kept as prep and cook apart, because nothing in this
app answers a question the two would disagree about: the recipe list's own time filter
(`RecipeDirectory`) is a straight "under 30 minutes or not", the same question a cook
actually has on a Tuesday, and offered only once something in the home has a time to
filter by.

## A reel keeps its recipe in the caption, so that is what is read

A reel is the one link the section above can only ever refuse correctly. Instagram,
Facebook and TikTok publish no `schema.org/Recipe` markup and are not going to, so the
page loads perfectly and has nothing to cook from — which is exactly what
`parseRecipeFromHtml` reports. What a recipe reel has instead is the paragraph under the
video: whoever posted it wrote the ingredients and the steps there, because there is
nowhere else on that page to put them.

So **a reel takes a second route through `recipe-import.ts` entirely**, chosen by
`isReelUrl` before anything is fetched. There is one opinion in this app about what
counts as a reel and it is `captionSources` in `src/lib/reel-import.ts`: a link it has
no addresses for is not a reel, and takes the ordinary route. `parseSocialEmbed` in
`embed.ts` knows the same hosts for a different job — building an iframe `src` for the
browser — and the two are deliberately apart, because one is about what this app
fetches and the other about what the recipe page renders.

**The three parts are split by what can be wrong about them.**
`src/lib/caption-recipe.ts` is text in and text out, no network and no database, because
the half that can be wrong while everything else works is the *reading* — which line was
a heading, which was an ingredient, where the hashtags started.
`src/lib/reel-import.ts` is the addresses and the markup: which endpoints to ask, and
how to get a caption out of what each one answers. `recipe-import.ts` keeps the fetching,
so every outbound request from a pasted link still goes through the one `isBlockedHost`,
the one timeout and the one size limit.

**None of the addresses is a supported API, and the design says so out loud.**
Instagram's `/embed/captioned/` is the page its own embed widget loads and is the only
one that carries a caption to a caller with no account; Meta's real oEmbed needs an app
token this household does not have; TikTok's oEmbed is the one genuinely open endpoint
of the three. The sources are therefore a list tried in order, best first, and **all of
them failing is an ordinary outcome rather than a bug** — Meta refuses a signed-out
request from a datacenter often enough that a feature resting on it alone would be a
feature that works on a laptop and not on Vercel.

**Which is why the paste box is the load-bearing half.** `importPastedCaption` reads a
caption the cook pasted themselves, through the very same parser, so a caption means one
thing here however it arrived — and that route nothing on Meta's side can block. It is
offered on any `notARecipe` failure *and* from a button under the link field, so a cook
who already knows how this reel ends does not sit through two eight-second timeouts to
be handed a box they were always going to use. The two failures are worded apart
because they ask for different things next: a caption that could not be read at all, and
one that was read and is not a recipe — the second is usually `og:description`'s
truncated copy, which pasting the whole thing fixes.

**A reel fills the video link, which an ordinary recipe page does not.** There the
pasted link *is* the video, so `ImportedRecipe.videoUrl` carries it and the recipe page
plays it through the embed `embed.ts` already builds — including on the paste route,
where it is the one thing the pasted text cannot say. The poster frame is the nearest
thing a reel has to a photograph of the finished dish and is stored exactly as any
upload is, quietly failing like any other picture rather than refusing a recipe whose
text was perfectly good.

**The parser is shy on purpose.** A caption it cannot recognise is refused rather than
turned into a recipe whose ingredients are somebody's tagged friends: a cook handed a
form full of nonsense has to clear it out before typing the real thing, so a bad guess
costs more than no guess — the same reasoning that makes `parseRecipeFromHtml` refuse a
page rather than scrape prose off it. A caption naming a heading ("Ingredienser",
"Fremgangsmåde", and the English pair) is simply obeyed, since the cook who wrote it has
already answered the only hard question; one naming none is read by the shape of its
lines and needs three that look like shopping before it is a recipe at all. The total
time is read **only** beside a phrase that means the whole dish — a bare "20 min" is
nearly always one step's own timing, and recording that would put a two-hour braise on
the `/recipes` quick filter — and the line that said it is then dropped, or every such
caption ends with a step telling the cook how long the thing they just made takes.

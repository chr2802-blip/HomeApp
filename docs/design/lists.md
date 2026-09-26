# A list, and what ticking something off means

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## Ticking something off is the moment the list is for, and it is worth seeing

A tick used to happen where it could not be seen. The row was marked done and moved into
the completed section — closed, by default — inside the same render as the press, so the
box that was pressed was gone before it could show anything, and the only trace was the
pop on the **Completed** heading. That pop is still there; what it now pops for is a
movement whose first half is visible.

`SETTLE_MS` in `src/components/list-items.tsx` is how long a ticked row is held in the
open group before it moves: the box fills and pops, the words strike through, and the row
slides away to the right (`tick-off` in `globals.css`). The two numbers have to agree —
held for less and the row is cut off mid-slide, held for longer and a blank row waits.
It is a timer rather than an `animationend` listener because the row has to move even
where the animation never runs: a backgrounded tab, or somebody who asked the system for
less motion, where every duration in the app collapses to nothing. **Untick a settling
row and it simply stops settling**: the row is staying, and an animation about leaving
would be describing something that is no longer happening.

The press is handled in `handlePress`, beside the optimistic change rather than inside
it. React runs a form action in a transition, where an update may be held back a frame or
two, and the one thing feedback about a press must not be is late.

**A list's progress is drawn in the home's own `--accent`, and not in green.** It was
`--chart-lists`, on the reasoning that the accent dresses controls and a bar is read
rather than pressed — but `edge` below took the bar out of the card's padding and into
the card's own bottom, where there is nothing left for it to be mistaken for. Green is
"added" everywhere else in the app, so a bar that turned green on its last item would be
saying that instead; no theme is green, red or amber either, so the home's colour cannot
say one of them by accident. The storage donuts keep the chart palette: those are about
kinds that mean the same thing in every household, and this is about one household's own
week.

**On a card the bar is `edge`: flush along the bottom, full width, no radius of its
own** — the card rounds it off, which is why a card carrying one is `relative
overflow-hidden` (the three-dot panel is portalled, so clipping costs it nothing). A
card is one thing, and a rounded bar floating in its padding reads as a second thing
sitting on it. It is thinner there than the free-standing one because on the edge it is
a rule rather than a readout: the words above it carry the number.

The bar on the list's own page lives **inside `ListItems`**, not up beside the title: a
tick is optimistic, so the proportion has to be told by the same state the rows are.
Counted on the server it would sit one press behind every time, which is the one thing a
progress bar may not do. The cards on `/lists` and the dashboard draw the same bar from
stored counts, where there is no press to be behind. Everywhere it appears the same
proportion is already in words directly beside it, so the bar itself is `aria-hidden` —
a progressbar role there would only read the line twice. `data-progress` carries what it
claims, so a browser test can hold that against the width it is actually drawn at.

**Clearing the last item is celebrated once, and leaves nothing behind.** `Celebration`
throws confetti over the whole screen and takes itself off the page afterwards; `cheer`
in `src/lib/haptics.ts` is the longer buzz beside it, as `tick` is the short one for an
ordinary item. It fires from the press that empties the list, counted before the change
is applied — **a list emptied by deleting its rows reaches the same state and is not
celebrated**, because nothing was finished. The pieces are written out rather than
generated, so there is no randomness to reason about, and the overlay is
`pointer-events-none` throughout: a mis-tick stays undoable while it falls.

**Halfway is the quiet one.** Crossing half the list swells the bar once (`halfway`)
and says nothing in words — a sentence about being halfway through the shopping is a
sentence in the way of the shopping. Only upwards and only on the crossing, counted from
what the bar read before the press and what it will read after: a list ticked and
unticked around the middle would otherwise pulse on every press, which is movement that
has stopped meaning anything. The last item has the confetti instead, so this never
fires on a list of two.

**A ticked row says who got it, where there is anybody to tell apart.**
`ListItem.completedById` is written by `toggleListItem` and cleared again when the item
goes back — the mark answers "who is picking this up", which is a question about the
shop still to do, exactly like the recipe note beside it. `PersonMark` draws it: their
picture, or their initials, because a household where nobody uploaded one would
otherwise see the feature as simply missing. It is drawn only when the home has more
than one member (`shared`), since a mark saying "you" on every line is decoration, and
the name is carried into the optimistic tick (`me`) so the one row somebody is looking
at is not the only one that cannot say.

**A task is marked done at a button and nowhere else, so that is where the moment is
drawn.** A recurring task books itself in again and stays exactly where it was; there is
no row sliding anywhere. `TaskDoneButton` is the one component behind both places a task
is completed from — the card on `/tasks` and the row on the dashboard — and it rises a
tick out of the button (`stamp`) on the press, beside the same buzz a list item gets.
The spinner in `SubmitButton` says the answer has not arrived; the stamp says the press
was seen, and they are different jobs. **Reopening keeps a plain form**: an undo is not
an achievement.

## An item can say which recipe put it there

`ListItemSource` pairs a list item with a recipe, and "Add to list" on a recipe page
writes them: every ingredient line goes onto the chosen list, and each item it touched
then names the recipe underneath itself. An item nobody attached to a recipe — typed
into the add box — has no row and says nothing, which is what makes the note worth
reading where it does appear.

Three rules decide what adding means, and they are what the integration tests pin down.
A line already on the list is **wanted once more**, so the amount goes up by one rather
than a second row appearing; a line **ticked off earlier comes back at one**, because
what a ticked row carries is what was bought last time; and the pairing is **one row per
(item, recipe)**, so the same recipe added twice bumps the amounts and still names
itself once while two recipes wanting onions name both.

**The note goes when the item is ticked off**, in `toggleListItem`. It answers "why is
this on my list", which is a question about the shop still to do — once the thing is in
the basket the recipe has been dealt with, and the row is only next week's vocabulary.
Putting the item back therefore brings back the item and not the note. The rows also go
with the recipe (`onDelete: Cascade`): a note pointing at a recipe that no longer exists
has nothing left to say.

Like `ListItem` it carries no `homeId`, so `homeDb` refuses it and pages read it as an
include on a list query that went through `homeDb`. Both ids the action is given — the
recipe's and the list's — are checked against the caller's homes, because one press
sends both.

## An open list follows the household, pushed by Supabase and confirmed by asking

The first version was a poll: every three seconds the list asked
`/api/lists/<id>/version` whether its fingerprint had moved. It worked, and it was always
up to three seconds behind — long enough to reach for a carton somebody else had just put
in their basket. A shorter interval only trades the delay for requests.

**The push had to be somebody else's socket.** The app runs on serverless functions,
which cannot hold a connection to a phone, and Postgres's own `LISTEN` needs a session
connection that the transaction pooler does not give. Supabase Realtime already holds
sockets, and its Broadcast accepts a message as one plain HTTP POST, which a function can
send and forget. Postgres Changes, the other Realtime feature, was not the tool: it
authorises every row change against RLS on the app's own tables, which Prisma does not
use.

**The message is a nudge, not the change.** Broadcasting the new rows would have been a
second description of what a list looks like, beside the page's query, and the one that
disagreed would be the one on the other phone. So the payload is a list id, and hearing
it means asking the version route exactly as the timer would. The poll's two guards —
refresh only when the fingerprint differs, never twice for the same one — therefore cover
the push too, and a spoofed or doubled nudge costs one cheap question.

**It is sent from the write, not from a database trigger.** `realtime.send()` in a
trigger would catch every writer automatically, but the `realtime` schema exists only on
Supabase: every local, test and shadow database would need the trigger guarded, and
`db:check` could say nothing about it. `announceListsChanged` sits beside the
`revalidatePath` of the list's own page instead — the moment this server's copy goes
stale is the moment everybody else's does — and runs in `after`, so the press never waits.

**Private channels, one per home.** A public channel would have needed nothing but the
publishable key, which is in every browser, and a list id — and a public channel also
lets any client *send*. So the server signs a short token (15 minutes, the window a removed
member could go on hearing "something changed" in) listing the person's homes, and one
policy on `realtime.messages` reads the home back out of the topic. No insert policy: only
the server, holding the secret key, broadcasts. One channel per home rather than per list,
so a phone holds one subscription however it moves between lists, and filters by id.

**The poll stays, slower.** Broadcast is at most once: a nudge sent while a phone's socket
was reconnecting is gone. Joining the channel asks once to catch up, and while joined the
timer still asks every 30 seconds. With Realtime unconfigured — every test suite, every
laptop — nothing is loaded and the list polls every three seconds, exactly as before.

# A list works in a shop, where there is no signal

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## A list works in a shop, where there is no signal

The one screen this app is read on with no connection is a shopping list, so that is the
one screen that keeps working without one. Two halves, and they are deliberately
independent: **the page comes back from the service worker**, and **the ticks come back
from IndexedDB**.

**Every queued change says what the row should end up as, never what to do to it.** A
tick carries `done: true` rather than "flip", and an amount carries the number rather than
a step — `OfflineOp` in `src/lib/offline-ops.ts`. That is the whole reason a queue can be
sent at all: a phone that sent a batch and never heard the answer sends it again, and the
second arrival has to land on the same row as the first. A queue of flips and increments
has to arrive exactly once, which is a promise no phone in a supermarket can keep. An
**add** carries a row id chosen in the browser for the same reason: the row is created
under it, so a replay finds it already there instead of adding a second one.

**Only ticks, adds and amounts are queued.** A delete and a drag stay online-only and
simply come back when there is nothing to run them against, which reads as what it is.
Both are kitchen-table edits rather than aisle ones, and both would need a rule for what
two phones disagreeing about an order, or about a row one of them has already removed,
means. An op kind is not free — it is another way for two people to mean different things
by the same list.

**The writes live in `src/lib/list-writes.ts`, and the actions and the queue's endpoint
share them.** `setItemDone`, `addItem` and `setItemAmount` are what a tick *is*; the
actions in `src/app/actions/lists.ts` still do what an action does (check the caller's
home, refresh the three views) and `POST /api/lists/sync` does the same checks its own
way. What neither of them does is decide separately what a tick means. `setItemDone` also
guards the one thing that is not idempotent: **a week is counted only when the tick
actually changed the row**, so a queue sent twice does not report the shop twice.

**The endpoint is a route, not a server action, and that is the point.** An action's
identity belongs to the build that generated it, and the premise here is a browser that
has been away — possibly across a deploy — still holding something it has to be able to
send. It answers per op, because the browser has to tell "sent" from "will never be
sent": an applied op and a refused one both leave the queue, while a request that fails
outright leaves **all** of them in it. One bad op must never take the other nineteen with
it, which is why `applyQueuedOps` rejects rather than throws.

**The queue empties itself by asking, not by trusting.** `useOfflineList` keeps three
things apart: ops still queued (drawn over the server's rows by `applyPending`), ops the
server has just taken — **held** in front of the rows until the page has been re-rendered
with them, so a reconnection does not show the ticks flicking off and on again — and
ops the server already agrees with, which `reconcile` drops. An op somebody else in the
home made first disappears the same way, which is correct: the item is off the list, and
who did it is not what the queue was for.

**A browser that says it is online is not evidence.** `record` keeps a change when
`navigator.onLine` is false *or* when the request rejects with a `TypeError`, which is
what a request that never arrived looks like; anything else that comes out of an action is
the server having answered and is not this layer's business. Equally, a flush that carried
nothing proves nothing — it is also what a failed send looks like — so it never claims the
connection is back. `QueueStatus` says which of these the list is in, because a household
that is not told cannot tell a list that saved their shopping from one that quietly lost
it, and will stop trusting the ticks either way.

**`public/sw.js` has two jobs now**, because a browser allows one worker per scope: the
push handlers it always had, and keeping the pages a household opens while out. Pages are
**network-first** — nothing kept is ever served in front of a working network — and only
`/dashboard` and the lists are kept, the dashboard because that is where an installed app
opens and without it a phone with no signal would never reach the lists at all. Assets
are cache-first because their names carry a hash of their contents, **except** where the
request explicitly asked for no cache: a caller doing that is asking the server, and is
usually asking *about* the server, which is what `photos.spec.ts` does. The worker never
touches anything but GET; a worker that replayed POSTs would be a second, invisible copy
of the queue with no way to tell the page what it had done.

**It is registered from the app layout, on every page.** It used to be registered only by
somebody turning notifications on, which was fine while push was all it did — but what
keeps a list readable has to be in place *before* the signal goes, and a worker installed
in an aisle has kept nothing.

**Logging out takes this browser's copy of the household with it.** The login page drops
both the kept pages, each of which carries one person's rendered home, and the queue,
whose ops name rows only that session could see. Whoever opens the browser next is
somebody else until they have proved otherwise, and finding the last person's shopping
there is worse than losing a tick that a dead session could no longer send anyway.

`e2e/offline-lists.spec.ts` drives a browser that is genuinely offline (`setOffline`),
because a page that survives losing its connection and one that merely looks as though it
would are identical until something actually fails.

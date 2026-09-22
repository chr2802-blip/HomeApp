# Dialogs close on the browser's back button

- **Date** — 2026-09-21
- **Branch** — `claude/dialog-back-button-close-l00fph`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Asked for: every dialog closeable with the browser's back button, especially a phone's
swipe-from-the-edge gesture, since a sheet that swallows that gesture instead of closing
reads as broken on a phone. Followed, once the first cut was pushed, by a second ask: a
cancelled dialog must be excluded from history entirely, not leave an entry a later back
press has to spend on nothing.

What it turned out to mean: pushing a history entry when a sheet opens is the easy half,
in `Modal` itself so every sheet in the app gets it at once. The entire rest of the
session — both rounds of it — was finding out that **popping that entry back off is not
safe** in a Next.js App Router app, in two different ways, and landing on the one thing
that is: never pop it, only avoid pushing a second one where that costs nothing.

## The route

Round one — closes on back at all: idea → build → full e2e suite → 21 failures, all in
unrelated-looking specs (`lists`, `list-amounts`, `pantry`, `photos`, `recipes`) →
root-caused to `redirect()` never returning, so a form that redirects never calls the
close handler my code was consuming a history entry on → fixed that, reran → 21 down to 1
→ that one failure held up under a `--repeat-each=8`, so not a flake → read
`next/dist/client/components/app-router.js` to find out why → second, deeper bug: even a
save that does **not** redirect corrupts the page on close, because `history.back()`
restores a cached tree frozen before the save → removed the self-triggered `back()`
entirely, keeping only the open-time push and the `popstate` listener → full suite clean
→ pushed.

Round two — excluded from history: the user came back and asked for exactly the thing
round one's note flagged as unrevisited: pop the entry rather than leave it. Tried
`router.refresh()` timed to land right after the pop, on the theory that asking the
server again would paper over whatever stale tree `history.back()` restored → passed once
→ `--repeat-each=8` on the same delete-the-last-item case failed once in eight → read
`app-router.js` again, this time for `HistoryUpdater`'s `preserveCustomHistoryState` and
the App Router's own action queue → concluded the ordering between "restore the frozen
tree" and "fetch the current one" is the router's to control, not this component's, so a
race that resolves in our favour *most* of the time is still a race → gave up on popping
entirely, kept only "don't push a second entry when one is already on top" (checked via
`window.history.state`, since a variable of the component's own doesn't survive a
mutation rewriting that object) → reran the regression cases at `--repeat-each=10` and the
full suite clean → rewrote both the `CLAUDE.md` line and the `docs/design/ui-patterns.md`
section a second time to carry the trace of *both* wrong turns, not just the first.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Round one (see 2026-09-21 first pass) | ~65% of the session | Build, two history bugs found and fixed, full suite clean, pushed |
| Understanding round two's ask | 5% | One sentence; the risk was assuming it was simpler than round one |
| Building the `router.refresh()` attempt | 10% | Small diff, looked like the obvious fix |
| Finding it was flaky, not fixed | 10% | `--repeat-each=8` catching a 1-in-8 |
| Landing on and verifying the final design | 10% | `--repeat-each=10` plus a full suite, twice |

## What should have been quicker

**Trusting a passing full suite after the `router.refresh()` change without a repeat run
first was the same mistake round one's note already named — made again, one round later.**
Round one's own "what should have been quicker" said the stress run is what catches a
result that looks green by luck; round two ran the full suite once, saw green, and only
ran `--repeat-each=8` on the specific regression case as a *second* check before trusting
it — which is what caught the 1-in-8. The lesson from round one was followed, just later
in the sequence than it should have been: the repeat run belongs before the full suite is
trusted, not as a follow-up once it already passed once.

**The deeper cost is chasing a fix for a race instead of asking whether the race could be
made to not exist.** `router.refresh()`-after-`back()` treats the App Router's action
queue as something this component's timing can win against most of the time — which is
the exact shape of reasoning `CLAUDE.md`'s "a flaky test is worse than no test: fix the
race, do not add a timeout" already refuses, just not yet written down for *this* race
because round one had not found it yet. Reading `app-router.js` for the queue's own
ordering guarantees (there are none, across an `ACTION_RESTORE` and an `ACTION_REFRESH`
dispatched from outside its own reducers) before writing the refresh-based fix would have
skipped the attempt entirely.

## What CLAUDE.md did not say

Round one already closed the big one (`window.history.pushState`/`back()` are patched by
the App Router, and popping a self-pushed entry risks a frozen snapshot). Round two adds
the corollary, now in both `CLAUDE.md` and `docs/design/ui-patterns.md`: **`router.refresh()`
does not deterministically outrun a `history.back()`-triggered restore, because both go
through the same action queue and nothing outside the App Router controls which one it
finishes last.** The instinct, on finding a stale-snapshot bug from `history.back()`, is
to reach for `router.refresh()` right after — this is exactly that instinct, tried and
found insufficient, so the next session that has the same instinct can read this instead
of re-running the same `--repeat-each` to rediscover it.

## Decided rather than known

- **Excluded from history is best-effort, not absolute.** A sheet opened, then cancelled,
  then reopened on the same page collapses to one history entry — but only when nothing
  was saved in between, because `window.history.state` is what is checked to decide
  whether to reuse, and a Server Action rewrites that object (`preserveCustomHistoryState`
  goes `false` on every one). So a sheet opened right after a save pushes a fresh entry
  rather than reusing. This is a real gap against "must be excluded from history" as
  asked, chosen deliberately over the two alternatives that closed it fully: popping
  (corrupts a save) or popping-plus-refresh (flaky). Flagged here rather than re-litigated
  a third time — if a future session wants to close this gap for good, it needs a signal
  from the *caller* of whether a mutation actually happened (Modal alone cannot tell a
  successful save from a Cancel; `FormDialog`'s `onDone` and `onCancel` are today the
  identical `() => setOpen(false)`), not another attempt at winning the App Router's own
  action-queue race.

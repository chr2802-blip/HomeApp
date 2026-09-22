# The patterns every screen is built from

Three dots, sheets, folds, movement, and how a form submits. Moved out of
CLAUDE.md, which keeps the rules; this is why each one is the rule.

## Editing and deleting live behind the three dots

Every stored thing — a list, a recipe, a task, a home, a member, a category — carries its
edit and delete in a `ContextMenu` (`src/components/context-menu.tsx`), opened by a button
of three dots. `ItemMenu` (`src/components/item-menu.tsx`) is the usual way in: give it the
id field both actions read, the record's name and the edit form's fields, and it owns both
sheets. **Never put a bare Delete button on a card.** A destructive button beside a link is
a destructive button that gets hit with a thumb.

The panel is drawn through a portal and positioned from the trigger's box on screen: the
cards it belongs to clip their own contents, so a panel rendered inside one is cut off. It
follows the page when that scrolls rather than closing — a scroll begun before the press is
delivered *after* it, and closing would shut the menu the press had just opened.

## A sheet closes on back, and never pops itself

A phone's swipe-from-the-edge and a browser's back button are both "go back", and over
a sheet that has to mean "close the sheet" — not "leave the page behind it", which is
what the router would otherwise do with either gesture. `Modal` pushes one history entry
when it opens (`{ homehubModal: true }`, no url — the address never changes) and closes
itself on the `popstate` a real back press fires.

**It never pops that entry itself on a non-back close** — Cancel, the × button, Escape,
a successful save. Two other things were tried first, and both are worth knowing were
tried, because the obvious next idea after either failure is the other one.

**The second version popped on every non-back close**, on the theory that leaving the
entry in place cost a later back press "an entry that closes nothing and shows no new
page" — true, but only when nothing changed while the sheet was open. The App Router
keeps a client-side cache of each route's rendered tree, keyed to the history entry
current when it was fetched. A background save — exactly what closes a sheet on success —
updates the *entry the sheet pushed*, because that is the current one while the sheet is
open, and leaves the entry **below** it exactly as it was the moment the sheet opened.
Popping back to that entry with `history.back()` restores that frozen snapshot outright,
which silently undid the very save that had just been made: deleting a list's last item
left the item on screen, renaming a list left the old name — both fixed by a
`revalidatePath` the traverse never saw, because it never asked the server again. Found
by the full browser suite, not by the two tests written for the feature, because both used
the one dialog in the app that never mutates anything (choosing "start from scratch")
— **`e2e/lists.spec.ts`'s "an item can be removed outright" and "a list can be renamed"
are the regression cover**, not a test living beside this file.

**The third version kept the pop but chased it with `router.refresh()`** the moment it
landed, on the theory that asking the server again would replace whatever frozen tree
the restore had just painted. It does, most of the time — `--repeat-each=8` on "an item
can be removed outright" failed once. `history.back()` and `router.refresh()` both go
through the App Router's own action queue, and nothing here controls which of "restore
the frozen tree" and "fetch the current one" the queue finishes last; usually the fetch
loses the race because a network round trip is slower than reading a snapshot already in
memory, and *usually* is exactly the shape of bug this codebase refuses to ship — see
*Tests gate everything*, "a flaky test is worse than no test: fix the race, do not add a
timeout." There was no race left to fix: the ordering is the App Router's, not this
component's, to control.

**So it never pops.** The cost is a page that opened and cancelled a sheet needing one
extra back press to be left entirely. What *is* cheap, and worth doing, is not paying
that cost twice on the same page: opening a second sheet — a confirm inside a menu, a
rename tried again after cancelling the first attempt — checks `window.history.state`
first, and only pushes when the entry on top isn't already a `homehubModal` marker. One
sheet closed and another opened right after reuses it, because the marker only stands
for "back should close whatever sheet is open here" and one already on top answers that
exactly as well as a fresh one would. This is read from `history.state` rather than kept
in a variable of the component's own, because a save made inside a sheet rewrites that
object — `server-action-reducer.js` in the App Router sets `preserveCustomHistoryState`
to `false` on every one, which is the same "current entry" the marker occupies while the
sheet is open — so the mark does not reliably survive a mutation and the next sheet opened
right after one pushes a new entry after all. That's fine: reusing is a saving taken
where it costs nothing, never the thing standing between a save and being lost, so
losing it after a save is exactly the case where losing it is safe to lose.

## A sheet's actions stay on screen

`Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
Every dialog puts its buttons — and the reason a submission was refused — in the footer,
so they are in view from the moment it opens. **Never put a form's buttons inside
`ModalBody`.** On a phone the sheet is the whole screen and the longer forms run well past
it; a Save button below the fold is a form people abandon believing it did not work.

## What is finished folds away

`Collapsible` (`src/components/collapsible.tsx`) is the heading that hides what is
behind it: a list's ticked-off items, the tasks a household has already done. Both are
worth keeping — one is next week's vocabulary, the other is the record that the job was
done — and neither is worth the screen it takes above what is still outstanding. It
always says how much is in there, because a heading hiding an unknown quantity is one
nobody opens, and it starts shut on every visit rather than remembering: what is
outstanding is what the page is for.

Pass `headingClassName` where what folds is a section of the page rather than part of a
card, and the trigger is wrapped in an `<h2>` — the page's outline must not depend on
whether the section happens to be open.

For the same reason a list card counts **open items, not all of them**. A shopping list
keeps everything ticked off, so a total climbs for ever and says the same thing about a
finished list as about one nobody has started.

## Movement says where you are going

`PageTransition` picks the animation from the two paths rather than from the link that was
pressed, so it is the same whether a recipe was reached by tapping its card, from a
bookmark or with the back arrow: going a segment deeper slides in from the right, coming
back out slides in from the left, and a move between tabs — sideways to both — rises
instead. Sheets come up from the bottom edge on a phone and scale in on a desktop.

Only the arriving page is animated; the one being left is gone the moment the router swaps
it. Everything here is CSS, and everything is switched off under `prefers-reduced-motion`
by the one rule at the end of `globals.css`.

Movement that arrives with the element — a page, a sheet, a row, a menu — is a **keyframe
animation**, not a transition between two sets of classes, because a transition only runs
from a state the browser has already painted and there is no paint between a sheet being
mounted and being opened. Which one a sheet plays is a media query in `globals.css`, not
`sm:` classes on the element. `e2e/animation.spec.ts` records what actually ran: a CSS
animation that quietly does nothing looks exactly like one that works.

## Forms submit through `useFormAction`, not the `action` prop

`src/components/use-form-action.ts`. React 19 clears an uncontrolled form once its action
resolves, which on a *rejected* submission throws away everything the person typed. The
hook uses `onSubmit` so values survive an error; only a successful add to a list resets.

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
itself on a `popstate` instead.

**The first version popped that entry with a plain `history.back()`**, in the cleanup that
runs when the sheet closes some other way — Cancel, the × button, Escape, a successful
save. The App Router answers every `popstate` by restoring the tree it filed under the
entry landed on, and the entry **below** a sheet was filed the moment the sheet opened. A
background save — exactly what closes a sheet on success — happened after that, so the
restore silently undid it: deleting a list's last item left the item on screen, renaming a
list left the old name. Found by the full browser suite, not by the two tests written for
the feature, because both used the one dialog in the app that never mutates anything —
**`e2e/lists.spec.ts`'s "an item can be removed outright" and "a list can be renamed"
are the regression cover.**

**The second version never popped it**, and paid for that in a bug people reported: after
any sheet had been opened and closed, back landed on the same page and looked like a
button that did nothing — once per sheet opened.

**So the entry is popped, and the router is not told.** `popOwnEntry` in `modal.tsx` notes
the tree the router has *now* (the entry's `__PRIVATE_NEXTJS_INTERNALS_TREE`, which a save
has already updated), then calls `history.back()`. A `popstate` listener registered when
the module loads — capturing, so ahead of the router's own, which is only added once the
router mounts — swallows that one traverse with `stopImmediatePropagation` and writes the
noted tree onto the entry landed on, so a later back or forward onto it restores the page
as it is. Nothing is restored in between, because nothing needs to be: the address never
changed and the router's in-memory state is already current.

Two guards. A save that navigated (an action ending in `redirect`) has left the sheet's
entry behind on another page, so the pop happens only if the address is still the one the
sheet opened on. And the pop is deferred a tick and cancelled by a reopen, because React's
development double-run closes and reopens every sheet at once. `e2e/dialogs.spec.ts` holds
both halves: back after a Cancel leaves the page, and back after a save leaves it with the
save standing when it is returned to.

## A sheet's actions stay on screen

`Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
Every dialog puts its buttons — and the reason a submission was refused — in the footer,
so they are in view from the moment it opens. **Never put a form's buttons inside
`ModalBody`.** On a phone the sheet is the whole screen and the longer forms run well past
it; a Save button below the fold is a form people abandon believing it did not work.

## Small sheets are drawers

A sheet holding one control — the portions stepper, the hearts, a choice of list, an "are
you sure" — used to take the whole phone screen like the recipe form does, which read as
far too much ceremony for one press, and hid the recipe the control was being changed for.
So `Modal` takes `size="drawer"`: anchored to the bottom edge, rounded along its top, only
as tall as its contents (capped at 85dvh), with the page dimmed but visible above it. The
same `sheet-in` keyframes carry it, since they move a sheet by its own height.

What stays full screen is everything with fields to fill in. The deciding question is
whether the contents can run past the fold: a drawer that grows to the full height is a
full-screen sheet with a strip of page at the top, and the rule above about a form's
buttons would then be the only thing keeping Save in view. Swipe-down-to-dismiss was not
added: the backdrop, the ×, Escape and back already close it, and a drag gesture would
have to be told apart from scrolling a drawer's own body.

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

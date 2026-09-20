# Why the rules are the rules

`CLAUDE.md` is what a change has to obey. This directory is the reasoning behind it: what
was tried first, what broke, and why the rule ended up in the shape it is.

The split exists because `CLAUDE.md` had grown to 79 KB — roughly twenty thousand tokens
that every session had to read before doing anything, most of it settled history nobody
needed for the change in front of them. **Nothing was deleted in the move.** Every
imperative in the old file is still in `CLAUDE.md`; the paragraphs explaining each one are
here, one document per area, linked from the rule they explain.

**You do not need to read these to work in this codebase.** Follow a link when a rule looks
arbitrary, when you are about to change the thing it governs, or when you are tempted to do
the obvious thing a rule forbids — that last case is what almost all of this was written
for.

| | what it covers |
| --- | --- |
| [`theme-and-frame.md`](theme-and-frame.md) | A home's colour, and the band the phone paints at the top and bottom of the screen |
| [`lists.md`](lists.md) | Ticking something off, the progress bar, the celebration, and the note saying which recipe put an item there |
| [`week-and-dashboard.md`](week-and-dashboard.md) | `ClearedWeek`, the streak, `weekWorkload`, and why the dashboard's blocks are in that order |
| [`meals.md`](meals.md) | `MealPlan`, leftovers, the picker, the suggestion ranking, and tonight's dinner |
| [`recipes.md`](recipes.md) | Categories, the new-recipe dialog, and importing a recipe from a link |
| [`offline.md`](offline.md) | The queue, the service worker, and what a list does in a shop |
| [`storage.md`](storage.md) | How a household's bytes are measured, and why in raw SQL |
| [`ui-patterns.md`](ui-patterns.md) | Three dots, sheets, folds, movement, and how a form submits |
| [`testing.md`](testing.md) | The parallel database machinery, and the races that only showed once files ran at once |

## Keeping this true

When a rule changes, change it in `CLAUDE.md` **and** in the document that explains it. A
rule whose explanation still describes the previous rule is worse than no explanation: it
reads as authoritative and sends the next session the wrong way.

When a new invariant is established, the rule belongs in `CLAUDE.md`. The story of how it
was arrived at belongs here, and only if it is a story — a rule whose reason fits in its
own sentence does not need a page.

# "Add to list"'s outcome moved into a snackbar

- **Date** — 2026-09-23
- **Branch** — `claude/messages-snack-bar-t1bhvu`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Reported from a screenshot: on a recipe page, "Added to Indkøbsliste. Stødt spidskommen,
Stødt koriander, Hvidløg og 5 mere står allerede i spisekammeret" (`AddToListMenu`'s own
outcome text) was wrapping in among the ingredients it was reporting on, because it was
drawn as a `<p>` right under the "Add to list" button, inside the same card. Asked for a
snackbar instead — a transient message at the bottom of the screen rather than a line
competing with the card's own content for space.

## The route

No snackbar existed anywhere in the app, so the first question was where a new piece of
shared UI belongs. `ContextMenu`'s panel gave the answer: portal to `document.body`
because the card it fires from clips its own contents, follow the pattern of a provider +
hook the way `LanguageProvider`/`useLanguage` already does, and reuse `animate-row-in`
rather than writing a new keyframe — the entrance it wants (fade up, settle) is exactly
the one that already exists. `SnackbarProvider` mounts once in `(app)/layout.tsx`, and
`AddToListMenu` calls `useSnackbar()` instead of holding a `result` state it rendered
inline. The pending "Adding…" live region stayed where it was — it isn't the thing that
was overflowing — only the finished outcome moved.

Verified with a temporary Playwright spec (deleted afterwards, never committed) that
seeded a recipe with the same Danish ingredient lines as the screenshot, pressed "Add to
list", and screenshotted the result at both desktop and a 390×844 phone viewport: the
message now sits above the tab bar, clear of the card. The existing
`e2e/recipe-ingredients.spec.ts` suite, which already asserts on the same outcome text
(`getByText(\`Added to ${listTitle}.\`)`), passed unchanged — the text moved, not its
wording.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | The screenshot named the exact component once traced from the visible string back through `AddToListMenu`. |
| Reading the codebase | 25% | Confirming no snackbar/toast already existed, and reading `ContextMenu`'s portal pattern and `(app)/layout.tsx`'s provider nesting to match it. |
| Building | 25% | `SnackbarProvider`/`useSnackbar`, wiring it into the layout, and cutting `AddToListMenu` over to it. |
| Tests | 30% | `npm run setup` from a cold container, unit suite, a full `npm run build` + the recipe-ingredients e2e spec, and a throwaway visual spec at two viewports to actually see the result. |
| Review, CI, deploy | 10% | Lint/typecheck, this note, commit and push. |

## What should have been quicker

Nothing notable — the pattern to copy (`ContextMenu`'s portal, `LanguageProvider`'s
provider/hook shape) was already exactly right for this, so there was no real search for
an approach, just following what was already there.

## What CLAUDE.md did not say

There was no existing convention for a transient, non-blocking confirmation message —
every prior "what happened" pattern (`ActionForm`, the old inline text this replaces) was
drawn in place, beside the control that caused it, which is right for a form's own
validation but wrong for a menu that lives inside a card with no room to spare. Not yet
written into CLAUDE.md as a rule of its own, since this is the only caller so far; worth a
line under "Sheets, folds, movement, and how a form submits" if a second confirmation ever
wants the same treatment, naming the snackbar as where a transient outcome goes and the
inline note as where a validation error stays.

## Decided rather than known

- **Only `AddToListMenu`'s outcome moved.** `ActionForm`'s inline success/error text and
  `pantry-row.tsx`'s rename error were left alone — both are explicitly "the wording sits
  beside the field" cases (a settings form, a row being renamed), not a card being
  crowded, and CLAUDE.md's own words for the former ("Validation ... so the wording a
  person sees sits beside the field") argue against moving it.
- **One snack at a time, 4 seconds, no exit animation.** A second press while one is
  showing replaces it rather than queuing; nothing asked for a queue and the button that
  causes this is pressed at most a few times a minute.
- **The pending "Adding…" text stayed inline** rather than also moving to the snackbar —
  it never wrapped into the card (it's a few words, not a sentence with a list of
  ingredient names in it), and a live region announcing "under way" reads better staying
  next to the control than jumping to the bottom of the screen mid-press.

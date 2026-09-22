# A home has a language (PR 2: the lists and tasks areas)

- **Date** — 2026-09-22
- **Branch** — `claude/home-language-recipe-translation-d00qa8`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

PR 1 landed the machinery — the column, the picker, dates, the importer. PR 2 is the
remaining ~500 English strings, converted area by area: shared dialog primitives first,
then lists, then tasks. Mechanical work, following the pattern PR 1's plan already
settled.

## The route

Shared primitives (`ItemMenu`, `ConfirmButton`/`ConfirmDialog`, `Modal`, `ContextMenu`)
first, since every area's cards route through them. Then the lists area — a new
`src/lib/copy/lists.ts`, `statusLine` gaining a required `language` parameter, a dozen
components and both list pages — committed once lint, typecheck and the full test suite
were green. Then tasks: `src/lib/copy/tasks.ts`, `repeatLabel` and the validation schemas
in `actions/tasks.ts` becoming functions of `say`, and the task card/fields/menus.

The tasks-area commit's own verification was clean (typecheck, lint, 1793 unit +
integration tests). The push's pre-push hook then ran the full `npm run verify` from a
production build rather than the dev server, and two e2e specs on `/lists` failed with
"Attempted to call useLanguage() from the server" — a real bug, in the lists-area commit
from earlier in this same session, not the tasks-area one just being pushed. `AmountsField`
carried no `"use client"` directive and called `useLanguage()` unconditionally, but it is
rendered two different ways: as a child passed down from a server page (`lists/page.tsx`,
`lists/[id]/page.tsx`) and from inside the already-client `list-directory.tsx`. The first
shape runs the component on the server, where `useContext` has nothing to resolve — and
that shape is exactly the one none of the unit or integration tests exercise, since those
never render a full page tree. Only the production e2e build, which actually serves
`/lists` end to end, hit it. Fixed by giving `AmountsField` the same `language`-as-prop
treatment `AssigneeField` already had (caught during the tasks-area work, for the same
reason), and by giving `queue-status.tsx` its own `"use client"` rather than leaning on
the fact its one caller happens to have one.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | none | Continuing PR 1's own plan; no new decisions to make. |
| Reading the codebase | small | Reading each area's existing components before touching them, to know which shared components (`ItemMenu`, `RepeatField`) needed converting once rather than per-caller. |
| Building | large | Two areas' worth of catalogue files, component conversions, and the two schema-to-function-of-`say` rewrites in the action files. |
| Tests | medium | Mechanical signature updates (`statusLine`, `repeatLabel` gaining `language`) cascading into their call sites and test files. |
| Review, CI, deploy | medium | The e2e-only server/client boundary bug — see above — cost a full rebuild-and-rerun cycle that a faster local check could have caught. |

## What should have been quicker

**The `useLanguage()`-from-a-server-component bug should have been caught before the
push, not by it.** `npx tsc --noEmit` and eslint both passed clean on the broken
`AmountsField` — nothing in the type system says "this component is sometimes rendered
by a server component," so the mistake is invisible until something actually renders that
shape. The unit and integration suites don't either, since neither renders a full page
through Next's RSC boundary. The one thing that did catch it was the pre-push hook's own
`npm run e2e`, against a production build — which is also the slowest possible place to
find out, since the hook had already sat through the full lint/type/unit/integration run
and the production build before reaching it. Running `npm run e2e` (or at least a spot
check of `/lists` and `/tasks` against `npm run build && npm start`) *before* pushing,
for any commit that adds a new `useLanguage()` call, would have caught this in the minute
it took to write the component rather than the ten it took to push, fail, and re-push.

## What CLAUDE.md did not say

**The dual-use rule ("a `src/lib` module takes the language as an argument, never reaches
for the catalogue") was written for `src/lib`, but the same trap catches a plain component
with no `"use client"` of its own** — and it is easier to hit there, because such a
component looks identical whether its caller is a server page passing it down as a child
or a client component rendering it directly, and only one of those shapes breaks.
`AssigneeField` was written correctly the first time (language as a prop); `AmountsField`
was not, and only the production e2e build told us. Written into CLAUDE.md in this commit,
directly after the `src/lib` rule it extends, naming both components as the example.

## Decided rather than known

- **`queue-status.tsx` did not strictly need its own `"use client"`** — its one caller
  already has one, so it would always run in a client context regardless. Added anyway,
  on the principle that a component's own correctness should not depend on staying an
  only-caller's-context away from breaking, matching every other client-hook component in
  the app (`ContextMenu`, `Modal`, `FavoriteButton`) already declaring its own boundary.

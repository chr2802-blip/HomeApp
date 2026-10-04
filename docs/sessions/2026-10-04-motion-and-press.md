# Aligning motion and press feedback across the app

- **Date** — 2026-10-04
- **Branch** — `ccr-6646e04d-8tniju`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Align the transitions and animation across the app, and the press feedback." An audit
first, then the user said to build all of it: tokens, three press tiers, navigation that
answers before the page lands, and exits for the menu and the snackbar.

## The route

Audit (read `globals.css`, `PageTransition`, `Modal`, `ContextMenu`, `Snackbar`, the navs
and every `active:scale-*`) → a script rewrote ~45 class strings into `press-icon` /
`press-button` / `press-card` by their old scale → tokens in `globals.css` → `LinkCue`,
`usePendingHref`, the sliding section pill and `sectionStep` → menu and snack exits →
screenshots on a throttled connection → unit test, e2e tests → docs.

Loops: the unit test first imported the exit timers from the components and vitest refused
the `.tsx` at import analysis, so the three timers moved into `src/lib/motion.ts`. The
first screenshot run looked for a section tab called "Meals"; it is "Plan".

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "transactions" meant transitions |
| Reading the codebase | medium | the motion was spread over one 1000-line stylesheet and ~40 components |
| Building | most | the mechanical rewrite was one script; the judgement was which tier each control is |
| Tests | medium | delaying a page's `_rsc` requests with `page.route` is what makes a pending state testable |
| Review, CI, deploy | — | |

## What should have been quicker

Seeing a pending state at all. A dev server on localhost answers too fast for `LinkCue`
or the tab light to show, so both needed CDP's `Network.emulateNetworkConditions` for the
screenshot and a `page.route` that holds `?_rsc` requests for the test. Neither was written
down; the e2e helper (`holdPage` in `e2e/animation.spec.ts`) is now the pattern.

## What CLAUDE.md did not say

- A unit test cannot import a `.tsx` (no JSX transform in vitest). Now in *Tests gate
  everything*.
- How motion is meant to be written (tokens, tiers, cues, exits). Now under *Sheets, folds,
  movement*.

## Decided rather than known

- The tier boundaries (90 / 96 / 98%) and the spring on release; the 120ms beat before a
  `LinkCue` shows; half opacity as the page's starting point.
- `press-card`'s tint is `slate-100`, overridden by any `bg-*` utility on the element (the
  tiers are in `@layer components` on purpose).
- No `loading.tsx` skeletons: `LinkCue` answers the same question for every route.
- The sheet's exit now eases on `--ease-leave` rather than the sheet curve.

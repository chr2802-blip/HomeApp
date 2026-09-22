# A home has a language (PR 2, part 3: meals, dashboard, settings/admin/auth/homes/profile)

- **Date** — 2026-09-22
- **Branch** — `claude/home-language-recipe-translation-d00qa8`
- **PR** — #107 (continuing, not a new PR)
- **Reached production** — not yet

## The idea

Continue PR 2's area-by-area conversion from where the previous two sessions (lists/tasks,
then recipes) left off. Mid-session the user asked "Could we do them all together?" — read as
an instruction to stop opening a new PR per area and instead keep pushing every remaining
area onto the branch already open as PR #107, one commit per area as before. This session
converted the rest of the app in one sitting: meals, the dashboard, settings, both admin
pages, `/homes`, `/login` and `/accept-invite`, and `/profile` — six new catalogue files and
roughly 230 strings, which is everything the plan's ordering had left.

## The route

Same mechanism as the previous two sessions, run six times in a row: read the area, write its
catalogue file, convert its pages and components, fix what typecheck and lint turn up, widen
the ESLint guard's `files` glob, run the area's own tests, then move to the next area — with
the full suites (typecheck, lint, unit+integration, e2e) run once at the end of the batch
rather than after each area, since nothing here crossed an area boundary until the very end.

Two areas needed a genuine design decision the plan had left open:

1. **Which language `/login` and `/accept-invite` speak, with no session to ask.** Both
   routes are reached before there is a user at all. `currentLanguage()` (already built in
   PR 1, reading the current cookie's session if any and falling back to `DEFAULT_LANGUAGE`)
   turned out to be exactly the right tool without needing anything new: a fresh visitor gets
   English, and only a browser that already has a session (rare on these two routes, but
   possible — someone re-opening `/accept-invite` from an email link while still logged in
   elsewhere) sees their own home's language. The more elaborate idea floated in the original
   plan — reading the *inviting* home's language for `/accept-invite` — was deliberately not
   built: it would need the invite looked up before the form even renders, for a screen a
   given household's members see once, ever.
2. **Which language a person's own actions speak when they have no active home**
   (`createHome`, `updateOwnProfile`).  `user.homeLanguage` already defaults to `EN` when
   there is no active home (built in PR 1's `SessionUser`), so these needed no special case —
   just the same `sayIn(user.homeLanguage)` every other page already uses.

Two real defects surfaced, both caught by typecheck or lint before any push:

1. **A `Plural` filled with the wrong key.** `AUTH.tooManyAttempts` takes `{minutes}` in its
   text but, like every `Plural`, is selected by `{count}` — which nothing about the phrase's
   own text says, since `count` need not appear in the string it chooses between. Passing only
   `{ minutes }` compiled fine everywhere else in this app's `Plural` usages because most of
   them reuse the same value for both, and only failed here because `auth.ts`'s two call sites
   were the first to pass a number that means "which form" and a number that means "put this
   word in the sentence" and have them coincidentally be the same value without also being
   the same *name*. Fixed by passing both keys explicitly: `{ count: n, minutes: n }`.
2. **`src/lib/storage.ts`'s original `STORAGE_LABELS` was left behind as dead code** once
   `storage-usage.tsx` moved to the bilingual `STORAGE_KIND_LABELS` in `copy/settings.ts` two
   sessions ago — still exported, still imported by its own unit test, never read by any
   component. Removed it, and rewrote `STORAGE_KIND_LABELS`'s type from a loose
   `Record<string, Phrase>` to `Record<StorageKind, Phrase>` so it keeps the same
   compile-time guarantee the old one had (a kind added to `STORAGE_KINDS` without a label
   fails to build) rather than silently becoming untyped along with the move.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "Could we do them all together?" changed the shape of the session (fewer PRs, not less work) partway through; confirmed the reading back to the user and continued. |
| Reading the codebase | medium | Six areas read up front each, mainly to place every server/client boundary before converting — `login-form.tsx` and `accept-invite-form.tsx` needed catching this way: both are already `"use client"`, but their routes mount no `LanguageProvider` at all, so `useLanguage()` would have defaulted silently to English forever rather than crashing the way an un-prop'd server-rendered component does. |
| Building | large | Six catalogue files, eighteen components/pages converted, two lib-module signature threadings (`streakLine`, `tonightsDinner`). |
| Tests | medium | Per-area unit test updates (`streak.test.ts`, `meals.test.ts`), one integration call-site sed, the `AUTH.tooManyAttempts` typecheck fix, the `storage.test.ts` rewrite, six new `language.spec.ts` assertions. |
| Review, CI, deploy | small | Full verify run once at the end of the batch; nothing red that hadn't already been caught locally. |

## What should have been quicker

**The `Plural`'s `count` requirement is easy to forget precisely because it usually costs
nothing to forget.** Every other `Plural` call site in this app already happens to pass the
same number for "which form" and "the number in the sentence", so `{ count: n, n }`-shaped
call sites never exercised the case where those diverge. `AUTH.tooManyAttempts` is the first
`Plural` whose slot name (`minutes`) differs from `count`, and that was the only reason the
missing key surfaced at all — a `Plural` with a same-named slot would have compiled with just
`{ minutes: n }` by accident, via structural typing, and the type system would not have
caught a genuinely different bug (passing `count` under the wrong key) either. Nothing to fix
in the type itself — `Fill<P>` already requires exactly the right key set — but it is worth
knowing that "it compiled last time" does not clear this pattern in general.

## What CLAUDE.md did not say

**Nothing new.** The server/client boundary rule, the "sentence is the unit" rule, and the
`currentLanguage()` pattern were all already written down from PR 1 and the previous two PR 2
sessions, and covered every case this session hit, including the two login/accept-invite
components that needed `language` as an explicit prop despite already being `"use client"`.
That paragraph in CLAUDE.md is doing its job — this session is the third in a row to hit a
component in that exact shape and find the rule already answered it.

## Decided rather than known

- **`/login` and `/accept-invite` read `currentLanguage()`, not the inviting home's
  language**, for `/accept-invite` specifically — see "The route" above. A person accepting
  an invite before creating an account has no home yet by definition, so the only language
  available to *read* is whichever session cookie (if any) is already sitting in their
  browser; the inviting home's language was floated in the original plan but never actually
  reachable without an extra lookup for a screen visited once.
- **`bars/page.tsx` stays English, left untouched.** It is a self-described temporary
  measuring page ("Delete this once the question is answered. It is a measuring stick, not a
  feature.") and converting throwaway debug UI would be work spent on something meant to be
  deleted rather than read.

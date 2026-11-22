# Invitation links, as in the Swingkings app

- **Date** — 2026-11-22
- **Branch** — `ccr-c07afd80-jo7z1e`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"The same invite flow as Swingkings": replace the email + one-time code (typed at
`/accept-invite`) with a link an admin makes, that lasts N days for up to M people, and that
anybody who opens `/join/<token>` can use to make an account or join with the one they have.

## The route

Read both repos' invite code side by side → schema (`Invite` dropped, `InviteLink` added)
and migration → lib, actions, `/join/<token>`, Settings → a first screenshot of Settings
and the join page in Danish → integration, unit and browser tests → docs. One browser
test needed a second run: `getByLabel("Invitation link")` also matched the three dots'
"Actions for Invitation link". The first push then failed on a race in the new homes
spec: it read the share field before `ShareLink` had put the origin in front of the path
(`new URL("/join/…")` throws). The specs now wait for the full address.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | Swingkings' version is compact and well commented |
| Reading the codebase | medium | finding every place the old flow was named (tests, e2e, README, lint list, storage SQL) |
| Building | medium | mostly a port; the copy had to become `Phrase`s in two languages |
| Tests | medium | rewrote the old invite tests rather than adapting them |
| Review, CI, deploy | — | |

## What should have been quicker

The `SETTINGS` copy object is typed `Record<string, Phrase | …>` and refuses a `Plural`, so
two counted phrases had to move to a block of their own (`LINK_COUNTS`) after the type
error — a note in `src/lib/copy/say.ts` on where Plurals go would have saved the round.

## What CLAUDE.md did not say

How a person joins a home — now its own section ("Somebody joins a home through a link").

## Decided rather than known

- A link carries no role; everyone joins as USER (as Swingkings does). Before, an invite
  could make somebody an admin directly.
- Open email codes are dropped by the migration rather than carried over.
- Choices offered: 1/7/14/30 days, 1/2/5/10 people (defaults 7 days, 5 people) — smaller
  than Swingkings' team-sized 30/50.
- `/accept-invite` is gone rather than redirected; the login page now says to open the link.
- "Not you? Log out" on the join page logs out to `/login`, so the link has to be opened
  again afterwards.

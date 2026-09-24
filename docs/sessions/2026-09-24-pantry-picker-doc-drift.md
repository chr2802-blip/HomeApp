# Catching CLAUDE.md drift after the pantry unit picker changed

- **Date** — 2026-09-24
- **Branch** — `claude/pantry-quantity-units-3eeaqf`
- **PR** — #128
- **Reached production** — not yet

## The idea

A container restart interrupted the session mid-stream. On resuming, the first move was
to check the repo was still intact — clean tree, branch matched its remote, Postgres
still up — before doing anything else. That check is what surfaced the real finding:
CLAUDE.md's pantry section still described the unit picker as a `<select>`, but the
commit already pushed to this branch had replaced it with `ContextMenu` a few turns
earlier. The commit that changed the picker never touched the doc describing it.

## The route

Straight: verify state after the restart, notice the drift while re-reading the
just-restored CLAUDE.md content, fix the paragraph, push. No loops this time — the loop
belongs to the earlier part of this session (a different note, if one exists for it):
pushing a follow-up commit three separate times to a branch whose PR had already merged
underneath it, each time discovered only by a rejected or corrupted push rather than by
checking first.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5% | The stop hook's own message said exactly what was missing. |
| Reading the codebase | 10% | Re-reading the restored CLAUDE.md text to find the stale paragraph. |
| Building | 0% | No code changed this stretch — the fix was to the doc alone. |
| Tests | 5% | `pre-push` recognised the change as docs-only and skipped the slow suites. |
| Review, CI, deploy | 5% | One push, no round trips. |

## What should have been quicker

Nothing here cost time twice — the restart forced a state check that would otherwise
have been skipped, and that check is what caught the drift before it shipped. The
lesson is the reverse of the usual one: a forced pause to re-verify state is sometimes
what a change-then-immediately-push loop needs anyway, and this session got it for
free from an interruption rather than by discipline.

## What CLAUDE.md did not say

Nothing new. This confirms an existing rule from the inside: CLAUDE.md's own "Every
session leaves a note behind" section says a gap here is what lets drift compound, and
the drift this session found was CLAUDE.md describing its own codebase incorrectly —
proof that a commit changing shipped behavior has to update the paragraph describing
that behavior in the same commit, not as a follow-up remembered later (or, this time,
not remembered at all until a restart forced a re-read).

## Decided rather than known

Nothing decided without a check this time — the fix was mechanical once the mismatch
was seen: describe what the code in this same branch now does.

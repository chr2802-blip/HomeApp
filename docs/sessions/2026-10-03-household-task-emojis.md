# Cleaning, chores and furniture faces for lists and tasks

- **Date** — 2026-10-03
- **Branch** — `claude/household-task-emojis-0fcgep`
- **PR** — not opened
- **Reached production** — not yet

## The idea

More faces for lists and tasks, aimed at running a house: cleaning, chores and
furniture. `EMOJI_CHOICES` went from 64 to 96 — two new themed rows of sixteen
(cleaning & chores; furniture & fixing things) — and the title guesser learned them.

## The route

Read `src/lib/emoji.ts`, `EmojiField` and `faces.test.ts` → two rows appended → 34 new
guesses, put ahead of the old ones → the old `"toilet"` → 🧻 split into toilet roll (🧻)
and toilet (🚽) → tests → `npm run setup`, migrate, throwaway seed, screenshot of the
"New list" sheet at 390×844 → `npm run verify`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 2 min | The 2026-10-01 note on the same file said where everything was |
| Building | 6 min | Most of it checking guess words for substrings of other words |
| Tests | 2 min | |
| Screenshot | 5 min | Seed script failed once on top-level await |

## What should have been quicker

The throwaway seed script: written as `.ts`, `tsx` compiled it as CommonJS and refused
the top-level `await`. Naming it `.mts` fixed it. Added to CLAUDE.md's dev-database
paragraph.

## What CLAUDE.md did not say

That the throwaway seed wants an `.mts` name (or a wrapping async function). Added.

## Decided rather than known

- Which 32 emojis. Cleaning & chores: bucket, bottle, bubbles, gloves, toilet, shower,
  toothbrush, socks, shirt (ironing), needle (mending), frying pan, firewood, autumn
  leaves, snow, ladder (gutters), mailbox. Furniture & fixing: sofa, chair, door,
  mirror, picture, candle, cabinet, TV, computer, plug, battery, thermometer (heating),
  tap (plumbing), screwdriver (assembly), saw, paintbrush.
- Guess words that would sit inside unrelated words were left out: `kalk` (kalkun),
  `tap` (tapet), `skab` (selskab, køleskab), `post` (compost), `tøj` (sengetøj),
  `rive` (drive). `door` still catches "outdoor" — a wrong guess costs a funny tile.
- The picker on a wider screen is now twelve rows of eight. Not changed.

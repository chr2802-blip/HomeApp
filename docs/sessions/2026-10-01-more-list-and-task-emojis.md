# More emojis to pick from for lists and tasks

- **Date** — 2026-10-01
- **Branch** — `ccr-639ce38e-h06mmx`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The face picker offered 32 emojis; the household wanted more choice. `EMOJI_CHOICES`
went to 64, four new rows of eight, and the title guesser learned a few of the new ones.

## The route

Read `src/lib/emoji.ts` and `EmojiField` → appended four rows → added guesses for the
new faces → caught that the doctor's "lægen" sits inside "tandlægen" and moved it below
the dentist → tests → screenshot of the "New list" sheet at 390×844.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 2 min | One file and its picker |
| Building | 5 min | |
| Tests | 2 min | |
| Screenshot | 10 min | `npm run setup` in the background, then a dev DB with no tables |

## What should have been quicker

The screenshot. `npm run setup` reported ready, but the dev database it points at had no
tables, so the throwaway seed failed and needed `prisma migrate deploy` first.

## What CLAUDE.md did not say

That the dev database is left unmigrated by `npm run setup`. Added to the "A dev database
for screenshots has nobody in it" paragraph.

## Decided rather than known

- Which 32 emojis. Food and drink (meat, fish, eggs, milk, pasta, pizza, cookies, beer),
  home (soap, toilet roll, house plant, bath, wrench, window, key, fire extinguisher),
  leisure (running, football, games, art, music, toys, paws, aquarium) and admin/travel
  (calendar, note, letter, phone, hospital, plane, tent, pumpkin).
- The new guesses. They come before the old ones in `GUESSES`, except the doctor, which
  has to be checked after the dentist.

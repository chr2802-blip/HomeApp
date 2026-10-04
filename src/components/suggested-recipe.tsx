import type { HomeLanguage } from "@prisma/client";
import Link from "next/link";
import { findNewSuggestedRecipe } from "@/app/actions/recipe-suggestion";
import type { TonightsDinner } from "@/lib/recipe-suggestion";
import { PhotoThumb } from "@/components/photo";
import { SubmitButton } from "@/components/submit-button";
import { sayIn } from "@/lib/copy/say";
import { DASHBOARD } from "@/lib/copy/dashboard";
import { LinkCue } from "@/components/link-cue";

/**
 * Tonight's dinner, read from the day's own entry on `/meals` rather than a pick kept
 * apart from it — the two pages agree because they are reading the same row.
 *
 * Absent entirely when there is nothing to show — a night out already decided, or
 * nothing planned and nothing eligible to plan either — which is why the page asks
 * `tonightsDinner` itself and hands the answer in: it has to know whether the "Today"
 * card has anything in it before it draws one.
 *
 * **A row rather than a picture with a card under it.** It used to open with the
 * recipe's photograph across the full width, which at a phone's 16:9 came to about two
 * hundred pixels, and with the title, the description and a full-width "Find new" below
 * it the suggestion took half the first screen — on a page whose job is to say what
 * needs attention. The dinner is one line of that answer, not the answer.
 *
 * So it is one row of the dashboard's "Today" card, beside what is due: a thumbnail, the
 * title under a small label, and the button beside them rather than under. The
 * appetising photograph is still one tap away, on the recipe's own page, where somebody
 * who has decided to cook it is going anyway. The description is not drawn: imported ones run to a paragraph, and the row
 * must be the same height as the tasks beside it.
 *
 * **"Find new" is only offered where it would not be arguing with the household.** A
 * recipe already planned — whether auto-picked by `tonightsDinner` or chosen by hand on
 * `/meals` — is a suggestion, and the button replaces it. Leftovers are a decision
 * already made, so the row says what they are the leftovers of and stops there.
 */
export function DinnerRow({
  dinner,
  language,
}: {
  dinner: NonNullable<TonightsDinner>;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  const face = (
    <>
      {/* Decorative: the title is right beside it. */}
      {/* eslint-disable-next-line no-restricted-syntax -- `placeholder` picks a PhotoKind glyph, not copy. */}
      <PhotoThumb photoId={dinner.photoId} alt="" className="h-10 w-10" placeholder="recipe" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase">
          {say(DASHBOARD.tonightsDinner)}
        </h3>
        <p className="truncate font-medium">{dinner.title}</p>
      </div>
    </>
  );

  return (
    <section className="flex items-center gap-2 px-3 py-2">
      {dinner.recipeId ? (
        <Link
          href={`/recipes/${dinner.recipeId}`}
          className="press-card relative -m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5"
        >
          {face}
          <LinkCue />
        </Link>
      ) : (
        // Leftovers whose pointer no longer reaches a recipe: still worth saying,
        // nothing left to link to.
        <div className="flex min-w-0 flex-1 items-center gap-3">{face}</div>
      )}
      {dinner.suggestable && (
        // Outside the link, as the star and the three dots are on a list card: a
        // button inside a link is neither valid nor pressable without following it.
        <form action={findNewSuggestedRecipe} className="shrink-0">
          <SubmitButton variant="ghost" pendingLabel={say(DASHBOARD.finding)} className="text-xs">
            {say(DASHBOARD.findNew)}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

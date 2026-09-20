import Link from "next/link";
import { findNewSuggestedRecipe } from "@/app/actions/recipe-suggestion";
import { tonightsDinner } from "@/lib/recipe-suggestion";
import { Card } from "@/components/ui";
import { PhotoThumb } from "@/components/photo";
import { SubmitButton } from "@/components/submit-button";

/**
 * Tonight's dinner, read from the day's own entry on `/meals` rather than a pick kept
 * apart from it — the two pages agree because they are reading the same row.
 *
 * Absent entirely rather than an empty card when there is nothing to show — a night out
 * already decided, or nothing planned and nothing eligible to plan either — the same
 * reasoning the rest of the dashboard uses for a heading with nothing behind it.
 *
 * **A row rather than a picture with a card under it.** It used to open with the
 * recipe's photograph across the full width, which at a phone's 16:9 came to about two
 * hundred pixels, and with the title, the description and a full-width "Find new" below
 * it the suggestion took half the first screen — on a page whose job is to say what
 * needs attention. The dinner is one line of that answer, not the answer.
 *
 * So it is built like a list card: a thumbnail, the title, one line of description, and
 * the button beside them rather than under. The appetising photograph is still one tap
 * away, on the recipe's own page, where somebody who has decided to cook it is going
 * anyway. `line-clamp-1` on the description because these come from imported pages and
 * run to a paragraph — the row must be the same height whatever arrived.
 *
 * **"Find new" is only offered where it would not be arguing with the household.** A
 * recipe already planned — whether auto-picked by this component or chosen by hand on
 * `/meals` — is a suggestion, and the button replaces it. Leftovers are a decision
 * already made, so the row says what they are the leftovers of and stops there.
 */
export async function SuggestedRecipe({ homeId }: { homeId: string }) {
  const dinner = await tonightsDinner(homeId);
  if (!dinner) return null;

  const face = (
    <>
      {/* Decorative: the title is right beside it. */}
      <PhotoThumb photoId={dinner.photoId} alt="" className="h-12 w-12" placeholder />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{dinner.title}</p>
        {dinner.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{dinner.description}</p>
        )}
      </div>
    </>
  );

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-slate-500 uppercase">Tonight&apos;s dinner</h2>
      {/* `padded={false}` and the padding here: both are padding utilities, and which
          one wins is decided by their order in the stylesheet rather than in the class
          attribute — see `Card`. */}
      <Card padded={false} className="flex items-center gap-2 p-3">
        {dinner.recipeId ? (
          <Link
            href={`/recipes/${dinner.recipeId}`}
            className="pressable -m-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 active:scale-[0.98] active:bg-slate-50"
          >
            {face}
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
            <SubmitButton variant="ghost" pendingLabel="Finding…" className="text-xs">
              Find new
            </SubmitButton>
          </form>
        )}
      </Card>
    </section>
  );
}

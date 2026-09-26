"use client";

import { useOptimistic, useTransition } from "react";
import { rateRecipe } from "@/app/actions/recipes";
import { useLanguage } from "@/components/language-provider";
import { ModalBody } from "@/components/modal";
import { SheetButton } from "@/components/sheet-button";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { formatAverage, MAX_HEARTS } from "@/lib/rating";

const HEARTS = Array.from({ length: MAX_HEARTS }, (_, index) => index + 1);

/** One heart, filled or drawn in outline. Coloured by whatever `text-*` its parent sets. */
export function HeartIcon({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M10 16.5s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 10 5.6a3.4 3.4 0 0 1 6.5 2.3c0 4.7-6.5 8.6-6.5 8.6z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Standing = { average: number | null; count: number; last: number | null };

/**
 * The recipe page's hearts: the household's average, and five buttons to add a rating.
 *
 * Every press is a new rating rather than a change to the last one — the same person
 * rates a dish again each time they cook it, and the average is meant to move with them.
 * So the hearts are not a setting that stays pressed: what they show filled is the
 * person's own most recent rating, which is the one thing about the average they can
 * recognise as theirs.
 *
 * The average moves the moment a heart is pressed rather than when the server answers,
 * and the buttons are held while that press is on its way: every press counts, so a
 * double tap would otherwise be two ratings where somebody meant one.
 */
export function RecipeRating({
  recipeId,
  average,
  count,
  lastHearts,
}: {
  recipeId: string;
  average: number | null;
  count: number;
  /** What this person gave it the last time they rated it, if they ever have. */
  lastHearts: number | null;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const [standing, addRating] = useOptimistic<Standing, number>(
    { average, count, last: lastHearts },
    (current, hearts) => ({
      average: ((current.average ?? 0) * current.count + hearts) / (current.count + 1),
      count: current.count + 1,
      last: hearts,
    }),
  );
  const [pending, startTransition] = useTransition();

  function rate(hearts: number) {
    const data = new FormData();
    data.set("recipeId", recipeId);
    data.set("hearts", String(hearts));

    startTransition(async () => {
      addRating(hearts);
      await rateRecipe(data);
    });
  }

  return (
    <div data-rating-count={standing.count}>
      <div className="flex items-baseline gap-2">
        {standing.average === null ? (
          <p className="text-sm text-slate-500">{say(RECIPES.notRatedYet)}</p>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums" data-testid="rating-average">
              {formatAverage(standing.average, language)}
            </p>
            <p className="text-sm text-slate-500">
              {say(RECIPES.ratingCount, { count: standing.count })}
            </p>
          </>
        )}
      </div>

      <div
        role="group"
        aria-label={say(RECIPES.ratingHeading)}
        className="mt-2 flex gap-1 text-[var(--accent)]"
      >
        {HEARTS.map((hearts) => (
          <button
            key={hearts}
            type="button"
            onClick={() => rate(hearts)}
            disabled={pending}
            aria-label={say(RECIPES.rateHearts, { count: hearts })}
            className="pressable rounded-lg p-1.5 active:scale-90 disabled:opacity-60"
          >
            <HeartIcon filled={standing.last !== null && hearts <= standing.last} className="h-7 w-7" />
          </button>
        ))}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {standing.last !== null
          ? say(RECIPES.yourLastRating, { count: standing.last })
          : say(RECIPES.rateHint)}
      </p>
    </div>
  );
}

/**
 * The rating as an icon beside the ingredients' heading — a heart, filled once the
 * household has rated it, with the average beside it — and the hearts to press in a
 * sheet behind it. Rating is done after cooking, not every time the page is read, so it
 * no longer takes a card of its own.
 */
export function RecipeRatingButton(props: {
  recipeId: string;
  average: number | null;
  count: number;
  lastHearts: number | null;
}) {
  const language = useLanguage();
  const say = sayIn(language);

  return (
    <SheetButton
      label={say(RECIPES.ratingHeading)}
      value={props.average === null ? undefined : formatAverage(props.average, language)}
      icon={
        <span className="text-[var(--accent)]">
          <HeartIcon filled={props.average !== null} className="h-[18px] w-[18px]" />
        </span>
      }
    >
      {() => (
        <ModalBody>
          <RecipeRating {...props} />
        </ModalBody>
      )}
    </SheetButton>
  );
}

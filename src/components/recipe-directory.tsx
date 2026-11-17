"use client";

import type { HomeLanguage } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { Card, EmptyState, Input } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { AddToMealPlanMenuItem } from "@/components/add-to-meal-plan-menu-item";
import { recipeSaveOverlay, RecipeFields } from "@/components/recipe-fields";
import { PhotoCover } from "@/components/photo";
import { QUICK_RECIPE_MINUTES, STAY_FIELD, timeLabel } from "@/lib/recipes";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { formatAverage } from "@/lib/rating";
import { HeartIcon } from "@/components/recipe-rating";
import { LinkCue } from "@/components/link-cue";
import { RecipeSelectionBar } from "@/components/recipe-selection-bar";
import { MenuItem } from "@/components/context-menu";
import type { ListChoice } from "@/components/add-to-list-menu";
import { useLongPress } from "@/components/use-long-press";
import { tick } from "@/lib/haptics";

export type RecipeSummary = {
  id: string;
  title: string;
  /** Every heading it is filed under. A recipe under two appears under both. */
  categoryIds: string[];
  /** The recipe's picture, if it has one. Only the id: the card fetches the thumbnail. */
  photoId: string | null;
  description: string | null;
  /** Searched on, and handed to the edit sheet the card's own menu opens. */
  ingredients: string;
  instructions: string;
  videoUrl: string | null;
  /** Every rating's average and how many there are; null for a recipe nobody has rated. */
  rating: { average: number; count: number } | null;
  totalTimeMinutes: number | null;
  /** `isInFormat` its stored breakdown: whether a save of it unchanged would need the AI. */
  inFormat: boolean;
};

export type RecipeCategorySummary = { id: string; name: string };

const ALL = "all";

type TimeFilter = "all" | "quick" | "slow";

/**
 * Whether a recipe belongs in the "Under 30 min" or "30 min+" bucket. A recipe with no
 * time on it belongs in neither — it is not known to be quick, and it is not known to be
 * slow, and putting it in one bucket or the other would be a guess dressed as a filter.
 */
function matchesTimeFilter(totalTimeMinutes: number | null, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  if (totalTimeMinutes === null) return false;
  return filter === "quick"
    ? totalTimeMinutes <= QUICK_RECIPE_MINUTES
    : totalTimeMinutes > QUICK_RECIPE_MINUTES;
}

/**
 * Every recipe in the home under its category heading, with a filter and a search box.
 *
 * Both narrow the same list on the client rather than on the server: the recipes are
 * already on the page, a household's collection numbers in the dozens rather than the
 * thousands, and a round trip per keystroke would make the box feel worse than
 * scrolling — the same reasoning as the lists directory.
 *
 * Search covers the ingredients as well as the title and description, because the
 * question a cook actually has is more often "what can I do with the feta" than "what
 * was that recipe called".
 */
export function RecipeDirectory({
  recipes,
  categories,
  lists,
}: {
  recipes: RecipeSummary[];
  categories: RecipeCategorySummary[];
  /** The lists that track amounts, for putting chosen recipes on one. */
  lists: ListChoice[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  // Choosing many recipes at once — started by pressing and holding a card (or "Choose
  // several" in its three dots), then a tap adds or removes one. Null is not choosing:
  // the cards are links again, each with its own three dots.
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const language = useLanguage();
  const say = sayIn(language);

  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    const inCategory =
      categoryId === ALL
        ? recipes
        : recipes.filter((recipe) => recipe.categoryIds.includes(categoryId));
    const inTime = inCategory.filter((recipe) =>
      matchesTimeFilter(recipe.totalTimeMinutes, timeFilter),
    );
    if (!needle) return inTime;

    return inTime.filter((recipe) =>
      [recipe.title, recipe.description ?? "", recipe.ingredients]
        .join("\n")
        .toLowerCase()
        .includes(needle),
    );
  }, [recipes, categoryId, timeFilter, needle]);

  // Headings in the categories' own order, and only those with something under them:
  // a page of empty headings tells the reader nothing about what is in the house. A
  // recipe filed under several appears under each of them, which is the point of
  // letting it carry more than one — except while a filter is on, where the chosen
  // heading is the only one the reader asked about and seeing the recipe again under
  // its other ones would read as the filter having been ignored.
  const groups = categories
    .filter((category) => categoryId === ALL || category.id === categoryId)
    .map((category) => ({
      category,
      recipes: matches.filter((recipe) => recipe.categoryIds.includes(category.id)),
    }))
    .filter((group) => group.recipes.length > 0);

  if (recipes.length === 0) {
    return (
      <EmptyState {...(categories.length === 0 ? { icon: "🗂️" } : { art: "pot" as const })}>
        {categories.length === 0 ? say(RECIPES.noCategoriesYet) : say(RECIPES.noRecipesYet)}
      </EmptyState>
    );
  }

  // One recipe counts once under every heading it is filed under, so the numbers on
  // the filters match what pressing them shows rather than adding up to the total.
  const counts = new Map(categories.map((category) => [category.id, 0]));
  for (const recipe of recipes) {
    for (const id of recipe.categoryIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  // Drawn only once something in the home actually has a time to filter by — a row of
  // chips that always turns up empty is a row not worth being offered.
  const hasTimedRecipe = recipes.some((recipe) => recipe.totalTimeMinutes !== null);
  const quickCount = recipes.filter((recipe) =>
    matchesTimeFilter(recipe.totalTimeMinutes, "quick"),
  ).length;
  const slowCount = recipes.filter((recipe) =>
    matchesTimeFilter(recipe.totalTimeMinutes, "slow"),
  ).length;

  /** What a card shows, whether it is a link to the recipe or a box to tick. */
  const face = (recipe: RecipeSummary) => (
    <>
      {/* Decorative: the recipe's own title is directly below it. */}
      <PhotoCover photoId={recipe.photoId} alt="" />
      <div className="p-3 sm:p-5">
        <p className="pr-7 font-medium sm:pr-9">{recipe.title}</p>
        {recipe.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            {recipe.description}
          </p>
        )}
        {(recipe.totalTimeMinutes !== null || recipe.rating) && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            {timeLabel(recipe.totalTimeMinutes, language)}
            {recipe.totalTimeMinutes !== null && recipe.rating && (
              <span aria-hidden="true">{" · "}</span>
            )}
            {recipe.rating && (
              <span
                className="inline-flex items-center gap-0.5"
                aria-label={say(RECIPES.ratingAria, {
                  average: formatAverage(recipe.rating.average, language),
                  count: recipe.rating.count,
                })}
              >
                <HeartIcon filled className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span aria-hidden="true">
                  {formatAverage(recipe.rating.average, language)}
                </span>
              </span>
            )}
          </p>
        )}
      </div>
    </>
  );

  /** A hold on a card: start choosing with that one, or add it while choosing. */
  function hold(id: string) {
    tick();
    setChosen((current) => new Set(current ?? []).add(id));
  }

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13 13l4 4" strokeLinecap="round" />
          </svg>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={say(RECIPES.searchRecipes)}
            aria-label={say(RECIPES.searchRecipesAria)}
            autoComplete="off"
            className="pl-9"
          />
        </div>
      </div>

      <div
        role="group"
        aria-label={say(RECIPES.filterByCategory)}
        className="scrollbar-hidden mb-3 flex flex-nowrap gap-2 overflow-x-auto"
      >
        <FilterChip
          label={say(RECIPES.all)}
          active={categoryId === ALL}
          count={recipes.length}
          onClick={() => setCategoryId(ALL)}
          language={language}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            label={category.name}
            active={categoryId === category.id}
            count={counts.get(category.id) ?? 0}
            onClick={() => setCategoryId(category.id)}
            language={language}
          />
        ))}
      </div>

      {hasTimedRecipe && (
        <div
          role="group"
          aria-label={say(RECIPES.filterByTime)}
          className="scrollbar-hidden mb-5 flex flex-nowrap gap-2 overflow-x-auto"
        >
          <FilterChip
            label={say(RECIPES.anyTime)}
            active={timeFilter === "all"}
            count={recipes.length}
            onClick={() => setTimeFilter("all")}
            language={language}
          />
          <FilterChip
            label={say(RECIPES.underMin, { min: QUICK_RECIPE_MINUTES })}
            active={timeFilter === "quick"}
            count={quickCount}
            onClick={() => setTimeFilter("quick")}
            language={language}
          />
          <FilterChip
            label={say(RECIPES.minPlus, { min: QUICK_RECIPE_MINUTES })}
            active={timeFilter === "slow"}
            count={slowCount}
            onClick={() => setTimeFilter("slow")}
            language={language}
          />
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState>
          {needle
            ? say(RECIPES.noRecipeMatch, { query: query.trim() })
            : timeFilter !== "all"
              ? say(
                  timeFilter === "quick"
                    ? categoryId !== ALL
                      ? RECIPES.noneUnderTimeInCategory
                      : RECIPES.noneUnderTime
                    : categoryId !== ALL
                      ? RECIPES.noneOverTimeInCategory
                      : RECIPES.noneOverTime,
                  { min: QUICK_RECIPE_MINUTES },
                )
              : say(RECIPES.nothingInCategory)}
        </EmptyState>
      ) : (
        /*
         * Keyed by the filter, so changing it remounts what is under it and every card
         * plays its arrival again. The movement is the answer to the press: the cards
         * that survive a filter would otherwise sit exactly where they were while the
         * rest vanished, which reads as nothing having happened. A keyframe rather than
         * a transition for the usual reason — there is no painted "before" for a card
         * that has just been mounted. Only the category does this and not the search
         * box: a re-entrance on every keystroke is a page that will not sit still.
         */
        <div key={categoryId} className={`space-y-6 ${chosen ? "pb-20" : ""}`}>
          {groups.map((group) => (
            <section key={group.category.id}>
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-slate-500 uppercase">
                <span>{group.category.name}</span>
                <span className="text-xs font-normal normal-case">{group.recipes.length}</span>
              </h2>
              {/* Two to a row at every width: a recipe card is a picture with a name
                  under it, which stays recognisable small, and one per row on a phone
                  turns a dozen recipes into a scroll nobody reaches the end of. */}
              <div className="grid grid-cols-2 gap-3">
                {group.recipes.map((recipe, index) => (
                  <Card
                    key={recipe.id}
                    padded={false}
                    className={`animate-row-in relative h-full overflow-hidden transition-colors duration-(--dur-quick) hover:border-slate-400 ${
                      chosen?.has(recipe.id) ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : ""
                    }`}
                    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                  >
                    {chosen ? (
                      // While choosing, the whole card is the box to tick — a link here
                      // would open the recipe under a thumb that meant to pick it.
                      <button
                        type="button"
                        onClick={() => toggle(recipe.id)}
                        aria-pressed={chosen.has(recipe.id)}
                        className="press-card relative block h-full w-full text-left"
                      >
                        {face(recipe)}
                        <span
                          aria-hidden="true"
                          className={`absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-full border-2 ${
                            chosen.has(recipe.id)
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-white bg-white/70 backdrop-blur-sm"
                          }`}
                        >
                          {chosen.has(recipe.id) && (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>
                    ) : (
                      <HoldableLink href={`/recipes/${recipe.id}`} onHold={() => hold(recipe.id)}>
                        {face(recipe)}
                        <LinkCue />
                      </HoldableLink>
                    )}
                    {/* Over the card rather than in it: the card is one link, and a
                        button inside a link is neither valid nor pressable without
                        following it. The backdrop keeps the dots legible on a photo. */}
                    {!chosen && (
                      <ItemMenu
                        name="recipeId"
                        id={recipe.id}
                        label={recipe.title}
                        editTitle={say(RECIPES.editRecipe)}
                        editAction={updateRecipe}
                        editOverlay={recipeSaveOverlay(language, recipe)}
                        extraFields={<input type="hidden" name={STAY_FIELD} value="1" />}
                        deleteAction={deleteRecipe}
                        deleteMessage={say(RECIPES.deleteRecipeMessage, { title: recipe.title })}
                        extraItems={
                          <>
                            <AddToMealPlanMenuItem recipeId={recipe.id} />
                            <MenuItem icon="check" onSelect={() => hold(recipe.id)}>
                              {say(RECIPES.bulkChoose)}
                            </MenuItem>
                          </>
                        }
                        className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm"
                      >
                        <RecipeFields recipe={recipe} categories={categories} language={language} />
                      </ItemMenu>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {chosen && (
        // While choosing, the bar takes the place the page's "+" would float in once the
        // tab bar has scrolled away — `data-choosing` stands the "+" down (globals.css).
        <RecipeSelectionBar
          chosen={[...chosen]}
          categories={categories}
          lists={lists}
          onDone={() => setChosen(null)}
        />
      )}
    </>
  );
}

/**
 * A recipe card's link that also answers a press and hold — which starts choosing
 * rather than opening the recipe. `select-none` and the callout off, so a held finger
 * selects no text and raises no "open in new tab" menu of the browser's own.
 */
function HoldableLink({ href, onHold, children }: { href: string; onHold: () => void; children: React.ReactNode }) {
  const press = useLongPress(onHold);
  return (
    <Link
      href={href}
      prefetch
      draggable={false}
      {...press}
      className="press-card relative block h-full select-none [-webkit-touch-callout:none]"
    >
      {children}
    </Link>
  );
}

/**
 * One filter.
 *
 * The count is spelled out in the label rather than left to sit beside the name, where
 * a screen reader would read "Weeknight1" — the two are separate elements on the page
 * and nothing tells it otherwise.
 */
function FilterChip({
  label,
  active,
  count,
  onClick,
  language,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
  language: HomeLanguage;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={sayIn(language)(RECIPES.filterAriaLabel, { label, count })}
      className={`press-button shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
      <span className={`ml-1.5 text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>
        {count}
      </span>
    </button>
  );
}

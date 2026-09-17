"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { Card, EmptyState, Input } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { RecipeFields } from "@/components/recipe-fields";
import { PhotoCover } from "@/components/photo";

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
  hasVideo: boolean;
};

export type RecipeCategorySummary = { id: string; name: string };

const ALL = "all";

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
}: {
  recipes: RecipeSummary[];
  categories: RecipeCategorySummary[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL);

  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    const inCategory =
      categoryId === ALL
        ? recipes
        : recipes.filter((recipe) => recipe.categoryIds.includes(categoryId));
    if (!needle) return inCategory;

    return inCategory.filter((recipe) =>
      [recipe.title, recipe.description ?? "", recipe.ingredients]
        .join("\n")
        .toLowerCase()
        .includes(needle),
    );
  }, [recipes, categoryId, needle]);

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
      <EmptyState>
        {categories.length === 0
          ? "No recipe categories yet — an admin adds them under Settings, and then recipes can be saved."
          : "No recipes saved yet."}
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

  return (
    <>
      <div className="relative mb-3">
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
          placeholder="Search recipes and ingredients"
          aria-label="Search recipes"
          autoComplete="off"
          className="pl-9"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by category"
        className="mb-5 flex flex-wrap gap-2"
      >
        <FilterChip
          label="All"
          active={categoryId === ALL}
          count={recipes.length}
          onClick={() => setCategoryId(ALL)}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            label={category.name}
            active={categoryId === category.id}
            count={counts.get(category.id) ?? 0}
            onClick={() => setCategoryId(category.id)}
          />
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState>
          {needle ? <>No recipe matches “{query.trim()}”.</> : "Nothing filed under this category yet."}
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
        <div key={categoryId} className="space-y-6">
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
                    className="animate-row-in relative h-full overflow-hidden transition-colors duration-150 hover:border-slate-400"
                    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                  >
                    <Link
                      href={`/recipes/${recipe.id}`}
                      prefetch
                      className="pressable block h-full active:scale-[0.98]"
                    >
                      {/* Decorative: the recipe's own title is directly below it. */}
                      <PhotoCover photoId={recipe.photoId} alt="" />
                      <div className="p-3 sm:p-5">
                        <p className="pr-7 font-medium sm:pr-9">{recipe.title}</p>
                        {recipe.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {recipe.description}
                          </p>
                        )}
                        {recipe.hasVideo && (
                          <p className="mt-2 text-xs text-slate-500">Includes a video</p>
                        )}
                      </div>
                    </Link>
                    {/* Over the card rather than in it: the card is one link, and a
                        button inside a link is neither valid nor pressable without
                        following it. The backdrop keeps the dots legible on a photo. */}
                    <ItemMenu
                      name="recipeId"
                      id={recipe.id}
                      label={recipe.title}
                      editTitle="Edit recipe"
                      editAction={updateRecipe}
                      deleteAction={deleteRecipe}
                      deleteMessage={`Delete the recipe "${recipe.title}"?`}
                      className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm"
                    >
                      <RecipeFields recipe={recipe} categories={categories} />
                    </ItemMenu>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
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
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${count} ${count === 1 ? "recipe" : "recipes"}`}
      className={`pressable rounded-full border px-3 py-1.5 text-sm font-medium active:scale-[0.96] ${
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

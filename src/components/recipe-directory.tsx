"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, EmptyState, Input } from "@/components/ui";
import { PhotoCover } from "@/components/photo";

export type RecipeSummary = {
  id: string;
  title: string;
  categoryId: string;
  /** The recipe's picture, if it has one. Only the id: the card fetches the thumbnail. */
  photoId: string | null;
  description: string | null;
  /** Kept only to search on — the card shows the title and description. */
  ingredients: string;
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
      categoryId === ALL ? recipes : recipes.filter((recipe) => recipe.categoryId === categoryId);
    if (!needle) return inCategory;

    return inCategory.filter((recipe) =>
      [recipe.title, recipe.description ?? "", recipe.ingredients]
        .join("\n")
        .toLowerCase()
        .includes(needle),
    );
  }, [recipes, categoryId, needle]);

  // Headings in the categories' own order, and only those with something under them:
  // a page of empty headings tells the reader nothing about what is in the house.
  const groups = categories
    .map((category) => ({
      category,
      recipes: matches.filter((recipe) => recipe.categoryId === category.id),
    }))
    .filter((group) => group.recipes.length > 0);

  if (recipes.length === 0) {
    return (
      <EmptyState>
        {categories.length === 0
          ? "No recipe categories yet — an admin adds them under Administration, and then recipes can be saved."
          : "No recipes saved yet."}
      </EmptyState>
    );
  }

  const counts = new Map(categories.map((category) => [category.id, 0]));
  for (const recipe of recipes) {
    counts.set(recipe.categoryId, (counts.get(recipe.categoryId) ?? 0) + 1);
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
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.category.id}>
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-slate-500 uppercase">
                <span>{group.category.name}</span>
                <span className="text-xs font-normal normal-case">{group.recipes.length}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.recipes.map((recipe, index) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    prefetch
                    className="pressable animate-row-in block active:scale-[0.98]"
                    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                  >
                    <Card
                      padded={false}
                      className="h-full overflow-hidden transition-colors duration-150 hover:border-slate-400"
                    >
                      {/* Decorative: the recipe's own title is directly below it. */}
                      <PhotoCover photoId={recipe.photoId} alt="" />
                      <div className="p-5">
                        <p className="font-medium">{recipe.title}</p>
                        {recipe.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {recipe.description}
                          </p>
                        )}
                        {recipe.hasVideo && (
                          <p className="mt-2 text-xs text-slate-500">Includes a video</p>
                        )}
                      </div>
                    </Card>
                  </Link>
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

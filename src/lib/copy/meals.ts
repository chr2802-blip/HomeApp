import type { Phrase, Plural } from "./say";

/** `/meals`, the week's rows, the day sheet, and the picker inside it. */
export const MEALS = {
  title: { EN: "Meals", DA: "Måltider" },
  description: {
    EN: "What the week is eating. Pick a recipe for a day, or say you are out.",
    DA: "Hvad ugen spiser. Vælg en opskrift til en dag, eller sig I spiser ude.",
  },

  // What a day's row and the picker both say — src/lib/meals.ts
  eatingOut: { EN: "Eating out", DA: "Spiser ude" },
  nothingPlanned: { EN: "Nothing planned", DA: "Intet planlagt" },
  leftovers: { EN: "Leftovers", DA: "Rester" },
  /** Danish genitive drops the apostrophe: "tirsdags lasagne", not "tirsdag's lasagne". */
  leftoversOf: { EN: "Leftovers — {day}'s {title}", DA: "Rester — {day}s {title}" },

  // The picker's groups
  suggested: { EN: "Suggested", DA: "Foreslået" },
  sharesWithWeek: {
    EN: {
      one: "Shares {shared} of {count} ingredient with the week",
      other: "Shares {shared} of {count} ingredients with the week",
    },
    DA: {
      one: "Deler {shared} af {count} ingrediens med ugen",
      other: "Deler {shared} af {count} ingredienser med ugen",
    },
  },
  recentlyPlanned: { EN: "Recently planned", DA: "Senest planlagt" },
  allRecipes: { EN: "All recipes", DA: "Alle opskrifter" },
  lastPlanned: { EN: "Last planned {day}", DA: "Sidst planlagt {day}" },

  // The week nav and the day sheet — src/app/(app)/meals/page.tsx
  weekAria: { EN: "Week", DA: "Uge" },
  previousWeek: { EN: "Previous week", DA: "Forrige uge" },
  nextWeek: { EN: "Next week", DA: "Næste uge" },
  backToThisWeek: { EN: "Back to this week", DA: "Tilbage til denne uge" },
  resetWeekTitle: { EN: "Reset this week?", DA: "Nulstil denne uge?" },
  resetWeekMessage: {
    EN: "Clear everything planned for {week}? The recipes themselves are untouched — only this week's plan.",
    DA: "Ryd alt planlagt for {week}? Selve opskrifterne rører vi ikke — kun denne uges plan.",
  },
  resetWeek: { EN: "Reset week", DA: "Nulstil uge" },
  today: { EN: "Today", DA: "I dag" },
  noRecipesYet: {
    EN: "There are no recipes in this home yet. Save a few on the Recipes tab and they will show up here — until then a day can still be marked as eating out.",
    DA: "Der er ingen opskrifter i dette hjem endnu. Gem et par stykker under fanen Opskrifter, så dukker de op her — indtil da kan en dag stadig markeres som at spise ude.",
  },

  // meal-picker.tsx
  eatingLegend: { EN: "Eating", DA: "Mad" },
  noMatch: { EN: "Nothing here matches “{query}”.", DA: "Intet her matcher “{query}”." },
  noSavedRecipes: {
    EN: "No recipes saved yet — add some on the Recipes tab, or say you are eating out.",
    DA: "Ingen opskrifter gemt endnu — tilføj nogle under fanen Opskrifter, eller sig I spiser ude.",
  },

  // meal-week.tsx
  goToRecipe: { EN: "Go to recipe", DA: "Gå til opskriften" },

  // add-to-meal-plan-menu-item.tsx
  addToMealPlan: { EN: "Add to meal plan", DA: "Tilføj til madplan" },

  // src/app/actions/meals.ts
  notARealDate: { EN: "That is not a real date.", DA: "Det er ikke en rigtig dato." },
  notARecipeInHome: { EN: "That recipe is not in this home.", DA: "Den opskrift er ikke i dette hjem." },
  notCookedYet: {
    EN: "There is nothing cooked that day to have leftovers of.",
    DA: "Der er ikke lavet noget den dag at have rester af.",
  },
  notYetEaten: {
    EN: "Leftovers come after the meal, not before it.",
    DA: "Rester kommer efter måltidet, ikke før det.",
  },
} as const satisfies Record<string, Phrase | Plural>;

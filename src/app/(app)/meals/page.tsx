import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { planMeal, resetMealWeek } from "@/app/actions/meals";
import { addMealPlanIngredients } from "@/app/actions/lists";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { AddToListMenu } from "@/components/add-to-list-menu";
import { ConfirmButton } from "@/components/confirm-button";
import { PhotoThumb } from "@/components/photo";
import { MealWeek } from "@/components/meal-week";
import type { PlanGroup, PlanOption } from "@/components/meal-picker";
import {
  LEFTOVERS_LABEL,
  NOTHING_LABEL,
  OUT_LABEL,
  PLAN_NOTHING,
  PLAN_OUT,
  dayAndMonth,
  leftoversChoice,
  leftoversLabel,
  weekLabel,
  weekdayName,
} from "@/lib/meals";
import {
  ingredientKeys,
  rankByOverlap,
  staplesOf,
  suggestionReason,
  type MealSuggestion,
  type SuggestionCandidate,
} from "@/lib/meal-suggestions";
import {
  nextWeekStart,
  previousWeekStart,
  todayInZone,
  weekDays,
  weekStartInZone,
  weekStartOn,
} from "@/lib/time";

/** What the week's rows are drawn from: one day, and whatever has been decided about it. */
type PlannedDay = {
  date: string;
  /**
   * Present only where a row exists. Inside it, a recipe is the cooking, a `leftoverOf`
   * is the earlier day being eaten again, and neither is the night out.
   */
  plan?: {
    leftoverOf: string | null;
    recipe: { id: string; title: string; photoId: string | null } | null;
  };
};

/** The meal a leftovers day is living off, or null where its pointer reaches nothing. */
type Source = { day: string; title: string; photoId: string | null } | null;

/**
 * How many recipes the "Recently planned" group names, and how far back the rows are
 * read to find them.
 *
 * Six is a group somebody reads rather than scrolls, and forty days of plans is deep
 * enough to hold six distinct meals in any household that cooks at all — while staying
 * one bounded query rather than the whole of a home's history.
 */
const RECENT_COUNT = 6;
const RECENT_LOOKBACK = 40;

/**
 * The week the page is showing.
 *
 * `?week=` is read through `weekStartOn`, which answers with the Monday of a real week or
 * with nothing at all — so a mistyped address, or a bookmark from a week that never
 * existed, lands on this week rather than on seven days of arithmetic nobody can read.
 * Normalised rather than rejected: a link to any day of a week is a link to that week.
 */
function askedWeek(asked: string | undefined, now: Date) {
  return (asked && weekStartOn(asked)) || weekStartInZone(now);
}

/** The face of one row: the picture and the words, whichever of the four states it is in. */
function DayFace({
  day,
  today,
  plan,
  source,
}: {
  day: string;
  today: string;
  plan: PlannedDay["plan"];
  source: Source;
}) {
  const recipe = plan?.recipe ?? null;
  // A leftovers day wears the picture of what is being eaten, because that is what is
  // being eaten. It is the same meal a second time, not a different kind of evening.
  const photoId = recipe?.photoId ?? source?.photoId ?? null;

  return (
    <>
      {/* Decorative: the recipe's own name is right beside it. A day with nothing on it
          keeps the space, so the seven rows read as a week rather than as a ragged list. */}
      {photoId ? (
        <PhotoThumb photoId={photoId} alt="" className="h-12 w-12" />
      ) : (
        <div aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl bg-slate-100" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{weekdayName(day)}</p>
          <span className="text-xs text-slate-500">{dayAndMonth(day)}</span>
          {day === today && <Badge>Today</Badge>}
        </div>
        {/* Four states, four sentences. "Nothing planned" is grey because it is the
            absence of an answer rather than an answer, which is also how it is stored. */}
        {recipe ? (
          <p className="mt-0.5 truncate text-sm text-slate-600">{recipe.title}</p>
        ) : plan?.leftoverOf ? (
          <p className="mt-0.5 truncate text-sm text-slate-600">{leftoversLabel(source)}</p>
        ) : plan ? (
          <p className="mt-0.5 text-sm text-slate-600">{OUT_LABEL}</p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-400">{NOTHING_LABEL}</p>
        )}
      </div>
    </>
  );
}

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireHomeUser();
  const now = new Date();
  const today = todayInZone(now);

  const week = askedWeek((await searchParams).week, now);
  const days = weekDays(week);
  const thisWeek = weekStartInZone(now);

  const db = homeDb(user.homeId);

  // The Sunday before, fetched alongside the week itself: Monday living off Sunday's
  // roast is the commonest leftovers there is, and a week that could not see the day
  // before it would be the one week in seven where the offer disappeared.
  const sundayBefore = weekDays(previousWeekStart(week))[6]!;

  const [plans, recipes, recentPlans, shoppingLists] = await Promise.all([
    // Seven days by name rather than a range: the week is seven calendar days in the
    // home's own zone, and comparing strings is what the column is stored as text for.
    db.mealPlan.findMany({
      where: { date: { in: [sundayBefore, ...days] } },
      select: {
        date: true,
        leftoverOf: true,
        // Read as an include on a query that went through homeDb, and `photoId` only —
        // never `photo: true`, which would pull both copies of every picture's bytes
        // into a page that needs a URL.
        recipe: { select: { id: true, title: true, photoId: true } },
      },
    }),
    // Alphabetical, because the picker's last group is a list somebody is looking a name
    // up in. `ingredients` rides along for the ranking and the search box both: it is the
    // recipe's own text and not its picture, so the whole home's worth of it is a page of
    // words.
    db.recipe.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        photoId: true,
        ingredients: true,
        categories: { select: { category: { select: { excludeFromSuggestion: true } } } },
      },
    }),
    // What the household has actually been cooking, most recent first. A home keeps ten
    // recipes in rotation out of however many it has saved, so this is the group that
    // means most of the picks never reach the search box. Bounded rather than the whole
    // history: what is wanted is the top of it, and RECENT_LOOKBACK rows is more than
    // enough to find RECENT_COUNT distinct meals.
    db.mealPlan.findMany({
      // Strictly before the week on screen: a plan for next month is not something the
      // household has *been* cooking, and ordered by date it would sit at the top of a
      // group whose whole claim is recency.
      where: { recipeId: { not: null }, date: { lt: week } },
      orderBy: { date: "desc" },
      take: RECENT_LOOKBACK,
      select: { date: true, recipeId: true },
    }),
    // The home's lists that track amounts, for the "Add to list" menu — the same
    // filtering the recipe page's own menu uses, and for the same reason: an ingredient
    // line is a quantity, and a list that ignores amounts has nowhere to put it.
    db.list.findMany({
      where: { trackAmounts: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, _count: { select: { items: { where: { done: false } } } } },
    }),
  ]);

  const planned = new Map(plans.map((plan) => [plan.date, plan]));

  /** What a leftovers day is living off, looked up among the rows already fetched. */
  const sourceOf = (plan: PlannedDay["plan"]): Source => {
    const from = plan?.leftoverOf ? planned.get(plan.leftoverOf) : undefined;
    return from?.recipe
      ? { day: plan!.leftoverOf!, title: from.recipe.title, photoId: from.recipe.photoId }
      : null;
  };

  /**
   * The cooked days a given day may say it is the leftovers of: earlier, and cooking.
   *
   * Offered per day rather than once for the week, because "earlier" is different for
   * every row — and a Thursday offering to be the leftovers of Friday is an option whose
   * only outcome is the action refusing it.
   */
  const leftoversFor = (day: string): PlanOption[] =>
    [sundayBefore, ...days]
      .filter((other) => other < day && planned.get(other)?.recipe)
      .map((other) => ({
        value: leftoversChoice(other),
        label: leftoversLabel({ day: other, title: planned.get(other)!.recipe!.title }),
        photoId: planned.get(other)!.recipe!.photoId,
      }));

  /**
   * The three recipes that share most with what the week is already buying.
   *
   * Worked out once for the whole week rather than per day: the basket is the week's, so
   * every empty day is being asked the same question. It answers differently as the week
   * fills — planning Tuesday re-ranks what Wednesday is offered, which is the sequence a
   * cook would go through anyway, without anything being decided on their behalf.
   */
  const suggestions = weekSuggestions(
    recipes,
    // The week's own cooking, not the Sunday fetched beside it: that day belongs to the
    // shop before this one, and counting it would have the week sharing with a basket
    // nobody is going to buy again.
    days.map((day) => planned.get(day)?.recipe?.id).filter((id) => id !== undefined),
  );

  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  /** A recipe as a row: its picture, and everything the search box should read. */
  const recipeOption = (recipe: (typeof recipes)[number], note?: string): PlanOption => ({
    value: recipe.id,
    label: recipe.title,
    photoId: recipe.photoId,
    note,
    searchText: `${recipe.description ?? ""}\n${recipe.ingredients}`,
  });

  /**
   * The recipes the household has cooked most recently, each named once.
   *
   * The rows arrive newest first, so the first time a recipe is seen is the last time it
   * was cooked — which is both the order this group wants and the date it shows.
   */
  const recent: PlanOption[] = [];
  const seenRecently = new Set<string>();
  for (const plan of recentPlans) {
    if (recent.length >= RECENT_COUNT) break;
    const recipe = plan.recipeId ? byId.get(plan.recipeId) : undefined;
    if (!recipe || seenRecently.has(recipe.id)) continue;
    seenRecently.add(recipe.id);
    recent.push(recipeOption(recipe, `Last planned ${dayAndMonth(plan.date)}`));
  }

  /**
   * Everything one day can be set to, in the order the sheet offers it.
   *
   * The groups are a **partition**: a recipe is claimed by the first one that wants it
   * and does not appear again below, so nothing is offered twice. The two at the top are
   * always drawn — an evening out is one press and must not be somewhere a household has
   * to search for.
   */
  const groupsFor = (day: string): PlanGroup[] => {
    const empty = !planned.get(day);
    // Offered only where there is nothing planned yet: a suggestion beside a decision
    // already made is a page arguing with the household.
    const suggested = empty ? suggestions : [];
    const claimed = new Set<string>();

    const take = (options: PlanOption[]) => {
      const kept = options.filter((option) => !claimed.has(option.value));
      for (const option of kept) claimed.add(option.value);
      return kept;
    };

    return [
      {
        heading: null,
        options: [
          { value: PLAN_NOTHING, label: NOTHING_LABEL },
          { value: PLAN_OUT, label: OUT_LABEL },
        ],
      },
      { heading: LEFTOVERS_LABEL, options: leftoversFor(day) },
      {
        heading: "Suggested",
        options: take(
          suggested.map((suggestion) =>
            recipeOption(byId.get(suggestion.recipeId)!, suggestionReason(suggestion)),
          ),
        ),
      },
      { heading: "Recently planned", options: take(recent) },
      { heading: "All recipes", options: take(recipes.map((recipe) => recipeOption(recipe))) },
    ].filter((group) => group.options.length > 0);
  };

  return (
    <>
      <PageHeader
        title="Meals"
        description="What the week is eating. Pick a recipe for a day, or say you are out."
        action={
          // Only where there is something cooking this week to shop for — a control
          // that would only ever answer "nothing is being cooked this week yet" is a
          // control offering to fail, the same reason the recipe page's own menu is
          // conditional on having ingredients at all.
          days.some((day) => planned.get(day)?.recipe) && (
            <AddToListMenu
              action={addMealPlanIngredients}
              extraData={{ week }}
              lists={shoppingLists.map((list) => ({
                id: list.id,
                title: list.title,
                open: list._count.items,
              }))}
            />
          )
        }
      />

      {/* The week, and the way to the ones either side of it. Links rather than buttons:
          a week is a place, so it can be shared, bookmarked and reached with the back
          arrow — which is also what lets the whole page stay on the server. */}
      <nav aria-label="Week" className="mb-4 flex items-center justify-between gap-2">
        <ButtonLink
          href={`/meals?week=${previousWeekStart(week)}`}
          variant="secondary"
          aria-label="Previous week"
        >
          ‹
        </ButtonLink>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-medium">{weekLabel(days)}</p>
          <div className="mt-0.5 flex items-center justify-center gap-2">
            {/* Only away from the live week: a link back to where you already are is
                furniture, and it is the one link here whose target is not relative. */}
            {week !== thisWeek && (
              <ButtonLink href="/meals" variant="ghost" className="px-1 py-0 text-xs">
                Back to this week
              </ButtonLink>
            )}
            {/* Only where there is something to clear — a reset that would do nothing is
                a button offering to fail. */}
            {days.some((day) => planned.has(day)) && (
              <form action={resetMealWeek}>
                <input type="hidden" name="week" value={week} />
                <ConfirmButton
                  title="Reset this week?"
                  confirmLabel="Reset"
                  message={`Clear everything planned for ${weekLabel(days)}? The recipes themselves are untouched — only this week's plan.`}
                  triggerVariant="danger"
                  triggerClassName="px-2 py-1 text-xs"
                >
                  Reset week
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>

        <ButtonLink
          href={`/meals?week=${nextWeekStart(week)}`}
          variant="secondary"
          aria-label="Next week"
        >
          ›
        </ButtonLink>
      </nav>

      <MealWeek
        action={planMeal}
        days={days.map((day) => ({
          date: day,
          title: `${weekdayName(day)} ${dayAndMonth(day)}`,
          selected: planSelection(planned.get(day)),
          groups: groupsFor(day),
          highlighted: day === today,
          // A day already lived through is read-only: there is nothing left to plan for
          // an evening that has already happened.
          disabled: day < today,
          face: (
            <DayFace
              day={day}
              today={today}
              plan={planned.get(day)}
              source={sourceOf(planned.get(day))}
            />
          ),
        }))}
      />

      {recipes.length === 0 && (
        <Card className="mt-6 text-sm text-slate-500">
          There are no recipes in this home yet. Save a few on the Recipes tab and they will
          show up here — until then a day can still be marked as eating out.
        </Card>
      )}
    </>
  );
}

/**
 * What the picker opens on: the recipe that is planned, the day being eaten again, the
 * night out, or nothing.
 *
 * The states of the row read back as the values of one field, which is the whole reason
 * the row is shaped the way it is. `recipeId` is asked first, so a row that somehow held
 * both columns opens on the meal it names rather than on a pointer.
 */
function planSelection(plan: PlannedDay["plan"] | undefined) {
  if (!plan) return "";
  if (plan.recipe) return plan.recipe.id;
  return plan.leftoverOf ? leftoversChoice(plan.leftoverOf) : PLAN_OUT;
}

/**
 * The shortlist an empty day is offered, from the week's own cooking.
 *
 * Every recipe in the home is weighed for staples — what a household cooks is the best
 * description of its cupboard there is — while only the ones not already on the week,
 * and not filed under a heading its admins excluded, can be offered. The exclusion is
 * the same rule `suggestedRecipeFor` follows for the dashboard's dinner, applied here to
 * rows already in hand rather than asked for again.
 */
function weekSuggestions(
  recipes: (SuggestionCandidate & {
    categories: { category: { excludeFromSuggestion: boolean } }[];
  })[],
  cookingIds: string[],
): MealSuggestion[] {
  const cooking = new Set(cookingIds);

  const basket = new Set<string>();
  for (const recipe of recipes) {
    if (!cooking.has(recipe.id)) continue;
    for (const key of ingredientKeys(recipe.ingredients)) basket.add(key);
  }

  return rankByOverlap({
    candidates: recipes.filter(
      (recipe) =>
        !cooking.has(recipe.id) &&
        !recipe.categories.some((link) => link.category.excludeFromSuggestion),
    ),
    basket,
    staples: staplesOf(recipes),
  });
}

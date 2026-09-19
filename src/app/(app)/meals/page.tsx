import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { planMeal } from "@/app/actions/meals";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { PhotoThumb } from "@/components/photo";
import { MealDay, type RecipeOption } from "@/components/meal-day";
import {
  NOTHING_LABEL,
  OUT_LABEL,
  PLAN_OUT,
  dayAndMonth,
  weekLabel,
  weekdayName,
} from "@/lib/meals";
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
  /** Present only where a row exists; null inside it is the night out. */
  plan?: { recipe: { id: string; title: string; photoId: string | null } | null };
};

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

/** The face of one row: the picture and the words, whichever of the three states it is in. */
function DayFace({ day, today, plan }: { day: string; today: string; plan: PlannedDay["plan"] }) {
  const recipe = plan?.recipe ?? null;

  return (
    <>
      {/* Decorative: the recipe's own name is right beside it. A day with nothing on it
          keeps the space, so the seven rows read as a week rather than as a ragged list. */}
      {recipe?.photoId ? (
        <PhotoThumb photoId={recipe.photoId} alt="" className="h-12 w-12" />
      ) : (
        <div aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl bg-slate-100" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{weekdayName(day)}</p>
          <span className="text-xs text-slate-500">{dayAndMonth(day)}</span>
          {day === today && <Badge>Today</Badge>}
        </div>
        {/* Three states, three sentences. "Nothing planned" is grey because it is the
            absence of an answer rather than an answer, which is also how it is stored. */}
        {recipe ? (
          <p className="mt-0.5 truncate text-sm text-slate-600">{recipe.title}</p>
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

  const [plans, recipes] = await Promise.all([
    // Seven days by name rather than a range: the week is seven calendar days in the
    // home's own zone, and comparing strings is what the column is stored as text for.
    db.mealPlan.findMany({
      where: { date: { in: days } },
      select: {
        date: true,
        // Read as an include on a query that went through homeDb, and `photoId` only —
        // never `photo: true`, which would pull both copies of every picture's bytes
        // into a page that needs a URL.
        recipe: { select: { id: true, title: true, photoId: true } },
      },
    }),
    // Alphabetical, because the picker is a list somebody is looking a name up in.
    db.recipe.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  const planned = new Map(plans.map((plan) => [plan.date, plan]));
  const options: RecipeOption[] = recipes;

  return (
    <>
      <PageHeader
        title="Meals"
        description="What the week is eating. Pick a recipe for a day, or say you are out."
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
          {/* Only away from the live week: a link back to where you already are is
              furniture, and it is the one link here whose target is not relative. */}
          {week !== thisWeek && (
            <ButtonLink href="/meals" variant="ghost" className="mt-0.5 px-1 py-0 text-xs">
              Back to this week
            </ButtonLink>
          )}
        </div>

        <ButtonLink
          href={`/meals?week=${nextWeekStart(week)}`}
          variant="secondary"
          aria-label="Next week"
        >
          ›
        </ButtonLink>
      </nav>

      <div className="space-y-3">
        {days.map((day, index) => (
          <div
            key={day}
            className="animate-row-in"
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
          >
            <MealDay
              date={day}
              title={`${weekdayName(day)} ${dayAndMonth(day)}`}
              selected={planSelection(planned.get(day))}
              recipes={options}
              action={planMeal}
              highlighted={day === today}
            >
              <DayFace day={day} today={today} plan={planned.get(day)} />
            </MealDay>
          </div>
        ))}
      </div>

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
 * What the picker opens on: the recipe that is planned, the night out, or nothing.
 *
 * The three states of the row read back as the three values of one field, which is the
 * whole reason the row is shaped the way it is.
 */
function planSelection(plan: PlannedDay["plan"] | undefined) {
  if (!plan) return "";
  return plan.recipe ? plan.recipe.id : PLAN_OUT;
}

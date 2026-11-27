import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { dueAtOn, todayInZone } from "@/lib/time";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { createBaby } from "@/app/actions/baby";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, Input, Label } from "@/components/ui";
import { BabyLog } from "@/components/baby/baby-log";
import { SwipePager } from "@/components/swipe-pager";
import { loadBabyLog } from "./log-data";
import { ChartsPanel } from "./charts-panel";
import { BABY_TILES } from "@/lib/baby-tiles";

/** What a tile can narrow the list to (`?show=`): a tile, or every feed at once. */
const SHOWS = [...BABY_TILES, "feed"] as const;

/**
 * The baby log: what happened, how long since, and the buttons to write the next thing
 * down. `?day=` pages the timeline back through earlier days; the numbers at the top are
 * always about now.
 */
export default async function BabyPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; show?: string; period?: string; to?: string }>;
}) {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const db = homeDb(user.homeId);
  const baby = await db.baby.findFirst({ orderBy: { createdAt: "asc" } });

  if (!baby) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState art="home">
          <p className="font-display text-lg text-slate-800">{say(BABY.setupTitle)}</p>
          <p className="mt-1">{say(BABY.setupHint)}</p>
        </EmptyState>
        <Card className="mt-4">
          <ActionForm action={createBaby} submitLabel={say(BABY.startLog)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="baby-name">{say(BABY.name)}</Label>
              <Input id="baby-name" name="name" required maxLength={60} className="h-12 text-base" />
            </div>
          </ActionForm>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const today = todayInZone(now);
  const params = await searchParams;
  const asked = params.day;
  // A day that is not a real date, or one still to come, is today.
  const day = asked && dueAtOn(asked) && asked < today ? asked : today;
  const { entries, solids } = await loadBabyLog(user.homeId, baby.id, day, now);

  // The log and the charts side by side, both drawn: the pill and a sideways swipe slide
  // between them without fetching anything (`SwipePager`, `?tab=`).
  return (
    <SwipePager hrefs={["/baby", "/baby?tab=charts"]}>
      <BabyLog
      baby={{
        name: baby.name,
        trackSleep: baby.trackSleep,
        trackBreast: baby.trackBreast,
        trackBottle: baby.trackBottle,
        trackSolid: baby.trackSolid,
        trackDiaper: baby.trackDiaper,
      }}
      entries={entries}
      day={day}
      today={today}
      solids={solids}
      show={SHOWS.find((kind) => kind === params.show) ?? null}
      order={user.babyTiles}
      />
      <ChartsPanel homeId={user.homeId} babyId={baby.id} language={user.homeLanguage} params={params} />
    </SwipePager>
  );
}

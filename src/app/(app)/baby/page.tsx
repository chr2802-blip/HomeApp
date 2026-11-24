import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { dueAtOn, shiftDay, todayInZone } from "@/lib/time";
import { dayBounds, solidSuggestions } from "@/lib/baby";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { createBaby } from "@/app/actions/baby";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, Input, Label } from "@/components/ui";
import { BabyLog, type WireEntry } from "@/components/baby/baby-log";

/** The kinds a tile can narrow the list to (`?show=`). */
const SHOWS = ["sleep", "feed", "diaper"] as const;

/** How far back the numbers at the top look before asking for the newest of a kind on its own. */
const RECENT_DAYS = 3;

/**
 * The baby log: what happened, how long since, and the buttons to write the next thing
 * down. `?day=` pages the timeline back through earlier days; the numbers at the top are
 * always about now.
 */
export default async function BabyPage({ searchParams }: { searchParams: Promise<{ day?: string; show?: string }> }) {
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
  const { end } = dayBounds(day);
  const recentFrom = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  // The day before too: a night that began yesterday evening is drawn on this one.
  const dayFrom = dayBounds(shiftDay(day, -1)).start;

  const select = { id: true, kind: true, startedAt: true, endedAt: true, details: true, note: true } as const;
  const [around, lastFeed, lastSleep, solids] = await Promise.all([
    db.babyEvent.findMany({
      where: {
        babyId: baby.id,
        OR: [
          { startedAt: { gte: dayFrom, lt: end } },
          { startedAt: { gte: recentFrom } },
          { endedAt: null, kind: { in: ["SLEEP", "FEED"] } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 400,
      select,
    }),
    db.babyEvent.findFirst({ where: { babyId: baby.id, kind: "FEED" }, orderBy: { startedAt: "desc" }, select }),
    db.babyEvent.findFirst({ where: { babyId: baby.id, kind: "SLEEP" }, orderBy: { startedAt: "desc" }, select }),
    db.babyEvent.findMany({
      where: { babyId: baby.id, kind: "FEED", details: { path: ["method"], equals: "SOLID" } },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: { id: true, kind: true, startedAt: true, endedAt: true, details: true },
    }),
  ]);

  const byId = new Map<string, WireEntry>();
  for (const entry of [...around, lastFeed, lastSleep]) {
    if (!entry) continue;
    byId.set(entry.id, {
      id: entry.id,
      kind: entry.kind,
      startedAt: entry.startedAt.toISOString(),
      endedAt: entry.endedAt?.toISOString() ?? null,
      details: entry.details,
      note: entry.note,
    });
  }

  return (
    <BabyLog
      baby={{
        name: baby.name,
        trackSleep: baby.trackSleep,
        trackBreast: baby.trackBreast,
        trackBottle: baby.trackBottle,
        trackSolid: baby.trackSolid,
        trackDiaper: baby.trackDiaper,
      }}
      entries={[...byId.values()]}
      day={day}
      today={today}
      solids={solidSuggestions(solids)}
      show={SHOWS.find((kind) => kind === params.show) ?? null}
    />
  );
}

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limit";
import {
  cancelTimerPush,
  readTimerRequest,
  ringUrl,
  scheduleTimerPush,
  timerPushConfigured,
} from "@/lib/cook-timer-push";

export const dynamic = "force-dynamic";

/**
 * Where action mode asks for a timer to ring on the phone after the page has stopped
 * running (`lib/cook-timer-push.ts` says why that has to be a push from elsewhere).
 *
 * A route rather than a server action, because leaving action mode cancels with a
 * `keepalive` fetch sent as the page goes — which an action cannot be — and because the
 * cancel may come from a page that was loaded before a deploy.
 *
 * POST answers `{ id, available }`: the message to cancel with later, or `id: null` where
 * nothing was scheduled — not an error, a timer that rings in the page only. `available`
 * says whether this installation can ring a closed page at all, so action mode offers to
 * turn notifications on only where turning them on would change something.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.homeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timer = readTimerRequest(await request.json().catch(() => null), Date.now());
  if (!timer) return NextResponse.json({ error: "Not a timer" }, { status: 400 });

  // The recipe is being cooked in the home on screen; another home's id finds nothing.
  const recipe = await homeDb(user.homeId).recipe.findUnique({
    where: { id: timer.recipeId },
    select: { id: true },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every message spends QStash's daily quota, shared by the whole installation. A cook
  // restarts a timer a handful of times a dinner; only a loop reaches this.
  const available = timerPushConfigured();
  const limit = await checkRateLimit("cook-timer", user.id);
  if (!limit.allowed) return NextResponse.json({ id: null, available });

  try {
    const id = await scheduleTimerPush({ userId: user.id, ...timer }, ringUrl(request.url));
    if (id) await recordFailedAttempt("cook-timer", user.id);
    return NextResponse.json({ id, available });
  } catch (error) {
    // QStash down is a timer that rings in the page only, as it did before this existed.
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", event: "cook_timer_schedule_failed", message }));
    return NextResponse.json({ id: null, available });
  }
}

/** Stopping, restarting or leaving: `{ ids: [...] }`, each checked as the caller's own. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length < 200)
    : [];
  // A page has one timer per step; more than that is not a page.
  await Promise.all(ids.slice(0, 50).map((id) => cancelTimerPush(user.id, id)));
  return NextResponse.json({ ok: true });
}

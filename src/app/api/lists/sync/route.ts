import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOps } from "@/lib/offline-ops";
import { applyQueuedOps } from "@/lib/offline-sync";

export const dynamic = "force-dynamic";

/**
 * Where a browser sends the changes it made while it had no connection.
 *
 * A route rather than a server action, and this is the one place in the app where that is
 * the point: an action's identity belongs to the build that generated it, and the whole
 * premise here is a phone that has been away — possibly across a deploy — still holding
 * something it has to be able to send. A plain JSON endpoint is a promise this app can
 * keep about a request made by an older copy of itself.
 *
 * The session decides what may be touched, exactly as on any page: the body names ids and
 * nothing else, and each one is checked against the caller's homes inside
 * `applyQueuedOps`.
 *
 * It answers with what happened to each op, because the browser has to know the difference
 * between "sent" and "will never be sent": an applied op and a refused one both leave the
 * queue, while a request that fails outright leaves all of them in it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const ops = readOps(body);
  // A shape this version has never written — which is what a browser that went offline
  // before a deploy and came back after one can hand us. Refusing the batch is right: the
  // queue is the browser's to discard, not ours to guess at.
  if (!ops) return NextResponse.json({ error: "Not a queue of changes" }, { status: 400 });

  return NextResponse.json(await applyQueuedOps(user, ops));
}

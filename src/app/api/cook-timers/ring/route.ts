import { NextResponse } from "next/server";

import { isSignedByQstash, readTimerPush, ringTimer } from "@/lib/cook-timer-push";

export const dynamic = "force-dynamic";

/**
 * QStash calls this when a cook-mode timer runs out, and it sends the push.
 *
 * Nobody is signed in here: the only thing that makes this request believable is
 * QStash's signature over its body, so an unsigned or mis-signed one is refused before
 * the body is so much as parsed. Past that, every answer is a 200 — a timer that is
 * stale, or a recipe since deleted, is handled by not ringing, and anything else would
 * have QStash retry something that will never succeed.
 */
export async function POST(request: Request) {
  const body = await request.text();
  if (!(await isSignedByQstash(request.headers.get("upstash-signature"), body))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {}
  const timer = readTimerPush(parsed);
  if (!timer) return NextResponse.json({ delivered: 0 });

  return NextResponse.json({ delivered: await ringTimer(timer, Date.now()) });
}

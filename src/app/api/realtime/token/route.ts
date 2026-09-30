import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { realtimeConfig, realtimeToken } from "@/lib/realtime";
import { homeTopic } from "@/lib/realtime-topic";

export const dynamic = "force-dynamic";

/**
 * What an open list asks before it joins its home's Realtime channel: where Realtime is,
 * the publishable key a socket connects with, the topic to join, and a short-lived token
 * that lets it read that topic — see `src/lib/realtime.ts`.
 *
 * Asked again before the token runs out (the socket's `accessToken` callback), so a list
 * left open all afternoon keeps listening, and somebody removed from the home stops
 * within `TOKEN_TTL_SECONDS`.
 *
 * `{ enabled: false }` when Realtime is not configured, which is the phone's cue to
 * carry on polling at its old pace and never load the socket at all.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.homeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = realtimeConfig();
  if (!config) return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });

  // Every home they belong to, which is what they may reach — plus the one on screen,
  // which `getCurrentUser` has already allowed and which for a super admin reading a
  // household they are not a member of is not among them.
  const homeIds = [...new Set([...user.homes.map((home) => home.id), user.homeId])];
  const { token, expiresAt } = realtimeToken(config, user.id, homeIds);

  return NextResponse.json(
    {
      enabled: true,
      url: config.url,
      publishableKey: config.publishableKey,
      topic: homeTopic(user.homeId),
      token,
      expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

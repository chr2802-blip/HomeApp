import { createHmac } from "node:crypto";
import { after } from "next/server";
import { homeTopic, LIST_CHANGED, type ListChanged } from "@/lib/realtime-topic";

/**
 * The push half of an open list following the rest of the household, through Supabase
 * Realtime's Broadcast.
 *
 * The app's servers are serverless functions and cannot hold a socket open to a phone,
 * which is why a list first followed by polling (`useListFollow`). Supabase can: the
 * phone keeps one websocket open to Realtime, and a write here tells Realtime about
 * itself with one plain HTTP request. So a tick on one phone reaches the other in a few
 * hundred milliseconds rather than whenever the next poll happened to fall.
 *
 * **What is sent is a nudge and nothing else** — the list's id, never its rows. A phone
 * that hears one asks `/api/lists/<id>/version` exactly as its timer would, and redraws
 * only if the fingerprint moved. So the page is still drawn by the one query that draws
 * it, nothing of the household's shopping passes through Supabase, and a nudge that is
 * lost, doubled or spoofed costs at most one question the poll would have asked anyway.
 *
 * **Channels are private, one per home** (`home:<homeId>`). A phone joins with a token
 * signed here (`realtimeToken`) naming the homes its owner belongs to, and one RLS policy
 * on `realtime.messages` lets it read a topic only if that topic is one of them — see the
 * `realtime_home_channels` migration. Nothing lets a phone *send*: there is no insert
 * policy, and only this server, holding the secret key, broadcasts.
 *
 * All four settings or none. Without them — a laptop, the test suites, a deploy nobody
 * has configured — nothing is sent, no token is issued, and an open list polls at its
 * old pace, which is the behaviour this whole module is an improvement on rather than a
 * replacement for.
 */
export type RealtimeConfig = {
  /** `https://<ref>.supabase.co`. */
  url: string;
  /** The publishable (anon) key: safe in a browser, and all a phone's socket needs. */
  publishableKey: string;
  /** The secret (service role) key: the right to broadcast. Never leaves the server. */
  secretKey: string;
  /** The project's JWT secret (HS256), which Realtime checks a phone's token against. */
  jwtSecret: string;
};

export function realtimeConfig(
  env: Record<string, string | undefined> = process.env,
): RealtimeConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  const jwtSecret = env.SUPABASE_JWT_SECRET?.trim();
  if (!url || !publishableKey || !secretKey || !jwtSecret) return null;
  return { url, publishableKey, secretKey, jwtSecret };
}

/**
 * How long a phone's token lasts. Short, because Realtime keeps delivering to a socket
 * until its token expires: somebody removed from a home goes on hearing *that a list
 * changed* — never what — for at most this long. The phone asks for a fresh one well
 * before it runs out (`useListSignal`).
 */
export const TOKEN_TTL_SECONDS = 15 * 60;

/**
 * A token Realtime accepts for a private channel: HS256 over the project's JWT secret,
 * with the claims Supabase's own sessions carry (`role`, `aud`, `sub`) plus `homes`,
 * which is what the RLS policy reads.
 *
 * `homes` is every home the person belongs to rather than the one on screen, because
 * that is what they may reach — the same answer `canAccessHome` gives from `user.homes`.
 */
export function realtimeToken(
  config: RealtimeConfig,
  userId: string,
  homeIds: string[],
  now: Date = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
    homes: homeIds,
  };
  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  return { token: `${body}.${signature}`, expiresAt };
}

function base64url(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

/**
 * Past this a broadcast is given up on. It runs after the response has gone (`after`),
 * so nobody waits on it — this only stops a Realtime that has stopped answering from
 * holding a function open.
 */
export const BROADCAST_TIMEOUT_MS = 3000;

/**
 * Tells every open copy of these lists that they changed.
 *
 * One request for any number of lists, through Realtime's batch endpoint. It never
 * throws: a broadcast that fails is a phone that finds out at its next fallback poll,
 * which is exactly what happened before any of this existed, and not a reason to fail
 * the write that has already been made.
 */
export async function broadcastListsChanged(
  config: RealtimeConfig,
  homeId: string,
  listIds: string[],
): Promise<void> {
  if (listIds.length === 0) return;
  try {
    const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: config.secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: listIds.map((listId) => ({
          topic: homeTopic(homeId),
          event: LIST_CHANGED,
          payload: { listId } satisfies ListChanged,
          private: true,
        })),
      }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({ event: "realtime_broadcast_failed", status: response.status, homeId }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "realtime_broadcast_failed",
        error: error instanceof Error ? error.message : String(error),
        homeId,
      }),
    );
  }
}

/**
 * What a write calls once it has changed a list: announces it after the response has
 * been sent, so the person who pressed never waits on Supabase.
 *
 * Called beside every `revalidatePath` of a list's own page — the same moments the
 * page's own copy is thrown away are the moments every other copy is out of date too.
 * Does nothing at all when Realtime is not configured, which is also what keeps `after`
 * (which needs a request to run after) out of the test suites.
 */
export function announceListsChanged(homeId: string, listIds: Iterable<string>) {
  const config = realtimeConfig();
  if (!config) return;
  const unique = [...new Set(listIds)];
  if (unique.length === 0) return;
  after(() => broadcastListsChanged(config, homeId, unique));
}

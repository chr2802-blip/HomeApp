"use client";

import { LIST_CHANGED, type ListChanged } from "@/lib/realtime-topic";

/**
 * The phone's half of `src/lib/realtime.ts`: joins the home's private Realtime channel
 * and calls `onNudge` whenever a write anywhere in the household announces this list.
 *
 * `onLive` says whether the channel is actually joined, which is what lets
 * `useListFollow` slow its poll down — and speed it back up the moment the socket drops,
 * because a nudge sent while it was down is a nudge nobody heard. Joining (and rejoining
 * after a drop) also nudges once, to catch up on whatever changed meanwhile.
 *
 * Nothing is loaded when the server says Realtime is not configured: the socket library
 * is imported only after `/api/realtime/token` has said there is something to join.
 * Any failure along the way — no answer, a refused token, a socket that never opens —
 * leaves `onLive(false)` standing, and the list polls exactly as it did before this
 * existed. Returns the function that leaves the channel.
 */
export function followListSignal(
  listId: string,
  onNudge: () => void,
  onLive: (live: boolean) => void,
): () => void {
  let stopped = false;
  let leave: (() => void) | null = null;

  void (async () => {
    const first = await fetchToken();
    if (stopped || !first) return;

    const { RealtimeClient } = await import("@supabase/realtime-js");
    if (stopped) return;

    let current = first;
    // A socket address, which the library does not derive from the https one itself —
    // `supabase-js` does that step, and this uses only its Realtime half.
    const client = new RealtimeClient(`${first.url.replace(/^http/i, "ws")}/realtime/v1`, {
      params: { apikey: first.publishableKey },
      // Asked on connect and on every heartbeat. A token is fetched afresh only once
      // it is near its end, so this is one request every ten minutes or so, not every
      // twenty-five seconds.
      accessToken: async () => {
        if (current.expiresAt - Date.now() / 1000 < REFRESH_BEFORE_SECONDS) {
          const next = await fetchToken();
          if (next) current = next;
        }
        return current.token;
      },
    });

    // Before joining, not after: the callback is otherwise still resolving when the join
    // goes out, the join carries no token, and a private channel refuses it.
    await client.setAuth();
    if (stopped) {
      client.disconnect();
      return;
    }

    const channel = client
      .channel(first.topic, { config: { private: true } })
      .on("broadcast", { event: LIST_CHANGED }, (message) => {
        const payload = message.payload as Partial<ListChanged> | undefined;
        if (payload?.listId === listId) onNudge();
      })
      .subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          onLive(true);
          onNudge();
        } else {
          onLive(false);
        }
      });

    leave = () => {
      void client.removeChannel(channel);
      client.disconnect();
    };
    if (stopped) leave();
  })().catch(() => {
    // A socket that cannot be had is the poll's to cover, which it already is.
  });

  return () => {
    stopped = true;
    onLive(false);
    leave?.();
  };
}

/** Fetch a fresh token this long before the current one expires. */
const REFRESH_BEFORE_SECONDS = 5 * 60;

type TokenAnswer = {
  url: string;
  publishableKey: string;
  topic: string;
  token: string;
  /** Seconds since the epoch, as the token's own `exp`. */
  expiresAt: number;
};

async function fetchToken(): Promise<TokenAnswer | null> {
  try {
    const response = await fetch("/api/realtime/token", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { enabled?: boolean } & Partial<TokenAnswer>;
    if (
      !body.enabled ||
      typeof body.url !== "string" ||
      typeof body.publishableKey !== "string" ||
      typeof body.topic !== "string" ||
      typeof body.token !== "string" ||
      typeof body.expiresAt !== "number"
    ) {
      return null;
    }
    return body as TokenAnswer;
  } catch {
    return null;
  }
}

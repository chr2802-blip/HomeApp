"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { followListSignal } from "@/components/list-signal";

/**
 * How often an open list asks whether somebody else has changed it.
 *
 * Two people in one shop is the case this is for: short enough that a tick on one phone
 * has landed on the other before its owner has walked to the same shelf, long enough that
 * an afternoon with a list left open is a few hundred tiny requests rather than thousands.
 */
export const FOLLOW_MS = 3000;

/**
 * How often an open list still asks while its home's Realtime channel is joined.
 *
 * A pushed nudge (`followListSignal`) is what normally brings a change in, within a few
 * hundred milliseconds. Broadcast is at most once, though — a nudge sent while the socket
 * was quietly reconnecting is never heard — so the poll stays on underneath as the safety
 * net, just far less often.
 */
export const LIVE_FOLLOW_MS = 30_000;

/**
 * Keeps an open list up to date with what the rest of the household does to it.
 *
 * Two things ask the same question. A nudge from the home's Realtime channel asks at
 * once (`followListSignal`, `src/lib/realtime.ts`); the timer asks every `FOLLOW_MS`, or
 * only every `LIVE_FOLLOW_MS` while the channel is joined. Either way the question and
 * the answer are the ones below, so the push only changes *when* a list finds out, never
 * what it does about it.
 *
 * Every `FOLLOW_MS`, while the page is actually being looked at, it asks
 * `/api/lists/<id>/version` for the list's fingerprint and compares it with the one the
 * page was drawn with. Only a difference costs a `router.refresh()` — the same redraw the
 * page's own actions already ask for — so the rows, the progress bar, the completed count
 * and the add box's suggestions all move together, from the one query that draws them.
 *
 * Nothing is asked of a hidden tab (a phone in a pocket), and nothing while the browser
 * says it is offline: the offline queue owns that stretch, and it flushes and refreshes
 * on the way back. Coming back to the tab asks at once rather than waiting for the timer.
 *
 * A fingerprint that has already been refreshed for is not refreshed for twice. The page
 * and the route compute it from the same function, so they should always agree once the
 * refresh lands — but if they ever came apart, this is what stops a list redrawing itself
 * every three seconds for ever.
 */
export function useListFollow(listId: string, version: string) {
  const router = useRouter();
  const drawn = useRef(version);
  const refreshedFor = useRef<string | null>(null);

  // A new render from the server — this hook's own refresh, or an action's — is the new
  // baseline.
  useEffect(() => {
    drawn.current = version;
    refreshedFor.current = null;
  }, [version]);

  useEffect(() => {
    let asking = false;
    let stopped = false;
    let live = false;
    let lastAsked = 0;
    // A nudge that lands while a question is already out is asked again once that one is
    // back: the answer in flight may have been read before the change it announces.
    let askAgain = false;

    async function ask() {
      if (stopped) return;
      if (asking) {
        askAgain = true;
        return;
      }
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      asking = true;
      lastAsked = Date.now();
      try {
        const response = await fetch(`/api/lists/${listId}/version`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { version?: unknown };
        if (stopped || typeof body.version !== "string") return;
        if (body.version === drawn.current || body.version === refreshedFor.current) return;

        refreshedFor.current = body.version;
        router.refresh();
      } catch {
        // No answer is not news: the next tick asks again, and a real loss of signal is
        // the offline queue's to report, not this.
      } finally {
        asking = false;
        if (askAgain) {
          askAgain = false;
          void ask();
        }
      }
    }

    const timer = setInterval(() => {
      if (live && Date.now() - lastAsked < LIVE_FOLLOW_MS) return;
      void ask();
    }, FOLLOW_MS);
    const leaveSignal = followListSignal(
      listId,
      () => void ask(),
      (joined) => {
        live = joined;
      },
    );
    const cameBack = () => {
      if (document.visibilityState === "visible") void ask();
    };
    document.addEventListener("visibilitychange", cameBack);
    window.addEventListener("online", cameBack);

    return () => {
      stopped = true;
      clearInterval(timer);
      leaveSignal();
      document.removeEventListener("visibilitychange", cameBack);
      window.removeEventListener("online", cameBack);
    };
  }, [listId, router]);
}

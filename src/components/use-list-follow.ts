"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * How often an open list asks whether somebody else has changed it.
 *
 * Two people in one shop is the case this is for: short enough that a tick on one phone
 * has landed on the other before its owner has walked to the same shelf, long enough that
 * an afternoon with a list left open is a few hundred tiny requests rather than thousands.
 */
export const FOLLOW_MS = 3000;

/**
 * Keeps an open list up to date with what the rest of the household does to it.
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

    async function ask() {
      if (asking || stopped) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      asking = true;
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
      }
    }

    const timer = setInterval(ask, FOLLOW_MS);
    const cameBack = () => {
      if (document.visibilityState === "visible") void ask();
    };
    document.addEventListener("visibilitychange", cameBack);
    window.addEventListener("online", cameBack);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", cameBack);
      window.removeEventListener("online", cameBack);
    };
  }, [listId, router]);
}

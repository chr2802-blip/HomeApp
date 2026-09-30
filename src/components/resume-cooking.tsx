"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { findCook, readKitchen } from "@/lib/cook-session";
import { PORTIONS_PARAM } from "@/lib/recipes";

/**
 * Only the first render of a freshly loaded document asks. A module variable rather than
 * a ref, because it has to outlive this component: navigating inside the app is not
 * coming back to it, and the dashboard must not keep pulling somebody into the kitchen.
 */
let asked = false;

/**
 * Puts a cook back in action mode when the phone threw the page away underneath them.
 *
 * An installed app whose page was discarded in the background is relaunched at the
 * manifest's `start_url`, not where it was — so on an iPhone, half an hour in another app
 * mid-dinner came back to the dashboard with the timers gone. The kitchen's `open` stays
 * set only while action mode was never left on purpose (`lib/cook-session.ts`), so
 * finding it set on a fresh load means exactly that happened, and the right answer is the
 * cook page it came from, which restores the page itself — the timers never left, since
 * they belong to the kitchen and not to the screen.
 */
export function ResumeCooking() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (asked) return;
    asked = true;
    // A fresh load that is already cooking something is where the cook meant to be — a
    // second dish opened in its own right, not a relaunch to be corrected.
    if (/^\/recipes\/[^/]+\/cook$/.test(pathname)) return;
    const kitchen = readKitchen();
    const session = kitchen.open ? findCook(kitchen, kitchen.open) : undefined;
    if (!session) return;
    const portions = session.portions !== null ? `?${PORTIONS_PARAM}=${session.portions}` : "";
    router.replace(`/recipes/${session.recipeId}/cook${portions}`);
  }, [pathname, router]);

  return null;
}

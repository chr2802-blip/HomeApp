"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { readCookSession } from "@/lib/cook-session";

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
 * mid-dinner came back to the dashboard with the timers gone. A saved session exists only
 * while action mode was never left on purpose (`lib/cook-session.ts`), so finding one on a
 * fresh load means exactly that happened, and the right answer is the cook page it came
 * from, which restores the page and the timers itself.
 */
export function ResumeCooking() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (asked) return;
    asked = true;
    const session = readCookSession();
    if (!session) return;
    const target = `/recipes/${session.recipeId}/cook`;
    if (pathname !== target) router.replace(target);
  }, [pathname, router]);

  return null;
}

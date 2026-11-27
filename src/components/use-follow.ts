"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Asks the server again every half minute while the page is in view, and the moment it
 * comes back into view: the other parent may have fed the baby meanwhile. The baby log
 * follows always; the dashboard only while one of its tiles is a baby timer. `on` false
 * asks nothing.
 */
export function useFollow(on = true) {
  const router = useRouter();
  useEffect(() => {
    if (!on) return;
    const ask = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(ask, 30_000);
    document.addEventListener("visibilitychange", ask);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [router, on]);
}

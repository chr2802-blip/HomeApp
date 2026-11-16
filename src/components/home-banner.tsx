"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The dashboard's opening: the date, the greeting, the week and the three numbers, on a
 * band of the header's own linen that hangs from the header across the whole screen. It
 * rolls down out of the header when the page opens, and back up into it when a tab leads
 * away (`useLeaveHome`). It is the same content the page always opened with, so it costs
 * the first screen nothing; what changed is that it now reads as part of the frame.
 */
const LEAVE = "homehub:leave-home";
/** How long the banner takes to roll up; navigation waits for it. Matches `banner-up` (`--dur-menu-out`). */
const LEAVE_MS = 120;

export function HomeBanner({ children }: { children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const onLeave = () => setLeaving(true);
    window.addEventListener(LEAVE, onLeave);
    return () => window.removeEventListener(LEAVE, onLeave);
  }, []);
  return (
    <div className="home-banner" data-leaving={leaving || undefined}>
      <div className="mx-auto max-w-5xl pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-5 pl-[max(1rem,env(safe-area-inset-left))]">
        {children}
      </div>
    </div>
  );
}

/**
 * A click handler for the tabs: leaving the dashboard, it rolls the banner up first and
 * then navigates. Anywhere else, with a modifier key, or with reduced motion it does
 * nothing and the link behaves as a link.
 */
export function useLeaveHome(pathname: string) {
  const router = useRouter();
  return (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname !== "/dashboard" || href === "/dashboard") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!document.querySelector(".home-banner")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    router.prefetch(href);
    window.dispatchEvent(new Event(LEAVE));
    window.setTimeout(() => router.push(href), LEAVE_MS);
  };
}

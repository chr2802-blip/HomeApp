"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isInTab, navItemsFor } from "./nav-items";
import { usePendingHref } from "./use-pending-href";
import { useLanguage } from "./language-provider";
import { useLeaveHome } from "./home-banner";
import { PageLeaving, motionBetween } from "./page-transition";

/** Desktop navigation. On mobile the same destinations live in `BottomNav`. */
export function NavLinks() {
  const pathname = usePathname();
  const language = useLanguage();
  const { pending, pressed } = usePendingHref();
  const leaveHome = useLeaveHome(pathname);

  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {navItemsFor(language).map((item) => {
        const active = isInTab(item, pathname);
        // One lit at a time, and it moves on the tap: see `usePendingHref`.
        const lit = pending ? pending === item.href : active;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={(event) => {
              leaveHome(event, item.href);
              // Held back while the banner rolls up, so the tab lights here instead.
              if (event.defaultPrevented) pressed(item.href);
            }}
            onNavigate={() => pressed(item.href)}
            aria-current={active ? "page" : undefined}
            className="press-button rounded-lg"
          >
            <span
              className={`block rounded-lg px-3 py-1.5 transition-colors duration-(--dur-quick) ${
                lit ? "bg-[var(--accent)] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </span>
            <PageLeaving motion={motionBetween(pathname, item.href)} />
          </Link>
        );
      })}
    </nav>
  );
}

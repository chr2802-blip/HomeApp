"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemsFor } from "./nav-items";
import { LinkPending } from "./link-pending";

export function BottomNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const items = navItemsFor(showAdmin);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--accent-line)] bg-[var(--band)] md:hidden">
      {/* The tabs sit above the phone's gesture bar and the band behind them runs on
          underneath it: the page is laid out to the bottom edge of the screen, so this
          padding is the only thing keeping the row off the bar, and the strip it leaves
          is what makes the phone's own bottom bar the app's colour rather than the
          manifest's. */}
      <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="pressable group flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 active:scale-90"
              >
                <LinkPending>
                  {(pending) => {
                    // Light up as soon as the tap registers, not when the page arrives.
                    const lit = active || pending;
                    return (
                      <>
                        {/* The pill grows as it lights up, so the tab that was just
                            pressed is the thing that moved on the screen. The property
                            being eased is `scale`, not `transform`: that is what
                            Tailwind's scale-* writes, and naming the other one leaves
                            the pill snapping to size. */}
                        <span
                          className={`flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,color,scale] duration-200 ease-out ${
                            lit
                              ? "scale-110 bg-[var(--accent)] text-white"
                              : "scale-100 text-slate-400"
                          } ${pending && !active ? "animate-pulse" : ""}`}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span
                          className={`text-[11px] leading-none font-medium transition-colors duration-150 ${
                            lit ? "text-[var(--accent-text)]" : "text-slate-400"
                          }`}
                        >
                          {item.label}
                        </span>
                      </>
                    );
                  }}
                </LinkPending>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

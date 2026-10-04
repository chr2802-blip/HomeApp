"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { useLanguage } from "./language-provider";
import { usePendingHref } from "./use-pending-href";

/**
 * The pages inside one tab. A tab is an area of the household's life, and these are
 * its pages, a sideways step apart. Drawn only on a segment's own top-level page — a
 * recipe or an open list is somewhere you went *into*, and the back arrow takes you out.
 */
export const SECTIONS: { href: string; key: keyof typeof APP.sections }[][] = [
  [
    { href: "/recipes", key: "recipes" },
    { href: "/meals", key: "meals" },
  ],
  [
    { href: "/lists", key: "lists" },
    { href: "/pantry", key: "supplies" },
  ],
];

/**
 * Which way a move between two pages of one section goes: `1` to a segment further
 * right, `-1` to one further left, `null` when the two are not segments of one section.
 * `PageTransition` slides the arriving page in from that side, so the content moves the
 * way the pill does rather than rising like a change of tab.
 */
export function sectionStep(from: string, to: string): 1 | -1 | null {
  for (const section of SECTIONS) {
    const a = section.findIndex((seg) => seg.href === from);
    const b = section.findIndex((seg) => seg.href === to);
    if (a !== -1 && b !== -1 && a !== b) return b > a ? 1 : -1;
  }
  return null;
}

/**
 * One pill, sliding under the segments rather than one per segment changing colour, so
 * the eye follows it across. It moves on the press (`usePendingHref`), not when the page
 * lands: the page behind it can take half a second, and a control that waits for the
 * server reads as one that did not hear the tap. It is drawn only on a segment's own page
 * and stays mounted between them, which is what lets it slide at all.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const say = sayIn(useLanguage());
  const { pending, pressed } = usePendingHref();
  const section = SECTIONS.find((s) => s.some((seg) => seg.href === pathname));
  if (!section) return null;

  const shown = pending ?? pathname;
  const at = Math.max(0, section.findIndex((seg) => seg.href === shown));

  return (
    <nav className="relative -mt-4 mb-5 flex rounded-full bg-slate-200/70 p-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-full bg-[var(--accent)] shadow-sm transition-[translate] duration-(--dur-base) ease-(--ease-arrive)"
        style={{
          width: `calc((100% - 0.5rem) / ${section.length})`,
          translate: `${at * 100}% 0`,
        }}
      />
      {section.map((seg, index) => {
        const active = seg.href === pathname;
        return (
          <Link
            key={seg.href}
            href={seg.href}
            prefetch
            replace
            onNavigate={() => pressed(seg.href)}
            aria-current={active ? "page" : undefined}
            className={`press-button relative flex-1 rounded-full py-2 text-center text-sm font-semibold ${
              index === at ? "text-white" : "text-slate-500"
            }`}
          >
            {say(APP.sections[seg.key])}
          </Link>
        );
      })}
    </nav>
  );
}

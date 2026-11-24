import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { TAB_KEYS, TAB_PATHS_BY_KEY, pathInTab, type TabKey } from "@/lib/nav-tabs";

export type NavItem = {
  key: TabKey;
  href: string;
  /** Other paths that belong to this tab — its other segments. */
  also?: string[];
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Each tab's icon — the label depends on the language, so it is filled in by
 * `navItemsFor` rather than written here. Kept as a `Record` rather than an array so
 * `APP.nav` and this list cannot drift about which destinations there are.
 */
const NAV_ICONS: Record<TabKey, { icon: NavItem["icon"] }> = {
  dashboard: {
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
      </svg>
    ),
  },
  food: {
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M7 3.5v8M10 3.5v8M8.5 11.5V21M7 3.5a1.5 1.5 0 0 0-1.5 1.5v3A2.5 2.5 0 0 0 8 10.5h1" />
        <path d="M17.5 3.5c-1.7 0-2.5 2.2-2.5 5s.8 4 2.5 4H18V21" />
      </svg>
    ),
  },
  lists: {
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="m3 6 1.6 1.6L7.5 4.7" />
        <path d="m3 13 1.6 1.6 2.9-2.9" />
        <path d="m3 20 1.6 1.6 2.9-2.9" />
        <path d="M11 6.5h10M11 13.5h10M11 20.5h10" />
      </svg>
    ),
  },
  tasks: {
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        <path d="M21 4v5h-5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  baby: {
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <circle cx="12" cy="13" r="7.5" />
        <path d="M9.5 12.5h.01M14.5 12.5h.01M10 16c1.2.8 2.8.8 4 0M12 5.5c0-1.4.9-2.5 2.2-2.5" />
      </svg>
    ),
  },
};

/** The menu's own place in the tab bar: three lines, the way every phone says "more". */
export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/**
 * Every tab, in `TAB_KEYS`' order. Admin is not among them: it is the installation rather
 * than a household, so it is reached from the menu under the home's name, where Settings
 * and Profile already are (`HomeMenu`). Which of these sit in the phone's tab bar is the
 * person's own choice (`readPins`); the desktop header draws them all.
 */
export function navItemsFor(language: HomeLanguage): NavItem[] {
  const say = sayIn(language);
  return TAB_KEYS.map((key) => ({ key, ...TAB_PATHS_BY_KEY[key], ...NAV_ICONS[key], label: say(APP.nav[key]) }));
}

/** Whether `pathname` is inside this tab — its own page or any of its segments. */
export function isInTab(item: NavItem, pathname: string): boolean {
  return pathInTab(item.key, pathname);
}

/**
 * The tabs in a fixed order, for which way a page comes in (`pageMotion`). The menu's
 * order rather than the bar's: the bar is each person's own, and a page sliding in from
 * a different side for each member of the household would be motion meaning nothing.
 */
export const TAB_PATHS: string[][] = TAB_KEYS.map((key) => [
  TAB_PATHS_BY_KEY[key].href,
  ...(TAB_PATHS_BY_KEY[key].also ?? []),
]);

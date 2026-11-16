import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

export type NavItem = {
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
 * Every tab but its label — the label depends on the language, so it is filled in by
 * `navItemsFor` rather than written here. Kept as a `Record` rather than an array so
 * `APP.nav` and this list cannot drift about which destinations there are.
 */
const NAV_ICONS: Record<keyof typeof APP.nav, { href: string; also?: string[]; icon: NavItem["icon"] }> = {
  dashboard: {
    href: "/dashboard",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
      </svg>
    ),
  },
  food: {
    href: "/recipes",
    also: ["/meals"],
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M7 3.5v8M10 3.5v8M8.5 11.5V21M7 3.5a1.5 1.5 0 0 0-1.5 1.5v3A2.5 2.5 0 0 0 8 10.5h1" />
        <path d="M17.5 3.5c-1.7 0-2.5 2.2-2.5 5s.8 4 2.5 4H18V21" />
      </svg>
    ),
  },
  lists: {
    href: "/lists",
    also: ["/pantry"],
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
    href: "/tasks",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        <path d="M21 4v5h-5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
};

/**
 * The tabs, every one drawn for everybody. Admin is not among them: it is the installation
 * rather than a household, so it is reached from the menu under the home's name, where
 * Settings and Profile already are (`HomeMenu`).
 */
export function navItemsFor(language: HomeLanguage): NavItem[] {
  const say = sayIn(language);
  const keys: (keyof typeof APP.nav)[] = ["dashboard", "food", "lists", "tasks"];
  return keys.map((key) => ({ ...NAV_ICONS[key], label: say(APP.nav[key]) }));
}

/** Whether `pathname` is inside this tab — its own page or any of its segments. */
export function isInTab(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/** The tabs in the order they sit in the tab bar, for which way a page comes in (`pageMotion`). */
export const TAB_PATHS: string[][] = (["dashboard", "food", "lists", "tasks"] as const).map((key) => [
  NAV_ICONS[key].href,
  ...(NAV_ICONS[key].also ?? []),
]);

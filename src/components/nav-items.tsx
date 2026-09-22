import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

export type NavItem = {
  href: string;
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
const NAV_ICONS: Record<keyof typeof APP.nav, { href: string; icon: NavItem["icon"] }> = {
  dashboard: {
    href: "/dashboard",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
      </svg>
    ),
  },
  lists: {
    href: "/lists",
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
  meals: {
    href: "/meals",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
        <path d="M3 9h18M8 4.5v-2M16 4.5v-2" />
        <path d="M8.5 13h3M8.5 16h7" />
      </svg>
    ),
  },
  recipes: {
    href: "/recipes",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <path d="M7 3.5v8M10 3.5v8M8.5 11.5V21M7 3.5a1.5 1.5 0 0 0-1.5 1.5v3A2.5 2.5 0 0 0 8 10.5h1" />
        <path d="M17.5 3.5c-1.7 0-2.5 2.2-2.5 5s.8 4 2.5 4H18V21" />
      </svg>
    ),
  },
  admin: {
    href: "/admin",
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
      </svg>
    ),
  },
};

/**
 * Admin is a tab only for the super admin, because what is behind it is the
 * installation: every home on it, and how the deployment itself is doing. Running a
 * single household is not here — it is that household's Settings, behind its name in
 * the header, where the person who runs it already looks.
 *
 * It is passed as a yes or no rather than as a role, so the tabs stay a list of
 * destinations and the question of who may see one is answered where the session is.
 */
export function navItemsFor(showAdmin: boolean, language: HomeLanguage): NavItem[] {
  const say = sayIn(language);
  const keys: (keyof typeof APP.nav)[] = showAdmin
    ? ["dashboard", "lists", "tasks", "meals", "recipes", "admin"]
    : ["dashboard", "lists", "tasks", "meals", "recipes"];

  return keys.map((key) => ({ ...NAV_ICONS[key], label: say(APP.nav[key]) }));
}

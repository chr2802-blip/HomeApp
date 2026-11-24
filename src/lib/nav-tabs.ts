/**
 * The app's tabs, and which two of them a person keeps in the tab bar.
 *
 * The bar is Home · pin · "+" · pin · Menu. Home and the "+" are always there; the two
 * places between are the person's own (`User.navPins`), and Menu opens every tab, pinned
 * or not. Plain data with no JSX, so the rules are unit-tested and the icons stay in
 * `src/components/nav-items.tsx`.
 */

/** Every tab, in the order the menu and the desktop header list them. */
export const TAB_KEYS = ["dashboard", "food", "lists", "tasks", "baby"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

/** Where each tab lives: its own page, and the other pages that belong to it. */
export const TAB_PATHS_BY_KEY: Record<TabKey, { href: string; also?: string[] }> = {
  dashboard: { href: "/dashboard" },
  food: { href: "/recipes", also: ["/meals"] },
  lists: { href: "/lists", also: ["/pantry"] },
  tasks: { href: "/tasks" },
  baby: { href: "/baby", also: ["/baby/charts"] },
};

/** The tabs a person may put in the bar. Home is not one of them: it is always there. */
export const PINNABLE_TABS = ["food", "lists", "tasks", "baby"] as const satisfies readonly TabKey[];
export type PinnableTab = (typeof PINNABLE_TABS)[number];

/** How many places the bar has for a person's own choice. */
export const PIN_SLOTS = 2;

/** What somebody who never chose gets — the two tabs a household opens most. */
export const DEFAULT_PINS: readonly PinnableTab[] = ["food", "lists"];

/** The form field the pins arrive in, once per pin, in order. */
export const PIN_FIELD = "pin";

function isPinnable(value: unknown): value is PinnableTab {
  return typeof value === "string" && (PINNABLE_TABS as readonly string[]).includes(value);
}

/**
 * The pins as stored, made into exactly `PIN_SLOTS` distinct tabs: anything unknown or
 * repeated is dropped, and a short list is filled from the defaults. So an account that
 * never chose, and one holding a tab the app no longer has, both read sensibly.
 */
export function readPins(stored: readonly unknown[] | null | undefined): PinnableTab[] {
  const pins: PinnableTab[] = [];
  for (const value of stored ?? []) {
    if (pins.length === PIN_SLOTS) break;
    if (isPinnable(value) && !pins.includes(value)) pins.push(value);
  }
  for (const fallback of [...DEFAULT_PINS, ...PINNABLE_TABS]) {
    if (pins.length === PIN_SLOTS) break;
    if (!pins.includes(fallback)) pins.push(fallback);
  }
  return pins;
}

/**
 * `tab` put in the bar in place of `replacing`. A tab already pinned, or a `replacing`
 * that is not pinned, leaves the pins as they were.
 */
export function pinInPlaceOf(pins: readonly PinnableTab[], tab: PinnableTab, replacing: PinnableTab): PinnableTab[] {
  if (pins.includes(tab) || !pins.includes(replacing)) return [...pins];
  return pins.map((pin) => (pin === replacing ? tab : pin));
}

/** The two places swapped — the only reordering two places have. */
export function swapPins(pins: readonly PinnableTab[]): PinnableTab[] {
  return [...pins].reverse();
}

/**
 * `dragged` let go on `target`, the way the tab-bar drawer drags: an unpinned tab dropped
 * on a pinned one takes its place (and the one that was there drops out of the bar), two
 * pinned tabs dropped on each other swap, and a pinned tab dropped on an unpinned one
 * trades places with it. Anything else leaves the pins as they were.
 */
export function dropPin(pins: readonly PinnableTab[], dragged: PinnableTab, target: PinnableTab): PinnableTab[] {
  if (dragged === target) return [...pins];
  const from = pins.indexOf(dragged);
  const to = pins.indexOf(target);
  if (from >= 0 && to >= 0) return swapPins(pins);
  if (to >= 0) return pinInPlaceOf(pins, dragged, target);
  if (from >= 0) return pinInPlaceOf(pins, target, dragged);
  return [...pins];
}

/** Whether `pathname` is inside a tab — its own page or any page belonging to it. */
export function pathInTab(key: TabKey, pathname: string): boolean {
  const { href, also = [] } = TAB_PATHS_BY_KEY[key];
  return [href, ...also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/** The tab a path belongs to, or null for a page outside every tab (Settings, Profile…). */
export function tabOf(pathname: string): TabKey | null {
  return TAB_KEYS.find((key) => pathInTab(key, pathname)) ?? null;
}

/**
 * Which place in the bar is lit for this path: Home, one of the pins, or — for a tab not
 * in the bar and for every page outside the tabs — the menu, because that is where the
 * page is reached from.
 */
export function litPlace(pathname: string, pins: readonly PinnableTab[]): TabKey | "menu" {
  const tab = tabOf(pathname);
  if (tab === "dashboard") return "dashboard";
  if (tab && (pins as readonly string[]).includes(tab)) return tab;
  return "menu";
}

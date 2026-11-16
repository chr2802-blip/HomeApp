/**
 * Which way a page comes in when the address changes, worked out from the two paths alone
 * so a page reached by a card, a bookmark or the back arrow arrives the same way.
 *
 * The tabs sit side by side in the tab bar, so going to a tab further right brings its
 * page in from the right (`forward`) and one further left from the left (`backward`). The
 * pages of one section (Recipes | Plan) are a sideways step too, in from the side the
 * pill moved to. Inside a tab, a page deeper down opens out of the one before it (`open`)
 * and going back up closes it (`close`). Pages outside the tabs (Settings, Profile, the
 * list of homes) open over wherever one was, and close back into a tab.
 */
export type PageMotion = "forward" | "backward" | "open" | "close";

/** A tab is the paths that belong to it, its own first. */
export type TabPaths = readonly (readonly string[])[];

function within(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function tabOf(pathname: string, tabs: TabPaths) {
  return tabs.findIndex((paths) => paths.some((path) => within(pathname, path)));
}

function depth(pathname: string) {
  return pathname.split("/").filter(Boolean).length;
}

/**
 * `sections` are the rows of segments (`SECTIONS` in `section-tabs.tsx`): two top-level
 * pages of one section are a sideways step, not one inside the other.
 */
export function pageMotion(
  from: string,
  to: string,
  tabs: TabPaths,
  sections: TabPaths = [],
): PageMotion | null {
  if (from === to) return null;
  for (const section of sections) {
    const a = section.indexOf(from);
    const b = section.indexOf(to);
    if (a !== -1 && b !== -1) return b > a ? "forward" : "backward";
  }
  const a = tabOf(from, tabs);
  const b = tabOf(to, tabs);
  if (b < 0) return a < 0 && depth(to) < depth(from) ? "close" : "open";
  if (a < 0) return "close";
  if (a !== b) return b > a ? "forward" : "backward";
  const down = depth(to) - depth(from);
  if (down === 0) return null;
  return down > 0 ? "open" : "close";
}

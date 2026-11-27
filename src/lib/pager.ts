/**
 * The pages of a section drawn side by side on one address (`SwipePager`): which one is on
 * screen is `?tab=`, absent for the first. Plain functions so the page, the pill and the
 * pager read the address the same way.
 */
export const PAGER_PARAM = "tab";

/** The `?tab=` a page's href names, or null for the first page (no `tab`). */
export function tabOf(href: string): string | null {
  const query = href.indexOf("?");
  return query < 0 ? null : new URLSearchParams(href.slice(query + 1)).get(PAGER_PARAM);
}

/** Which of `hrefs` the address's `tab` is on; anything unknown is the first. */
export function pagerIndex(hrefs: readonly string[], tab: string | null): number {
  const at = hrefs.findIndex((href) => tabOf(href) === tab);
  return at < 0 ? 0 : at;
}

/** The address with its `tab` turned to `href`'s, everything else in it kept. */
export function pagerUrl(current: string, href: string): string {
  const url = new URL(current);
  const tab = tabOf(href);
  if (tab) url.searchParams.set(PAGER_PARAM, tab);
  else url.searchParams.delete(PAGER_PARAM);
  return `${url.pathname}${url.search}`;
}

/** The address a pager page is reached at: its path with the address's `tab`. */
export function pagerAddress(pathname: string, tab: string | null): string {
  return tab ? `${pathname}?${PAGER_PARAM}=${tab}` : pathname;
}

import { SETTINGS_PATHS } from "./settings-tabs";
import { TAB_PATHS_BY_KEY } from "./nav-tabs";

/**
 * Top-level destinations — these are the tabs and their segments, so there is nothing to
 * go back to. Read from the tabs themselves, so a new tab has no arrow without being
 * listed twice.
 */
const ROOTS = new Set(Object.values(TAB_PATHS_BY_KEY).flatMap(({ href, also = [] }) => [href, ...also]));

/**
 * Where the header's back arrow leads when there is no page of the app behind this one to
 * step back to (opened from a push, a shared link or a fresh start of the installed app):
 * one segment up the URL, so the target is the same however the page was reached. `null`
 * on a tab's own page, which has no arrow.
 */
export function backHref(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (ROOTS.has(path)) return null;
  // Settings' tabs are side by side, not one inside another: each leads out of Settings.
  if (SETTINGS_PATHS.includes(path)) return "/dashboard";
  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return segments.length ? `/${segments.join("/")}` : "/dashboard";
}

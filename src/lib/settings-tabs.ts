/**
 * The pages of `/settings`, in the order their pill draws them. A household's settings
 * grew past one screen, so they are tabs a sideways step apart — the same `SectionTabs`
 * the recipes and the lists use, each its own address, so a reload or a link lands on the
 * tab asked for.
 *
 * Plain `.ts` rather than inside `section-tabs.tsx` because `backHref` reads it too: every
 * tab of Settings is the same depth of "somewhere outside the tabs", and the back arrow on
 * `/settings/members` leads out of Settings rather than to the first tab.
 */
export const SETTINGS_TABS = [
  { href: "/settings", key: "home" },
  { href: "/settings/members", key: "members" },
  { href: "/settings/categories", key: "categories" },
  { href: "/settings/done", key: "done" },
  { href: "/settings/status", key: "status" },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export const SETTINGS_PATHS: readonly string[] = SETTINGS_TABS.map((tab) => tab.href);

"use client";

import { createContext, useContext } from "react";
import type { HomeLanguage } from "@prisma/client";
import { DEFAULT_LANGUAGE } from "@/lib/language";

/**
 * Which language the household on screen reads, for the half of the app the server
 * cannot reach.
 *
 * The code and not the catalogue. A catalogue in the tree would be the same strings
 * twice — once in the chunk the component already imports, once serialised into the
 * RSC payload of every navigation — and the copy would be shipped again each time
 * somebody moved between two pages that say the same things.
 *
 * `DEFAULT_LANGUAGE` outside the provider rather than a throw: `/login`, an invite and
 * `global-error` are all real screens with real client components on them, and a crash
 * is a worse answer there than English. The same choice `homeTheme` already makes with
 * `DEFAULT_THEME`.
 */
const Language = createContext<HomeLanguage>(DEFAULT_LANGUAGE);

export function LanguageProvider({
  language,
  children,
}: {
  language: HomeLanguage;
  children: React.ReactNode;
}) {
  return <Language.Provider value={language}>{children}</Language.Provider>;
}

/**
 * The bare language code, to hand to `sayIn` — `const say = sayIn(useLanguage())` —
 * exactly as a server component writes `sayIn(user.homeLanguage)`. There is
 * deliberately no `useSay()` beside it: that would be a second name for the same call,
 * and half the client components that read this need the bare code anyway to pass to a
 * `src/lib` function that takes a language rather than a `Say`.
 */
export function useLanguage(): HomeLanguage {
  return useContext(Language);
}

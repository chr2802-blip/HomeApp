import type { Phrase } from "./say";

/** The Home card on `/settings` — the household's own name, picture, colour and language. */
export const SETTINGS = {
  title: { EN: "Settings", DA: "Indstillinger" },
  managing: { EN: "Managing {home}", DA: "Administrerer {home}" },
  homeHeading: { EN: "Home", DA: "Hjem" },
  saveHome: { EN: "Save home", DA: "Gem hjem" },
  homeName: { EN: "Home name", DA: "Hjemmets navn" },
  address: { EN: "Address (optional)", DA: "Adresse (valgfrit)" },
  homePicture: { EN: "Home picture", DA: "Hjemmets billede" },
  homePictureHint: {
    EN: "Shown beside the home's name and across the top of the dashboard.",
    DA: "Vises ved siden af hjemmets navn og øverst på oversigten.",
  },
  homeNameRequired: { EN: "Give the home a name.", DA: "Giv hjemmet et navn." },

  language: {
    legend: { EN: "Language", DA: "Sprog" },
    hint: {
      EN: "What is already written down stays as it was written — a recipe, a list, a task. This is the language of what happens next: the app itself, and anything imported from here on.",
      DA: "Det, der allerede er skrevet, forbliver som det blev skrevet — en opskrift, en liste, en opgave. Dette er sproget for det, der sker herfra: selve app'en, og alt, der importeres fra nu af.",
    },
    invalid: { EN: "Pick one of the languages offered.", DA: "Vælg et af de tilbudte sprog." },
  },
} as const satisfies Record<string, Phrase | Record<string, Phrase>>;

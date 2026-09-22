import type { Phrase } from "./say";

/** The new-recipe dialog and the link importer — the two steps before there is a form. */
export const RECIPES = {
  newRecipe: { EN: "New recipe", DA: "Ny opskrift" },
  importFromLink: { EN: "Import from a link", DA: "Importer fra et link" },
  chooseHint: {
    EN: "Type it in yourself, or pull the title, ingredients and instructions from a link.",
    DA: "Skriv den selv, eller hent titel, ingredienser og fremgangsmåde fra et link.",
  },
  startFromScratch: { EN: "Start from scratch", DA: "Start forfra" },
  startFromScratchInstead: { EN: "Start from scratch instead", DA: "Start forfra i stedet" },
  cancel: { EN: "Cancel", DA: "Annuller" },
  back: { EN: "Back", DA: "Tilbage" },
  saveRecipe: { EN: "Save recipe", DA: "Gem opskrift" },
  worthChecking: { EN: "Worth checking: {note}", DA: "Værd at tjekke: {note}" },

  recipeLink: { EN: "Recipe link", DA: "Opskriftslink" },
  fetch: { EN: "Fetch", DA: "Hent" },
  fetching: { EN: "Fetching…", DA: "Henter…" },
  linkHint: {
    EN: "A recipe page, or a reel from Instagram, Facebook or TikTok. Its title, ingredients, instructions, picture and time open in the usual form, tidied up and ready to check over before saving.",
    DA: "En opskriftsside, eller en reel fra Instagram, Facebook eller TikTok. Titel, ingredienser, fremgangsmåde, billede og tid åbner i den sædvanlige formular, ryddet op og klar til at tjekke igennem, før den gemmes.",
  },
  reading: { EN: "Reading the recipe…", DA: "Læser opskriften…" },
  readingHint: {
    EN: "The AI is writing it up — this can take up to 20 seconds.",
    DA: "AI'en skriver den ind — det kan tage op til 20 sekunder.",
  },
  pasteLinkFirst: { EN: "Paste a link to a recipe first.", DA: "Indsæt først et link til en opskrift." },
  pasteCaptionFirst: {
    EN: "Paste the reel's description first.",
    DA: "Indsæt først reelens beskrivelse.",
  },

  /** `src/lib/recipe-import.ts`'s error sentences — what to try next, not just what failed. */
  genericError: {
    EN: "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.",
    DA: "Kunne ikke læse en opskrift fra den side. Tjek linket, eller udfyld formularen selv.",
  },
  notAWebAddress: { EN: "That doesn't look like a web address.", DA: "Det ligner ikke en webadresse." },
  couldNotReach: {
    EN: "Couldn't reach that page. Check the link and try again.",
    DA: "Kunne ikke nå den side. Tjek linket og prøv igen.",
  },
  captionUnreachable: {
    EN: "Couldn't read that reel's description — Instagram and Facebook often refuse. Paste it in below instead.",
    DA: "Kunne ikke læse reelens beskrivelse — Instagram og Facebook nægter ofte. Indsæt den nedenfor i stedet.",
  },
  captionNotARecipe: {
    EN: "Couldn't find a recipe in that description. Paste the whole thing in below, or fill the form in by hand.",
    DA: "Kunne ikke finde en opskrift i den beskrivelse. Indsæt det hele nedenfor, eller udfyld formularen selv.",
  },
  readerUnavailable: {
    EN: "Couldn't read that recipe just now. Try again in a moment, paste the description below, or fill the form in by hand.",
    DA: "Kunne ikke læse den opskrift lige nu. Prøv igen om lidt, indsæt beskrivelsen nedenfor, eller udfyld formularen selv.",
  },
  rateLimited: {
    EN: "That's a lot of imports at once. Try again in {minutes} min, or fill the form in by hand.",
    DA: "Det er mange importer på én gang. Prøv igen om {minutes} min, eller udfyld formularen selv.",
  },
} as const satisfies Record<string, Phrase>;

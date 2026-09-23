import type { Phrase } from "./say";

/**
 * What a picture says on its way in — the field every form with a picture draws, the
 * browser shrinking it, and the server measuring what arrived. Kept together because
 * one failed upload can be refused by any of the three, and a household reading two of
 * them in two languages is reading one sentence badly.
 */
export const PHOTOS = {
  label: { EN: "Photo", DA: "Billede" },
  hint: {
    EN: "Straight off your phone is fine — it is shrunk before it leaves the browser.",
    DA: "Direkte fra telefonen er fint — det bliver gjort mindre, før det forlader browseren.",
  },
  add: { EN: "Add a picture", DA: "Tilføj et billede" },
  change: { EN: "Change picture", DA: "Skift billede" },
  remove: { EN: "Remove", DA: "Fjern" },
  chosenAlt: { EN: "The picture you chose", DA: "Billedet du valgte" },
  uploading: { EN: "Shrinking and uploading…", DA: "Gør det mindre og sender det…" },
  couldNotSave: { EN: "That picture could not be saved.", DA: "Billedet kunne ikke gemmes." },
  couldNotUpload: { EN: "That picture could not be uploaded.", DA: "Billedet kunne ikke sendes." },

  // In the browser, while the picture is decoded and redrawn (`lib/downscale.ts`).
  notAnImage: { EN: "That file is not an image.", DA: "Den fil er ikke et billede." },
  tooLargeToRead: { EN: "That image is too large to read.", DA: "Billedet er for stort til at blive læst." },
  unreadableTryJpeg: {
    EN: "That image could not be read — try a JPEG or a PNG.",
    DA: "Billedet kunne ikke læses — prøv en JPEG eller en PNG.",
  },
  unreadable: { EN: "That image could not be read.", DA: "Billedet kunne ikke læses." },
  cannotResize: { EN: "This browser cannot resize images.", DA: "Denne browser kan ikke skalere billeder." },
  couldNotResize: {
    EN: "This browser could not resize that image.",
    DA: "Denne browser kunne ikke skalere billedet.",
  },

  // On the server, measuring what arrived (`lib/photo-file.ts`, `api/photos`).
  empty: { EN: "That image is empty.", DA: "Billedet er tomt." },
  tooLargeToStore: {
    EN: "That image is too large to store — try a smaller one.",
    DA: "Billedet er for stort til at gemme — prøv et mindre.",
  },
  wrongFormat: {
    EN: "That file is not a JPEG, PNG or WebP image.",
    DA: "Filen er hverken et JPEG-, PNG- eller WebP-billede.",
  },
  tooManyPixels: {
    EN: "That image is larger than this app stores — scale it down first.",
    DA: "Billedet er større end appen gemmer — gør det mindre først.",
  },
  noLongerAvailable: {
    EN: "That picture is no longer available — add it again.",
    DA: "Billedet findes ikke længere — tilføj det igen.",
  },
  signInFirst: { EN: "Sign in to add a picture.", DA: "Log ind for at tilføje et billede." },
  uploadUnreadable: { EN: "That upload could not be read.", DA: "Det sendte kunne ikke læses." },
  uploadWithoutImage: {
    EN: "That upload did not include an image.",
    DA: "Der var intet billede med i det sendte.",
  },
} as const satisfies Record<string, Phrase>;

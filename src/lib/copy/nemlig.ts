import type { Phrase, Plural } from "./say";
import type { NemligFailure } from "../nemlig";

/** "Send to Nemlig" on a list, and the Nemlig card on `/settings`. */
export const NEMLIG = {
  send: { EN: "Send to Nemlig", DA: "Send til Nemlig" },
  /** Beside the basket icon on the list's page. */
  short: { EN: "Nemlig", DA: "Nemlig" },

  searching: { EN: "Finding your items on Nemlig…", DA: "Finder jeres varer hos Nemlig…" },
  nothingOpen: {
    EN: "There is nothing left on this list to buy.",
    DA: "Der er ikke mere at købe på denne liste.",
  },
  notConnected: {
    EN: "This home has no Nemlig login yet. An admin can add one in Settings.",
    DA: "Dette hjem har endnu ikke et Nemlig-login. En administrator kan tilføje det under Indstillinger.",
  },
  tryAgain: { EN: "Try again", DA: "Prøv igen" },
  busy: {
    EN: "That was a lot of Nemlig in a short time. Try again in {minutes} min.",
    DA: "Det blev til meget Nemlig på kort tid. Prøv igen om {minutes} min.",
  },

  reviewIntro: {
    EN: "Check what goes in the basket. Nothing is added until you press the button below.",
    DA: "Tjek hvad der kommer i kurven. Intet bliver lagt i, før I trykker på knappen nedenfor.",
  },
  rememberedMark: { EN: "Your usual", DA: "Jeres sædvanlige" },
  noPrice: { EN: "Price shown at Nemlig", DA: "Prisen ses hos Nemlig" },
  soldOut: { EN: "Sold out", DA: "Udsolgt" },
  change: { EN: "Change", DA: "Skift" },
  skip: { EN: "Skip", DA: "Spring over" },
  include: { EN: "Include", DA: "Tag med" },
  skipped: { EN: "Skipped", DA: "Sprunget over" },
  choose: { EN: "Choose a product", DA: "Vælg en vare" },
  searchAgain: { EN: "Search Nemlig", DA: "Søg hos Nemlig" },
  searchButton: { EN: "Search", DA: "Søg" },
  noResults: { EN: "Nemlig found nothing for that.", DA: "Nemlig fandt intet på det." },
  less: { EN: "One fewer {name}", DA: "En færre {name}" },
  more: { EN: "One more {name}", DA: "En mere {name}" },
  price: { EN: "{amount} kr.", DA: "{amount} kr." },
  estimate: { EN: "About {amount} kr.", DA: "Cirka {amount} kr." },
  putInBasket: {
    EN: { one: "Put {count} item in the basket", other: "Put {count} items in the basket" },
    DA: { one: "Læg {count} vare i kurven", other: "Læg {count} varer i kurven" },
  } satisfies Plural,
  nothingChosen: { EN: "Nothing chosen to add", DA: "Intet valgt" },
  adding: { EN: "Filling your Nemlig basket…", DA: "Fylder jeres Nemlig-kurv…" },

  addedHeading: { EN: "Added · {count}", DA: "Lagt i kurven · {count}" },
  skippedHeading: { EN: "Skipped · {count}", DA: "Sprunget over · {count}" },
  failedHeading: { EN: "Failed · {count}", DA: "Fejlede · {count}" },
  openBasket: { EN: "Open the basket on nemlig.com", DA: "Åbn kurven på nemlig.com" },
  basketNote: {
    EN: "Check out and pay on nemlig.com — this app only fills the basket.",
    DA: "Bestil og betal på nemlig.com — appen fylder kun kurven.",
  },
  done: { EN: "Done", DA: "Færdig" },

  // Settings.
  heading: { EN: "Nemlig", DA: "Nemlig" },
  intro: {
    EN: "Connect the household's nemlig.com account, and any list can be sent to its basket.",
    DA: "Forbind husstandens konto på nemlig.com, så kan enhver liste sendes til dens kurv.",
  },
  email: { EN: "Nemlig email", DA: "E-mail hos Nemlig" },
  password: { EN: "Nemlig password", DA: "Adgangskode hos Nemlig" },
  passwordHint: {
    EN: "Kept encrypted, and only ever sent to Nemlig. Nobody can read it back, here or anywhere.",
    DA: "Gemmes krypteret og sendes kun til Nemlig. Ingen kan læse den igen, hverken her eller andre steder.",
  },
  connect: { EN: "Connect", DA: "Forbind" },
  connected: { EN: "Connected", DA: "Forbundet" },
  connectedAs: { EN: "Connected as {email}", DA: "Forbundet som {email}" },
  changeLogin: { EN: "Change login", DA: "Skift login" },
  saveLogin: { EN: "Check and save", DA: "Tjek og gem" },
  disconnect: { EN: "Disconnect", DA: "Afbryd forbindelsen" },
  disconnectTitle: { EN: "Disconnect Nemlig?", DA: "Afbryd forbindelsen til Nemlig?" },
  disconnectMessage: {
    EN: "The login is deleted from this app. The basket and the account at nemlig.com are left as they are.",
    DA: "Loginet slettes fra appen. Kurven og kontoen på nemlig.com forbliver, som de er.",
  },
  emailRequired: { EN: "Enter the email you log in to Nemlig with.", DA: "Skriv den e-mail, I logger ind hos Nemlig med." },
  passwordRequired: { EN: "Enter the Nemlig password.", DA: "Skriv adgangskoden til Nemlig." },
} as const satisfies Record<string, Phrase | Plural>;

/** Why one line, or the whole press, did not reach the basket — by `NemligFailure`. */
export const NEMLIG_FAILURE = {
  login: {
    EN: "Nemlig did not accept the login. An admin can check it in Settings.",
    DA: "Nemlig godtog ikke loginet. En administrator kan tjekke det under Indstillinger.",
  },
  timeout: {
    EN: "Nemlig took too long to answer.",
    DA: "Nemlig var for længe om at svare.",
  },
  unavailable: {
    EN: "Nemlig could not be reached.",
    DA: "Nemlig kunne ikke nås.",
  },
  changed: {
    EN: "Nemlig answered in a way this app does not understand — it may have changed.",
    DA: "Nemlig svarede på en måde, appen ikke forstår — den kan være ændret.",
  },
  refused: {
    EN: "Nemlig would not add it.",
    DA: "Nemlig ville ikke lægge den i kurven.",
  },
  notFound: {
    EN: "Nemlig found nothing for this.",
    DA: "Nemlig fandt intet på denne.",
  },
} as const satisfies Record<NemligFailure | "notFound", Phrase>;

import type { PantryCategory, PantryUnit } from "@prisma/client";
import type { Phrase, Plural } from "./say";

/** What each unit a pantry quantity can be counted in is called —
 *  `Record<PantryUnit, Phrase>`, so a unit added to the schema without a label here
 *  fails to compile. Kept to the app's other common units: `CAN`/`BAG` are the same
 *  `dåse`/`pose` `SAME_MEASURE` in `src/lib/ingredient-line.ts` writes for a recipe's
 *  own units. */
export const PANTRY_UNIT_LABELS = {
  G: { EN: "g", DA: "g" },
  KG: { EN: "kg", DA: "kg" },
  DL: { EN: "dl", DA: "dl" },
  L: { EN: "l", DA: "l" },
  CAN: { EN: "can", DA: "dåse" },
  BAG: { EN: "bag", DA: "pose" },
  PACK: { EN: "pack", DA: "pakke" },
  JAR: { EN: "jar", DA: "glas" },
  BUNCH: { EN: "bunch", DA: "bundt" },
} as const satisfies Record<PantryUnit, Phrase>;

/** What each shelf is called, in the order the pantry page draws them —
 *  `Record<PantryCategory, Phrase>`, so a shelf added to the schema without a name here
 *  fails to compile. `PANTRY_CATEGORIES` in `src/lib/pantry.ts` reads its order from
 *  this object. */
export const PANTRY_CATEGORY_LABELS = {
  SPICES: { EN: "Spices & herbs", DA: "Krydderier" },
  OIL_VINEGAR: { EN: "Oil & vinegar", DA: "Olie & eddike" },
  SAUCES: { EN: "Sauces & condiments", DA: "Saucer & dressinger" },
  BAKING: { EN: "Baking", DA: "Bagning" },
  DRY_GOODS: { EN: "Pasta, rice & grains", DA: "Pasta, ris & gryn" },
  TINS_JARS: { EN: "Tins & jars", DA: "Dåser & glas" },
  FRIDGE: { EN: "Fridge", DA: "Køleskab" },
  FREEZER: { EN: "Freezer", DA: "Fryser" },
  DRINKS: { EN: "Drinks", DA: "Drikkevarer" },
  OTHER: { EN: "Other", DA: "Andet" },
} as const satisfies Record<PantryCategory, Phrase>;

/**
 * What the pantry says — the page, the row, and the sentence a recipe or a restock run
 * writes back about what it found already in stock.
 */
export const PANTRY = {
  title: { EN: "Pantry", DA: "Spisekammer" },
  description: {
    EN: "The basics you always have in. A recipe added to a shopping list leaves these off — bring anything you have run out of down to zero and it goes back on.",
    DA: "De basisvarer I altid har hjemme. En opskrift lagt på en indkøbsliste springer dem over — sæt det, I er løbet tør for, til nul, og det kommer med igen.",
  },
  nameLabel: { EN: "Something you keep in", DA: "Noget I altid har hjemme" },
  namePlaceholder: { EN: "Salt", DA: "Salt" },
  add: { EN: "Add to pantry", DA: "Tilføj til spisekammer" },
  addSubmit: { EN: "Add", DA: "Tilføj" },
  nameRequired: { EN: "Write what you keep in.", DA: "Skriv, hvad I har stående." },
  noKeyLeft: {
    EN: "Write what it is called, not how much of it.",
    DA: "Skriv hvad det hedder, ikke hvor meget I har.",
  },
  empty: { EN: "Nothing in the pantry yet.", DA: "Spisekammeret er tomt endnu." },
  emptyHint: {
    EN: "Add the lines your recipes open with — salt, pepper, oil, butter, flour — and they will stop turning up on the shopping.",
    DA: "Tilføj de ting jeres opskrifter altid starter med — salt, peber, olie, smør, mel — så holder de op med at dukke op på indkøbslisten.",
  },
  runOut: { EN: "Run out", DA: "Løbet tør" },
  quantityAria: { EN: "Quantity of {name}", DA: "Mængde af {name}" },
  decreaseQuantity: { EN: "Decrease {name}", DA: "Formindsk {name}" },
  increaseQuantity: { EN: "Increase {name}", DA: "Forøg {name}" },
  noUnit: { EN: "No unit", DA: "Ingen enhed" },
  editAria: { EN: "Edit {name}", DA: "Rediger {name}" },
  removeTitle: { EN: "Remove from pantry", DA: "Fjern fra spisekammer" },
  removeMessage: {
    EN: "Stop treating “{name}” as something you always have in? Recipes asking for it will put it on the shopping list again.",
    DA: "Stop med at behandle “{name}” som noget I altid har hjemme? Opskrifter der bruger det, sætter det på indkøbslisten igen.",
  },
  removeConfirm: { EN: "Remove", DA: "Fjern" },
  noItemAnyMore: { EN: "That is no longer in the pantry.", DA: "Det står ikke længere i spisekammeret." },

  duplicate: { EN: "“{name}” is already in the pantry.", DA: "“{name}” står allerede i spisekammeret." },
  covered: { EN: "{names} already in the pantry.", DA: "{names} står allerede i spisekammeret." },
  onList: { EN: "{names} already on the list.", DA: "{names} står allerede på listen." },
  /** The last two names of a list, joined — see `namesInWords` in `src/lib/pantry.ts`. */
  lastTwo: { EN: "{most} and {last}", DA: "{most} og {last}" },
  /** Not a `Plural`: "1 more" and "2 more" are the same word in both languages — the
   *  number beside it is what already says how many. */
  andMore: { EN: "{count} more", DA: "{count} mere" },

  // Filing things on shelves, and the add box's help.
  unsorted: { EN: "Not sorted yet", DA: "Ikke sorteret endnu" },
  sort: { EN: "Sort with AI", DA: "Sortér med AI" },
  sorting: { EN: "Sorting…", DA: "Sorterer…" },
  sortWaitTitle: { EN: "Sorting your pantry", DA: "Sorterer jeres spisekammer" },
  sortWaitDetail: {
    EN: "Finding the right shelf for the things we did not recognise.",
    DA: "Finder den rigtige hylde til de ting, vi ikke kendte.",
  },
  sortStageRead: { EN: "Reading the names", DA: "Læser navnene" },
  sortStageFile: { EN: "Putting them on shelves", DA: "Sætter dem på hylderne" },
  sortTooSoon: {
    EN: "Sorted a lot just now — try again in {minutes} min.",
    DA: "Der er sorteret meget lige nu — prøv igen om {minutes} min.",
  },
  sortOverLimit: {
    EN: "This home has used its AI allowance for the month. Choose a shelf from the three dots instead.",
    DA: "Hjemmet har brugt månedens AI-forbrug. Vælg en hylde under de tre prikker i stedet.",
  },
  sortUnavailable: {
    EN: "Could not sort right now. Try again later, or choose a shelf from the three dots.",
    DA: "Kunne ikke sortere lige nu. Prøv igen senere, eller vælg en hylde under de tre prikker.",
  },
  categoryLabel: { EN: "Shelf", DA: "Hylde" },
  categoryAuto: { EN: "Choose for me", DA: "Vælg for mig" },
  unitLabel: { EN: "Counted in", DA: "Tælles i" },
  editTitle: { EN: "Shelf and unit", DA: "Hylde og enhed" },
  editEntry: { EN: "Shelf and unit", DA: "Hylde og enhed" },
  suggestions: { EN: "Suggestions", DA: "Forslag" },
  filterLabel: { EN: "Find in the pantry", DA: "Find i spisekammeret" },
  filterPlaceholder: { EN: "Find…", DA: "Søg…" },
  onlyRunOut: { EN: "Only run out", DA: "Kun løbet tør" },
  noMatches: {
    EN: "Nothing in the pantry matches “{query}”.",
    DA: "Intet i spisekammeret passer til “{query}”.",
  },
  clearFilter: { EN: "Show everything", DA: "Vis alt" },
  alreadyKept: { EN: "Already in the pantry", DA: "Står allerede i spisekammeret" },
  commonGoods: { EN: "Common basics", DA: "Almindelige basisvarer" },
  alreadyKeptAt: { EN: "{name} is already in the pantry.", DA: "{name} står allerede i spisekammeret." },
  showIt: { EN: "Show it", DA: "Vis den" },

  nothingRunOut: { EN: "Nothing in the pantry has run out.", DA: "Intet i spisekammeret er løbet tør." },
  allAlreadyOnList: {
    EN: "Everything that has run out is already on the list.",
    DA: "Alt det, der er løbet tør, står allerede på listen.",
  },
} as const satisfies Record<string, Phrase | Plural>;

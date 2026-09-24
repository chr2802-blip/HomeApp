import type { PantryUnit } from "@prisma/client";
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

/**
 * What the pantry says — the page, the row, and the sentence a recipe or a restock run
 * writes back about what it found already in stock.
 */
export const PANTRY = {
  title: { EN: "Pantry", DA: "Spisekammer" },
  description: {
    EN: "The basics you always have in. A recipe added to a shopping list leaves these off — switch off anything you have run out of and it goes back on.",
    DA: "De basisvarer I altid har hjemme. En opskrift lagt på en indkøbsliste springer dem over — sluk for det, I er løbet tør for, og det kommer med igen.",
  },
  nameLabel: { EN: "Something you keep in", DA: "Noget I altid har hjemme" },
  namePlaceholder: { EN: "Salt", DA: "Salt" },
  add: { EN: "Add to pantry", DA: "Tilføj til spisekammer" },
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
  unitAria: { EN: "Unit for {name}", DA: "Enhed for {name}" },
  noUnit: { EN: "None", DA: "Ingen" },
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

  nothingRunOut: { EN: "Nothing in the pantry has run out.", DA: "Intet i spisekammeret er løbet tør." },
  allAlreadyOnList: {
    EN: "Everything that has run out is already on the list.",
    DA: "Alt det, der er løbet tør, står allerede på listen.",
  },
} as const satisfies Record<string, Phrase | Plural>;

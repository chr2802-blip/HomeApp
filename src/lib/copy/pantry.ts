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
  BABY: { EN: "Baby", DA: "Baby" },
  OTHER: { EN: "Other", DA: "Andet" },
} as const satisfies Record<PantryCategory, Phrase>;

/**
 * What the pantry says — the page, the row, and the sentence a recipe or a restock run
 * writes back about what it found already in stock.
 */
export const PANTRY = {
  title: { EN: "Supplies", DA: "Forråd" },
  description: {
    EN: "The things you always have in. A recipe added to a shopping list leaves these off — bring anything you have run out of down to zero and it goes back on.",
    DA: "De ting I altid har hjemme. En opskrift lagt på en indkøbsliste springer dem over — sæt det, I er løbet tør for, til nul, og det kommer med igen.",
  },
  nameLabel: { EN: "Something you keep in", DA: "Noget I altid har hjemme" },
  namePlaceholder: { EN: "Salt", DA: "Salt" },
  add: { EN: "Add to supplies", DA: "Tilføj til forrådet" },
  addSubmit: { EN: "Add", DA: "Tilføj" },
  nameRequired: { EN: "Write what you keep in.", DA: "Skriv, hvad I har stående." },
  noKeyLeft: {
    EN: "Write what it is called, not how much of it.",
    DA: "Skriv hvad det hedder, ikke hvor meget I har.",
  },
  empty: { EN: "The cupboard is bare, for now.", DA: "Skabet er tomt, indtil videre." },
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
  removeTitle: { EN: "Remove from supplies", DA: "Fjern fra forrådet" },
  removeMessage: {
    EN: "Stop treating “{name}” as something you always have in? Recipes asking for it will put it on the shopping list again.",
    DA: "Stop med at behandle “{name}” som noget I altid har hjemme? Opskrifter der bruger det, sætter det på indkøbslisten igen.",
  },
  removeConfirm: { EN: "Remove", DA: "Fjern" },
  noItemAnyMore: { EN: "That is no longer in your supplies.", DA: "Det står ikke længere i forrådet." },

  duplicate: { EN: "“{name}” is already in your supplies.", DA: "“{name}” står allerede i forrådet." },
  covered: { EN: "{names} already in your supplies.", DA: "{names} står allerede i forrådet." },
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
  sortWaitTitle: { EN: "Sorting your supplies", DA: "Sorterer jeres forråd" },
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
  editTitle: { EN: "Edit entry", DA: "Rediger vare" },
  expiryLabel: { EN: "Expiry date (optional)", DA: "Udløbsdato (valgfri)" },
  expiryInvalid: { EN: "That is not a date.", DA: "Det er ikke en dato." },
  expired: { EN: "Expired", DA: "Udløbet" },
  expiresToday: { EN: "Expires today", DA: "Udløber i dag" },
  expiresIn: {
    EN: { one: "Expires in {count} day", other: "Expires in {count} days" },
    DA: { one: "Udløber om {count} dag", other: "Udløber om {count} dage" },
  },
  suggestions: { EN: "Suggestions", DA: "Forslag" },
  filterLabel: { EN: "Find in supplies", DA: "Find i forrådet" },
  filterPlaceholder: { EN: "Find…", DA: "Søg…" },
  onlyRunOut: { EN: "Only run out", DA: "Kun løbet tør" },
  noMatches: {
    EN: "Nothing in your supplies matches “{query}”.",
    DA: "Intet i forrådet passer til “{query}”.",
  },
  clearFilter: { EN: "Show everything", DA: "Vis alt" },
  alreadyKept: { EN: "Already in your supplies", DA: "Står allerede i forrådet" },
  commonGoods: { EN: "Common basics", DA: "Almindelige basisvarer" },
  alreadyKeptAt: { EN: "{name} is already in your supplies.", DA: "{name} står allerede i forrådet." },
  showIt: { EN: "Show it", DA: "Vis den" },

  /** The line over the shelves: how much the cupboard holds, then how much of it is out. */
  overview: {
    EN: { one: "{count} thing kept in", other: "{count} things kept in" },
    DA: { one: "{count} ting i forrådet", other: "{count} ting i forrådet" },
  },
  /** Not a `Plural`, like `andMore`: "1 run out" and "2 run out" are the same words. */
  overviewRunOut: { EN: "{count} run out", DA: "{count} løbet tør" },
  nothingRunOut: { EN: "Nothing in your supplies has run out.", DA: "Intet i forrådet er løbet tør." },
  allAlreadyOnList: {
    EN: "Everything that has run out is already on the list.",
    DA: "Alt det, der er løbet tør, står allerede på listen.",
  },
} as const satisfies Record<string, Phrase | Plural>;

/** "What can we cook?" — the recipes that use most of what is in. */
export const PANTRY_COOK = {
  button: { EN: "What can we cook?", DA: "Hvad kan vi lave?" },
  extraLabel: { EN: "Anything else in the kitchen?", DA: "Har I andet i køkkenet?" },
  extraPlaceholder: { EN: "e.g. chicken", DA: "fx kylling" },
  extraAdd: { EN: "Add", DA: "Tilføj" },
  extraHint: {
    EN: "Counted with your supplies for now. Nothing here is saved.",
    DA: "Regnes med sammen med forrådet lige nu. Intet her bliver gemt.",
  },
  removeExtra: { EN: "Remove {name}", DA: "Fjern {name}" },
  have: {
    EN: { one: "You have {have} of {count} ingredient", other: "You have {have} of {count} ingredients" },
    DA: { one: "I har {have} af {count} ingrediens", other: "I har {have} af {count} ingredienser" },
  },
  missing: { EN: "Missing: {names}", DA: "Mangler: {names}" },
  haveAll: { EN: "You have everything it needs", DA: "I har alt, den skal bruge" },
  loading: { EN: "Looking through your recipes…", DA: "Kigger jeres opskrifter igennem…" },
  none: {
    EN: "None of your recipes use what you have in yet.",
    DA: "Ingen af jeres opskrifter bruger endnu det, I har hjemme.",
  },
  failed: {
    EN: "Couldn't look through the recipes. Try again.",
    DA: "Kunne ikke kigge opskrifterne igennem. Prøv igen.",
  },
} as const;

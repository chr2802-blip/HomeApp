import type { Phrase, Plural } from "./say";

/** The dashboard's three tiles of a person's own choosing, and the chooser behind them. */
export const TILES = {
  // What each kind is called in the chooser.
  kindSleep: { EN: "Start sleep", DA: "Start søvn" },
  kindFeed: { EN: "Start breastfeed", DA: "Start amning" },
  kindRecipe: { EN: "Create recipe", DA: "Opret opskrift" },

  // On the tiles themselves.
  sleepIdle: { EN: "Start sleep", DA: "Start søvn" },
  sleepIdleHint: { EN: "tap when asleep", DA: "tryk når der soves" },
  sleeping: { EN: "asleep", DA: "sover" },
  sleepingHint: { EN: "tap when awake", DA: "tryk ved vågen" },
  feedIdle: { EN: "Breastfeed", DA: "Amning" },
  feeding: { EN: "feeding", DA: "ammer" },
  leftShort: { EN: "L", DA: "V" },
  rightShort: { EN: "R", DA: "H" },
  noBaby: { EN: "set up the baby log", DA: "opret babyloggen" },
  newRecipe: { EN: "New recipe", DA: "Ny opskrift" },
  newRecipeHint: { EN: "by hand or a link", DA: "selv eller link" },
  listOpen: {
    EN: { one: "{count} left", other: "{count} left" },
    DA: { one: "{count} tilbage", other: "{count} tilbage" },
  },
  listDone: { EN: "all done", DA: "alt klaret" },

  emptyTitle: { EN: "Empty", DA: "Tomt felt" },
  emptyHint: {
    EN: "Press and hold to add a shortcut",
    DA: "Tryk og hold for at tilføje en genvej",
  },

  // The chooser.
  chooseTitle: { EN: "Tile {n}", DA: "Felt {n}" },
  shortcuts: { EN: "Shortcuts", DA: "Genveje" },
  clear: { EN: "Leave this tile empty", DA: "Lad feltet være tomt" },
  emptyRow: { EN: "Empty", DA: "Tomt" },
  lists: { EN: "A list", DA: "En liste" },
  noLists: { EN: "The home has no lists yet.", DA: "Hjemmet har ingen lister endnu." },
  inPlace: { EN: "Tile {n}", DA: "Felt {n}" },
  change: { EN: "Change", DA: "Skift" },
  add: { EN: "Add", DA: "Tilføj" },
  changeNamed: { EN: "Change tile {n}", DA: "Skift felt {n}" },
  profileHeading: { EN: "Front page", DA: "Forsiden" },
  profileHint: {
    EN: "The three tiles under the greeting — or press and hold one on the front page. Yours alone; the others choose their own.",
    DA: "De tre felter under hilsenen — eller tryk og hold på et af dem på forsiden. Kun dine; de andre vælger deres egne.",
  },
} as const satisfies Record<string, Phrase | Plural>;

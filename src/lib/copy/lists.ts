import type { Phrase, Plural } from "./say";

/** `/lists`, a list's own page, and everything a row on one can do. */
export const LISTS = {
  title: { EN: "Lists", DA: "Lister" },
  description: {
    EN: "Shopping lists, to-dos, anything you want to tick off.",
    DA: "Indkøbslister, huskelister, alt I vil krydse af.",
  },
  newList: { EN: "New list", DA: "Ny liste" },
  createList: { EN: "Create list", DA: "Opret liste" },
  listName: { EN: "List name", DA: "Listens navn" },
  namePlaceholder: { EN: "Shopping list", DA: "Indkøbsliste" },
  photoHint: {
    EN: "Optional — a picture makes the list easy to pick out.",
    DA: "Valgfrit — et billede gør listen let at få øje på.",
  },

  trackAmounts: { EN: "Track amounts", DA: "Hold styr på mængder" },
  trackAmountsHint: {
    EN: "Each item gets a quantity, starting at 1 — for a shopping list rather than a list of jobs.",
    DA: "Hver ting får en mængde, startende ved 1 — til en indkøbsliste snarere end en liste over opgaver.",
  },

  empty: {
    EN: "Nothing on the shelf yet — create your first list with the button above.",
    DA: "Ikke noget på hylden endnu — opret jeres første liste med knappen ovenfor.",
  },
  openTotal: { EN: "{open} open · {total} total", DA: "{open} åbne · {total} i alt" },
  editList: { EN: "Edit list", DA: "Rediger liste" },
  deleteListMessage: {
    EN: 'Delete "{title}" and all its items?',
    DA: 'Slet "{title}" og alt på den?',
  },
  searchLists: { EN: "Search lists", DA: "Søg i lister" },
  noMatch: { EN: "No list matches “{query}”.", DA: "Ingen liste matcher “{query}”." },
  done: { EN: "Done ({count})", DA: "Færdige ({count})" },

  // The row
  reorder: { EN: "Reorder {name}", DA: "Omorder {name}" },
  markNotDone: { EN: "Mark as not done", DA: "Marker som ikke gjort" },
  markDone: { EN: "Mark as done", DA: "Marker som gjort" },
  editItemAria: { EN: "Edit {name}", DA: "Rediger {name}" },
  from: { EN: "From", DA: "Fra" },
  tickedOffBy: { EN: "Ticked off by", DA: "Krydset af af" },
  amountFor: { EN: "Amount for {name}", DA: "Mængde af {name}" },
  removeItem: { EN: "Remove item", DA: "Fjern vare" },
  remove: { EN: "Remove", DA: "Fjern" },
  removeItemMessage: {
    EN: 'Remove "{name}" from this list?',
    DA: 'Fjern "{name}" fra denne liste?',
  },

  allDone: { EN: "All done 🎉", DA: "Alt er klaret 🎉" },
  missing: { EN: "{count} missing", DA: "{count} mangler" },
  emptyList: {
    EN: "🛒 This list is empty — add something below.",
    DA: "🛒 Denne liste er tom — tilføj noget nedenfor.",
  },
  allTicked: {
    EN: "🎉 Nice — everything here is ticked off.",
    DA: "🎉 Fint — alt her er krydset af.",
  },
  completed: { EN: "Completed ({count})", DA: "Afkrydset ({count})" },

  // The add box
  addItem: { EN: "Add an item", DA: "Tilføj en vare" },
  add: { EN: "Add", DA: "Tilføj" },
  adding: { EN: "Adding…", DA: "Tilføjer…" },
  alreadyOnList: { EN: "Already on this list", DA: "Allerede på listen" },
  pickOneBack: {
    EN: "Ticked off earlier — pick one to put it back",
    DA: "Krydset af tidligere — vælg en for at sætte den på igen",
  },
  amount: { EN: "Amount", DA: "Mængde" },

  // The favourite star
  favourite: { EN: "Favourite {name}", DA: "Favoritmarker {name}" },
  removeFromFavourites: { EN: "Remove from favourites", DA: "Fjern fra favoritter" },
  addToFavourites: { EN: "Add to favourites", DA: "Tilføj til favoritter" },

  // The amount picker
  decrease: { EN: "Decrease {name}", DA: "Formindsk {name}" },
  increase: { EN: "Increase {name}", DA: "Forøg {name}" },

  // The connection line — src/lib/offline-ops.ts's statusLine
  offlineWaiting: {
    EN: "Offline — {changes} saved on this phone, and sent when you are back.",
    DA: "Offline — {changes} gemt på denne telefon, og sendt når I er tilbage.",
  },
  offlineIdle: {
    EN: "Offline — ticks are saved here and sent when you are back.",
    DA: "Offline — kryds gemmes her og sendes når I er tilbage.",
  },
  sending: { EN: "Sending {changes}…", DA: "Sender {changes}…" },
  toSend: { EN: "{changes} to send.", DA: "{changes} skal sendes." },
  changes: {
    EN: { one: "{count} change", other: "{count} changes" },
    DA: { one: "{count} ændring", other: "{count} ændringer" },
  },

  // What the list actions refuse with.
  nameRequired: { EN: "Give the list a name.", DA: "Giv listen et navn." },
  itemRequired: { EN: "Write something to add.", DA: "Skriv noget, der skal på." },
  alreadyOnListNamed: { EN: "“{name}” is already on the list.", DA: "“{name}” er allerede på listen." },
  recipeHasNoIngredients: {
    EN: "This recipe has no ingredients to add yet.",
    DA: "Opskriften har ingen ingredienser at tilføje endnu.",
  },
  pantryHasAll: {
    EN: "Nothing to add — the pantry already has all of it.",
    DA: "Intet at tilføje — spisekammeret har det hele allerede.",
  },
  nothingCookedThisWeek: {
    EN: "Nothing is being cooked this week yet.",
    DA: "Der er ikke planlagt noget madlavning i denne uge endnu.",
  },
  weekHasNoIngredients: {
    EN: "None of this week's recipes have ingredients to add yet.",
    DA: "Ingen af ugens opskrifter har ingredienser at tilføje endnu.",
  },
} as const satisfies Record<string, Phrase | Plural>;

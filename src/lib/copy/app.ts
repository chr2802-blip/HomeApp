import type { Phrase, Plural } from "./say";

/**
 * What every screen shares: the frame around the app (the tabs, the header, the way
 * out), and the handful of words — Edit, Delete, Cancel, Saving… — that mean the same
 * thing wherever they appear rather than belonging to any one page.
 */
export const APP = {
  meta: {
    description: {
      EN: "Lists, recurring tasks and recipes for your home.",
      DA: "Lister, tilbagevendende opgaver og opskrifter til jeres hjem.",
    },
  },
  nav: {
    dashboard: { EN: "Home", DA: "Hjem" },
    lists: { EN: "Lists", DA: "Lister" },
    tasks: { EN: "Tasks", DA: "Opgaver" },
    meals: { EN: "Meals", DA: "Måltider" },
    recipes: { EN: "Recipes", DA: "Opskrifter" },
    admin: { EN: "Admin", DA: "Admin" },
  },
  logOut: { EN: "Log out", DA: "Log ud" },

  /** The title on the reminder job's push notification — read with no session, in the
   *  home the task belongs to rather than whoever happens to be looking at a screen. */
  push: {
    taskDue: { EN: "Task due", DA: "Opgave forfalder" },
  },

  /** The header's home menu — pantry, settings, profile, and the other homes. */
  homeMenu: {
    ariaLabel: { EN: "{name} — home menu", DA: "{name} — hjemmemenu" },
    menuLabel: { EN: "This home and you", DA: "Dette hjem og dig" },
    pantry: { EN: "Pantry", DA: "Spisekammer" },
    settings: { EN: "Settings", DA: "Indstillinger" },
    profile: { EN: "Profile", DA: "Profil" },
    current: { EN: "Current", DA: "Nuværende" },
    allHomes: { EN: "All your homes", DA: "Alle dine hjem" },
  },

  edit: { EN: "Edit", DA: "Rediger" },
  delete: { EN: "Delete", DA: "Slet" },
  cancel: { EN: "Cancel", DA: "Annuller" },
  save: { EN: "Save", DA: "Gem" },
  saveChanges: { EN: "Save changes", DA: "Gem ændringer" },
  saving: { EN: "Saving…", DA: "Gemmer…" },
  added: { EN: "Added.", DA: "Tilføjet." },
  /** `ConfirmButton`/`ConfirmDialog`'s own default title — every destructive sheet in
   *  the app that does not name its own question. */
  areYouSure: { EN: "Are you sure?", DA: "Er du sikker?" },
  /** A destructive action's pending state — the same word wherever a delete is in flight. */
  working: { EN: "Working…", DA: "Arbejder…" },
  /** Every sheet's own close button. */
  close: { EN: "Close", DA: "Luk" },
  /** The three dots' own accessible name, when they carry no face of their own. */
  actionsFor: { EN: "Actions for {name}", DA: "Handlinger for {name}" },

  /** "Add to list", shared by a recipe page, the meal plan and the pantry. */
  addToList: {
    label: { EN: "Add to list", DA: "Tilføj til liste" },
    adding: { EN: "Adding…", DA: "Tilføjer…" },
    addedTo: { EN: "Added to {list}.", DA: "Tilføjet til {list}." },
    noLists: {
      EN: "No lists track amounts yet — turn that on for one, then come back.",
      DA: "Ingen lister holder styr på mængder endnu — slå det til for en, og kom så tilbage.",
    },
    open: {
      EN: { one: "{count} open", other: "{count} open" },
      DA: { one: "{count} åben", other: "{count} åbne" },
    },
    decisionTitle: { EN: "Already have some of this?", DA: "Har I allerede noget af det?" },
    decisionHelp: {
      EN: "These look like things you already have, so none are added yet. Check any you still want on the list.",
      DA: "Det ser ud som om I allerede har det her, så intet er tilføjet endnu. Marker det, I alligevel skal bruge på listen.",
    },
    addChecked: { EN: "Add checked", DA: "Tilføj markerede" },
  },
} as const satisfies Record<string, Phrase | Plural | Record<string, Phrase | Plural>>;

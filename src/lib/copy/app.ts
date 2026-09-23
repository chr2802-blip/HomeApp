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
    testBody: { EN: "Notifications are working.", DA: "Notifikationerne virker." },
  },

  /** The two screens a page falls back to — something thrown, or nothing there. */
  error: {
    notYourHome: { EN: "Not your home", DA: "Ikke dit hjem" },
    notYourHomeBody: {
      EN: "That belongs to a different home, so it cannot be opened from here.",
      DA: "Det hører til et andet hjem, så det kan ikke åbnes herfra.",
    },
    somethingWrong: { EN: "Something went wrong", DA: "Noget gik galt" },
    somethingWrongBody: {
      EN: "The page could not be loaded. Trying again often clears it.",
      DA: "Siden kunne ikke indlæses. Ofte hjælper det at prøve igen.",
    },
    tryAgain: { EN: "Try again", DA: "Prøv igen" },
    backToDashboard: { EN: "Back to the dashboard", DA: "Tilbage til forsiden" },
    notFound: { EN: "Not found", DA: "Ikke fundet" },
    notFoundBody: {
      EN: "This page does not exist, or it belongs to a different home.",
      DA: "Siden findes ikke, eller den hører til et andet hjem.",
    },
  },

  /** The recipe page's toggle that keeps the phone awake while somebody cooks. */
  keepScreenOn: {
    label: { EN: "Keep screen on", DA: "Hold skærmen tændt" },
    whileOn: {
      EN: "Screen will stay on — tap to allow it to sleep",
      DA: "Skærmen forbliver tændt — tryk for at lade den slukke",
    },
    whileOff: { EN: "Keep screen on while cooking", DA: "Hold skærmen tændt under madlavningen" },
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
    addChecked: { EN: "Add checked", DA: "Tilføj markerede" },
  },
} as const satisfies Record<string, Phrase | Plural | Record<string, Phrase | Plural>>;

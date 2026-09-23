import type { Phrase } from "./say";

/** `/homes` (everybody's own) and `/admin/homes` (the super admin's, every household). */
export const HOMES = {
  homes: { EN: "Homes", DA: "Hjem" },
  yourHomes: { EN: "Your homes", DA: "Jeres hjem" },
  everywhereYouAreAMember: {
    EN: "Everywhere you are a member. Switch into one to read and write in it.",
    DA: "Overalt hvor I er medlem. Skift til et for at læse og skrive i det.",
  },
  allHomes: { EN: "All homes", DA: "Alle hjem" },
  notInAHomeYet: {
    EN: "You are not in a home yet. Somebody in one can invite you by email.",
    DA: "I er ikke i et hjem endnu. Nogen i et hjem kan invitere jer via e-mail.",
  },
  youRunThisHome: { EN: "You run this home", DA: "I administrerer dette hjem" },
  member: { EN: "Member", DA: "Medlem" },
  active: { EN: "Active", DA: "Aktivt" },
  switchTo: { EN: "Switch to", DA: "Skift til" },

  // /admin/homes
  everyHomeSwitchToAdminister: {
    EN: "Every home on this installation. Switch into one to administer it.",
    DA: "Alle hjem på denne installation. Skift til et for at administrere det.",
  },
  newHomeName: { EN: "New home name", DA: "Nyt hjems navn" },
  address: { EN: "Address (optional)", DA: "Adresse (valgfrit)" },
  createHome: { EN: "Create home", DA: "Opret hjem" },
  homeCreated: { EN: "Home created.", DA: "Hjem oprettet." },
  noHomesCreateFirst: {
    EN: "No homes yet — create the first one above.",
    DA: "Ingen hjem endnu — opret det første ovenfor.",
  },
  homeStats: {
    EN: "{members} members · {lists} lists · {tasks} tasks · {recipes} recipes",
    DA: "{members} medlemmer · {lists} lister · {tasks} opgaver · {recipes} opskrifter",
  },
  deleteHome: { EN: "Delete home", DA: "Slet hjem" },
  deleteHomeMessage: {
    EN: 'Permanently delete "{name}"? Its {lists} lists, {tasks} tasks and {recipes} recipes go with it, and its {members} members lose this home. This cannot be undone.',
    DA: 'Slet "{name}" permanent? Dens {lists} lister, {tasks} opgaver og {recipes} opskrifter forsvinder med den, og dens {members} medlemmer mister dette hjem. Dette kan ikke fortrydes.',
  },
  deletingRemovesContent: {
    EN: "Deleting a home permanently removes its lists, tasks and recipes. Its members keep their accounts and whatever other homes they are in.",
    DA: "At slette et hjem fjerner permanent dets lister, opgaver og opskrifter. Dets medlemmer beholder deres konti og eventuelle andre hjem, de er i.",
  },
} as const satisfies Record<string, Phrase>;

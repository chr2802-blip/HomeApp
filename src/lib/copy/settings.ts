import type { StorageKind } from "@/lib/storage";
import type { Phrase, Plural } from "./say";

/** A kind's name, shared by the home's own Settings page and the super admin's System
 *  page. `Record<StorageKind, Phrase>`, so a kind added to `STORAGE_KINDS` in
 *  `src/lib/storage.ts` without a label here fails to compile. */
export const STORAGE_KIND_LABELS = {
  recipes: { EN: "Recipes", DA: "Opskrifter" },
  lists: { EN: "Lists", DA: "Lister" },
  tasks: { EN: "Tasks", DA: "Opgaver" },
  rest: { EN: "Everything else", DA: "Alt andet" },
} as const satisfies Record<StorageKind, Phrase>;

/** The Home card on `/settings` — the household's own name, picture, colour and language. */
export const SETTINGS = {
  title: { EN: "Settings", DA: "Indstillinger" },
  managing: { EN: "Managing {home}", DA: "Administrerer {home}" },
  homeHeading: { EN: "Home", DA: "Hjem" },
  saveHome: { EN: "Save home", DA: "Gem hjem" },
  homeName: { EN: "Home name", DA: "Hjemmets navn" },
  address: { EN: "Address (optional)", DA: "Adresse (valgfrit)" },
  homePicture: { EN: "Home picture", DA: "Hjemmets billede" },
  homePictureHint: {
    EN: "Shown beside the home's name and across the top of the dashboard.",
    DA: "Vises ved siden af hjemmets navn og øverst på oversigten.",
  },
  homeNameRequired: { EN: "Give the home a name.", DA: "Giv hjemmet et navn." },

  colour: {
    legend: { EN: "Colour", DA: "Farve" },
    hint: {
      EN: "Worn by everyone in this home, so the household on screen can be told at a glance from the others you are in.",
      DA: "Båret af alle i dette hjem, så husstanden på skærmen kan kendes fra de andre, du er med i, med ét blik.",
    },
    names: {
      SLATE: { EN: "Slate", DA: "Skifer" },
      OCEAN: { EN: "Ocean", DA: "Hav" },
      INDIGO: { EN: "Indigo", DA: "Indigo" },
      VIOLET: { EN: "Violet", DA: "Violet" },
      PLUM: { EN: "Plum", DA: "Blomme" },
      SAND: { EN: "Sand", DA: "Sand" },
    },
  },

  seasonal: {
    label: { EN: "Seasonal touches", DA: "Sæsonens pynt" },
    hint: {
      EN: "A little 🎄 beside the name in December, a 🌷 in spring, and a festive word on the dashboard now and then.",
      DA: "Et lille 🎄 ved navnet i december, en 🌷 om foråret og et festligt ord på forsiden en gang imellem.",
    },
  },
  language: {
    legend: { EN: "Language", DA: "Sprog" },
    hint: {
      EN: "What is already written down stays as it was written — a recipe, a list, a task. This is the language of what happens next: the app itself, and anything imported from here on.",
      DA: "Det, der allerede er skrevet, forbliver som det blev skrevet — en opskrift, en liste, en opgave. Dette er sproget for det, der sker herfra: selve app'en, og alt, der importeres fra nu af.",
    },
    invalid: { EN: "Pick one of the languages offered.", DA: "Vælg et af de tilbudte sprog." },
  },

  selectAHomeFirst: { EN: "Select a home first.", DA: "Vælg først et hjem." },
  manageHomes: { EN: "Manage homes", DA: "Administrer hjem" },
  homeNotFound: { EN: "Home not found.", DA: "Hjemmet blev ikke fundet." },

  remindersHeading: { EN: "Reminders", DA: "Påmindelser" },
  storageHeading: { EN: "Storage", DA: "Lagerplads" },
  aiSpendingHeading: { EN: "AI spending", DA: "AI-forbrug" },
  membersHeading: { EN: "Members", DA: "Medlemmer" },
  inviteSomeoneHeading: { EN: "Invite someone", DA: "Inviter nogen" },

  you: { EN: "(you)", DA: "(dig)" },
  superAdminRole: { EN: "super admin", DA: "superadmin" },
  userRole: { EN: "User", DA: "Bruger" },
  adminRole: { EN: "Admin", DA: "Admin" },
  save: { EN: "Save", DA: "Gem" },
  removeMemberTitle: { EN: "Remove member", DA: "Fjern medlem" },
  remove: { EN: "Remove", DA: "Fjern" },
  removeMemberMessage: {
    EN: "Remove {name} from this home? They keep their account and any other homes they are in, and what they have written here stays.",
    DA: "Fjern {name} fra dette hjem? De beholder deres konto og eventuelle andre hjem, de er i, og det, de har skrevet her, bliver stående.",
  },

  expires: { EN: "expires {date}", DA: "udløber {date}" },

  // invite-link-form.tsx
  inviteExplainer: {
    EN: "Make a link and send it to whoever should join — by text, Messenger or however you talk. Whoever opens it makes an account, or logs in with the one they have, and joins as a member. Make them an admin under Members. The link works for as many people as you choose, and only until it expires.",
    DA: "Lav et link og send det til dem, der skal med — på SMS, Messenger eller hvor I nu skriver. Den der åbner det, opretter sig selv — eller logger ind, hvis de allerede har en konto — og kommer med som bruger. Gør dem til admin under Medlemmer. Linket virker for det antal personer, du vælger, og kun indtil det udløber.",
  },
  linkValidFor: { EN: "Valid for", DA: "Gælder i" },
  linkMaxPeople: { EN: "At most", DA: "Højst antal personer" },
  makingLink: { EN: "Making link…", DA: "Laver link…" },
  makeInviteLink: { EN: "Make invitation link", DA: "Lav invitationslink" },
  linkReady: {
    EN: "The link is ready. It is shown only now — copy it and send it.",
    DA: "Linket er klar. Det vises kun nu — kopiér det og send det.",
  },
  invitationLink: { EN: "Invitation link", DA: "Invitationslink" },
  copyLink: { EN: "Copy link", DA: "Kopiér link" },
  copied: { EN: "Copied ✓", DA: "Kopieret ✓" },
  shareLink: { EN: "Share…", DA: "Del…" },
  shareTitle: { EN: "Join {home}", DA: "Kom med i {home}" },
  linkMadeBy: { EN: "Link · made by {name}", DA: "Link · lavet af {name}" },
  linkUses: {
    EN: "{uses} of {max} used",
    DA: "{uses} af {max} brugt",
  },
  linkUsedUp: { EN: "Used up", DA: "Brugt op" },
  withdrawLinkTitle: { EN: "Withdraw link", DA: "Træk link tilbage" },
  withdraw: { EN: "Withdraw", DA: "Træk tilbage" },
  withdrawLinkMessage: {
    EN: "Withdraw this link? Whoever has it can no longer use it to join. Those who already joined stay.",
    DA: "Træk linket tilbage? Dem, der har det, kan ikke længere bruge det til at komme med. Dem, der allerede er kommet med, bliver.",
  },
  chooseLinkDays: { EN: "Choose how long the link lasts.", DA: "Vælg hvor længe linket gælder." },
  chooseLinkUses: { EN: "Choose how many may use the link.", DA: "Vælg hvor mange der kan bruge linket." },

  // src/app/actions/admin.ts — homeNameRequired above is reused for homeSchema too
  pickAColor: { EN: "Pick one of the colours offered.", DA: "Vælg en af de tilbudte farver." },
  nameCannotBeBlank: { EN: "Your name cannot be blank.", DA: "Dit navn kan ikke være tomt." },
  passwordTooShort: {
    EN: "A new password must be at least 8 characters.",
    DA: "Et nyt kodeord skal være mindst 8 tegn.",
  },
  notYourPassword: { EN: "That is not your current password.", DA: "Det er ikke dit nuværende kodeord." },
} as const satisfies Record<string, Phrase | Record<string, Phrase | Record<string, Phrase>>>;

/** The invitation link form's choices, which count. */
export const LINK_COUNTS = {
  days: {
    EN: { one: "{count} day", other: "{count} days" },
    DA: { one: "{count} dag", other: "{count} dage" },
  },
  people: {
    EN: { one: "{count} person", other: "{count} people" },
    DA: { one: "{count} person", other: "{count} personer" },
  },
} as const satisfies Record<string, Plural>;

/** Settings' "Done" tab: who has done the household's jobs (`src/lib/task-credit.ts`). */
export const TASK_CREDIT = {
  tallyHeading: { EN: "The last {days} days", DA: "De seneste {days} dage" },
  tallyTotal: {
    EN: { one: "{count} job done between you.", other: "{count} jobs done between you." },
    DA: { one: "{count} opgave klaret i alt.", other: "{count} opgaver klaret i alt." },
  },
  formerMember: { EN: "Former members", DA: "Tidligere medlemmer" },
  doneCount: {
    EN: { one: "{count} job", other: "{count} jobs" },
    DA: { one: "{count} opgave", other: "{count} opgaver" },
  },
  recentHeading: { EN: "Recently done", DA: "Klaret for nylig" },
  nobodyYet: {
    EN: "Nothing marked done yet. Every “Mark done” on a task is counted here, with who pressed it.",
    DA: "Intet er markeret klaret endnu. Hver gang nogen trykker “Marker som klaret” på en opgave, tælles det her, med hvem der trykkede.",
  },
} as const satisfies Record<string, Phrase | Plural>;

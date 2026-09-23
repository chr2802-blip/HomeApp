import type { StorageKind } from "@/lib/storage";
import type { Phrase } from "./say";

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
  revoke: { EN: "Revoke", DA: "Tilbagekald" },

  // invite-form.tsx
  emailToInvite: { EN: "Email to invite", DA: "E-mail der skal inviteres" },
  role: { EN: "Role", DA: "Rolle" },
  creating: { EN: "Creating…", DA: "Opretter…" },
  createInvite: { EN: "Create invite", DA: "Opret invitation" },
  invitationReadyFor: { EN: "Invitation ready for {email}", DA: "Invitation klar til {email}" },
  sendCodeYourself: {
    EN: "Send them this code yourself. They sign up at /accept-invite using that exact email plus this code. The code is shown once — create a new invite if it gets lost.",
    DA: "Send dem selv denne kode. De opretter sig på /accept-invite med netop den e-mail plus denne kode. Koden vises kun én gang — opret en ny invitation, hvis den bliver væk.",
  },

  // src/app/actions/admin.ts — homeNameRequired above is reused for homeSchema too
  pickAColor: { EN: "Pick one of the colours offered.", DA: "Vælg en af de tilbudte farver." },
  nameCannotBeBlank: { EN: "Your name cannot be blank.", DA: "Dit navn kan ikke være tomt." },
  passwordTooShort: {
    EN: "A new password must be at least 8 characters.",
    DA: "Et nyt kodeord skal være mindst 8 tegn.",
  },
  notYourPassword: { EN: "That is not your current password.", DA: "Det er ikke dit nuværende kodeord." },
  notAllowed: { EN: "Not allowed.", DA: "Ikke tilladt." },
  invalidEmail: { EN: "Enter a valid email address.", DA: "Indtast en gyldig e-mailadresse." },
  alreadyInHome: { EN: "They are already in this home.", DA: "De er allerede i dette hjem." },
} as const satisfies Record<string, Phrase | Record<string, Phrase>>;

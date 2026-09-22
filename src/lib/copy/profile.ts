import type { Phrase } from "./say";

/** `/profile` — a person's own name, password, picture and notifications. */
export const PROFILE = {
  title: { EN: "Profile", DA: "Profil" },
  description: { EN: "You, wherever this app names you.", DA: "Dig, hvor end app'en nævner dig." },

  yourDetailsHeading: { EN: "Your details", DA: "Dine oplysninger" },
  saveProfile: { EN: "Save profile", DA: "Gem profil" },
  name: { EN: "Name", DA: "Navn" },
  newPassword: { EN: "New password", DA: "Nyt kodeord" },
  leaveBlankToKeep: { EN: "Leave blank to keep", DA: "Lad stå tomt for at beholde" },
  currentPassword: { EN: "Current password", DA: "Nuværende kodeord" },
  onlyNeededForNewPassword: {
    EN: "Only needed to set a new password",
    DA: "Kun nødvendigt for at sætte et nyt kodeord",
  },
  changingPasswordSignsOut: {
    EN: "Changing your password signs out any other device still using the old one.",
    DA: "Skifter du kodeord, logges alle andre enheder ud, der stadig bruger det gamle.",
  },
  email: { EN: "Email", DA: "E-mail" },
  yourPicture: { EN: "Your picture", DA: "Dit billede" },
  yourPictureHint: {
    EN: "Shown beside your name to the people you share a home with.",
    DA: "Vises ved siden af jeres navn for dem, I deler et hjem med.",
  },

  notificationsHeading: { EN: "Notifications", DA: "Notifikationer" },
  remindersSentHint: {
    EN: "Reminders are sent when a task in one of your homes falls due. Send one now to check this browser is receiving them.",
    DA: "Påmindelser sendes, når en opgave i et af jeres hjem forfalder. Send en nu for at tjekke, om denne browser modtager dem.",
  },

  yourHomesHeading: { EN: "Your homes", DA: "Jeres hjem" },
} as const satisfies Record<string, Phrase>;

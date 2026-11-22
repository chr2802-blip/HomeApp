import type { Phrase, Plural } from "./say";

/** `/login` and `/join/<token>` — reached before there is a session, so these read
 *  through `currentLanguage()` rather than a page's own `user.homeLanguage`. */
export const AUTH = {
  logInToYourHome: { EN: "Log in to your home.", DA: "Log ind i jeres hjem." },
  openYourInviteLink: {
    EN: "Invited? Open the link you were sent, and you can make your account there.",
    DA: "Inviteret? Åbn det link, du har fået, så kan du oprette dig der.",
  },

  email: { EN: "Email", DA: "E-mail" },
  password: { EN: "Password", DA: "Kodeord" },
  loggingIn: { EN: "Logging in…", DA: "Logger ind…" },
  logIn: { EN: "Log in", DA: "Log ind" },

  // src/app/join/[token]
  invitation: { EN: "Invitation", DA: "Invitation" },
  joinHomeTitle: { EN: "Join {home}", DA: "Kom med i {home}" },
  joinHomeHint: {
    EN: "Make an account, and you are in the home.",
    DA: "Opret dig, så er du med i hjemmet.",
  },
  alreadyInThisHome: { EN: "You are already in {home}.", DA: "Du er allerede med i {home}." },
  loggedInAs: { EN: "You are logged in as {name}.", DA: "Du er logget ind som {name}." },
  notYou: { EN: "Not you?", DA: "Ikke dig?" },
  goToHome: { EN: "Go to {home}", DA: "Gå til {home}" },
  oneMoment: { EN: "One moment…", DA: "Et øjeblik…" },
  toLogin: { EN: "Go to login", DA: "Til login" },
  yourName: { EN: "Your name", DA: "Dit navn" },
  joinPasswordHint: {
    EN: "At least 8 characters. Already have an account? Enter the password you have.",
    DA: "Mindst 8 tegn. Har du allerede en konto, så skriv dit nuværende kodeord.",
  },
  joining: { EN: "Creating…", DA: "Opretter…" },
  joinAndCreate: { EN: "Create me and join", DA: "Opret mig og kom med" },
  linkUnknown: {
    EN: "This link does not work. Perhaps it was withdrawn — ask for a new one.",
    DA: "Linket virker ikke. Måske er det trukket tilbage — bed om et nyt.",
  },
  linkExpired: { EN: "This link has expired. Ask for a new one.", DA: "Linket er udløbet. Bed om et nyt." },
  linkUsedUp: { EN: "This link has been used up. Ask for a new one.", DA: "Linket er brugt op. Bed om et nyt." },

  // src/app/actions/auth.ts
  invalidEmailAndPassword: {
    EN: "Enter a valid email and password.",
    DA: "Indtast en gyldig e-mail og kodeord.",
  },
  tooManyAttempts: {
    EN: { one: "Too many failed attempts. Try again in {minutes} minute.", other: "Too many failed attempts. Try again in {minutes} minutes." },
    DA: { one: "For mange mislykkede forsøg. Prøv igen om {minutes} minut.", other: "For mange mislykkede forsøg. Prøv igen om {minutes} minutter." },
  },
  wrongEmailOrPassword: { EN: "Wrong email or password.", DA: "Forkert e-mail eller kodeord." },
  enterYourName: { EN: "Enter your name.", DA: "Indtast dit navn." },
  passwordMinLength: {
    EN: "Password must be at least 8 characters.",
    DA: "Kodeordet skal være mindst 8 tegn.",
  },
  checkFormAndRetry: { EN: "Check the form and try again.", DA: "Tjek formularen og prøv igen." },
  tooManyAccounts: {
    EN: { one: "Many accounts have been made from here in a short time. Try again in {minutes} minute.", other: "Many accounts have been made from here in a short time. Try again in {minutes} minutes." },
    DA: { one: "Der er oprettet mange konti herfra på kort tid. Prøv igen om {minutes} minut.", other: "Der er oprettet mange konti herfra på kort tid. Prøv igen om {minutes} minutter." },
  },
  accountExistsWrongPassword: {
    EN: "That email already has an account. Enter its password to join this home.",
    DA: "Den e-mail har allerede en konto. Indtast dens kodeord for at tilslutte dig dette hjem.",
  },
} as const satisfies Record<string, Phrase | Plural>;

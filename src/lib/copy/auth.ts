import type { Phrase, Plural } from "./say";

/** `/login` and `/accept-invite` — reached before there is a session, so these read
 *  through `currentLanguage()` rather than a page's own `user.homeLanguage`. */
export const AUTH = {
  logInToYourHome: { EN: "Log in to your home.", DA: "Log ind i jeres hjem." },
  gotAnInvitationCode: { EN: "Got an invitation code?", DA: "Har du en invitationskode?" },
  createYourAccount: { EN: "Create your account", DA: "Opret din konto" },

  email: { EN: "Email", DA: "E-mail" },
  password: { EN: "Password", DA: "Kodeord" },
  loggingIn: { EN: "Logging in…", DA: "Logger ind…" },
  logIn: { EN: "Log in", DA: "Log ind" },

  joinAHome: { EN: "Join a home", DA: "Deltag i et hjem" },
  joinHint: {
    EN: "Enter the email you were invited with and the code you were given. The home joins the ones you are already in.",
    DA: "Indtast den e-mail, du blev inviteret med, og den kode, du fik. Hjemmet føjes til dem, du allerede er i.",
  },
  createAccountHint: {
    EN: "Enter the email you were invited with and the code your home admin gave you.",
    DA: "Indtast den e-mail, du blev inviteret med, og koden din hjemmeadmin gav dig.",
  },
  backToYourHomes: { EN: "Back to your homes", DA: "Tilbage til jeres hjem" },
  alreadyHaveAccount: { EN: "Already have an account?", DA: "Har du allerede en konto?" },

  invitedEmail: { EN: "Invited email", DA: "Inviteret e-mail" },
  invitationCode: { EN: "Invitation code", DA: "Invitationskode" },
  yourName: { EN: "Your name", DA: "Dit navn" },
  yourPassword: { EN: "Your password", DA: "Dit kodeord" },
  choosePassword: { EN: "Choose a password", DA: "Vælg et kodeord" },
  passwordOnAccountHint: {
    EN: "The password on your account, so nobody else can join a home as you.",
    DA: "Kodeordet på din konto, så ingen andre kan tilslutte sig et hjem som dig.",
  },
  newPasswordHint: {
    EN: "At least 8 characters. If that email already has an account, give its password instead and the home is added to it.",
    DA: "Mindst 8 tegn. Hvis den e-mail allerede har en konto, skal du i stedet give dens kodeord, så tilføjes hjemmet til den.",
  },
  joining: { EN: "Joining…", DA: "Tilslutter…" },
  joinHome: { EN: "Join home", DA: "Tilslut hjem" },
  createAccount: { EN: "Create account", DA: "Opret konto" },

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
  noMatchingInvite: {
    EN: "That email and code don't match an open invitation.",
    DA: "Den e-mail og kode matcher ikke en åben invitation.",
  },
  accountExistsWrongPassword: {
    EN: "That email already has an account. Enter its password to join this home.",
    DA: "Den e-mail har allerede en konto. Indtast dens kodeord for at tilslutte dig dette hjem.",
  },
} as const satisfies Record<string, Phrase | Plural>;

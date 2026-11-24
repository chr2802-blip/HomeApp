import type { Phrase } from "./say";

/**
 * The tab bar's menu, and the two places in the bar a person chooses for themselves —
 * both in the drawer behind the menu and on `/profile`.
 */
export const NAV = {
  menu: { EN: "Menu", DA: "Menu" },
  closeMenu: { EN: "Close menu", DA: "Luk menu" },
  allTabs: { EN: "All tabs", DA: "Alle faner" },
  hint: {
    EN: "Pin two tabs to the tab bar. Home and + are always there.",
    DA: "Fastgør to faner til bundbaren. Hjem og + er der altid.",
  },
  inBar: { EN: "In the tab bar", DA: "I bundbaren" },
  moreTabs: { EN: "More tabs", DA: "Flere faner" },
  place: { EN: "Place {n}", DA: "Plads {n}" },
  pin: { EN: "Pin", DA: "Fastgør" },
  pinNamed: { EN: "Pin {name} to the tab bar", DA: "Fastgør {name} til bundbaren" },
  barFull: {
    EN: "The tab bar is full. Which one should make way?",
    DA: "Bundbaren er fuld. Hvilken skal vige?",
  },
  replace: { EN: "Replace {name}", DA: "Erstat {name}" },
  swap: { EN: "Swap the two", DA: "Byt om på de to" },
  youAreHere: { EN: "You are here", DA: "Du er her" },
  profileHeading: { EN: "Tab bar", DA: "Bundbar" },
  profileHint: {
    EN: "The two tabs between Home and the menu, on every phone you use.",
    DA: "De to faner mellem Hjem og menuen, på alle de telefoner du bruger.",
  },
} as const satisfies Record<string, Phrase>;

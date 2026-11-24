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
    EN: "Drag a tab up onto one of the two places in the tab bar. Home and + are always there.",
    DA: "Træk en fane op på en af de to pladser i bundbaren. Hjem og + er der altid.",
  },
  dragNamed: { EN: "Move {name}", DA: "Flyt {name}" },
  dragPicked: { EN: "Picked up {name}.", DA: "{name} er samlet op." },
  dragOver: { EN: "Over {name}.", DA: "Over {name}." },
  dragDropped: { EN: "Dropped. The tab bar has changed.", DA: "Sluppet. Bundbaren er ændret." },
  dragCancelled: { EN: "Put back where it was.", DA: "Lagt tilbage, hvor den var." },
  dragInstructions: {
    EN: "Press space to pick a tab up, the arrow keys to move it onto a place, and space to drop it.",
    DA: "Tryk mellemrum for at samle en fane op, piletasterne for at flytte den hen på en plads, og mellemrum for at slippe.",
  },
  inBar: { EN: "In the tab bar", DA: "I bundbaren" },
  moreTabs: { EN: "More tabs", DA: "Flere faner" },
  place: { EN: "Place {n}", DA: "Plads {n}" },
  youAreHere: { EN: "You are here", DA: "Du er her" },
  profileHeading: { EN: "Tab bar", DA: "Bundbar" },
  profileHint: {
    EN: "The two tabs between Home and the menu, on every phone you use.",
    DA: "De to faner mellem Hjem og menuen, på alle de telefoner du bruger.",
  },
} as const satisfies Record<string, Phrase>;

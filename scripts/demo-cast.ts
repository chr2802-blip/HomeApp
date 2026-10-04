/**
 * Who and what `npm run db:demo` makes, read by `npm run screenshot` as well — so the
 * screenshot script can ask for a home by its short key without the two disagreeing
 * about what it is called.
 */
export const DEMO_PASSWORD = "demo-password";

export const DEMO_PEOPLE = {
  alex: { email: "alex@demo.test", name: "Alex" },
  sam: { email: "sam@demo.test", name: "Sam" },
} as const;

export type DemoPerson = keyof typeof DEMO_PEOPLE;

export const DEMO_HOMES = {
  flat: { name: "The Flat", language: "EN", theme: "OCEAN", livedIn: true },
  da: { name: "Sommerhuset", language: "DA", theme: "SAND", livedIn: true },
  empty: { name: "Empty home", language: "EN", theme: "PLUM", livedIn: false },
} as const;

export type DemoHomeKey = keyof typeof DEMO_HOMES;

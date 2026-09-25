import type { HomeLanguage, PantryCategory, PantryUnit } from "@prisma/client";
import type { Phrase } from "./copy/say";
import { pantryKey } from "./pantry";

/**
 * The basic goods almost every kitchen keeps, with the shelf each one sits on and what it
 * is usually counted in.
 *
 * It answers two questions for the add box, both instantly and for free: "which of these
 * did you mean" (the suggestions under the name, for somebody who has not typed the salt
 * in yet) and "where does this go" (the shelf and unit a new entry starts with). Only a
 * name this list has never heard of is left for the model — `sortPantry`, after the add —
 * so the everyday case never waits on anything and never costs anything.
 *
 * A name is its two languages on one line, the same rule as the phrase catalogue, and
 * matching accepts either: a Danish home that types "Cumin" still gets its spices shelf.
 * `also` is spellings a household plausibly types for the same good and that are not a
 * translation ("Sort peber" for "Peber").
 *
 * No `src/lib` module reaches for the catalogue, and nor does this: which language a
 * suggestion is written in is the caller's argument.
 */
export type PantryGood = {
  name: Phrase;
  category: PantryCategory;
  unit: PantryUnit | null;
  also?: string[];
};

const good = (EN: string, DA: string, category: PantryCategory, unit: PantryUnit | null, also?: string[]): PantryGood => ({
  name: { EN, DA },
  category,
  unit,
  also,
});

export const PANTRY_GOODS: PantryGood[] = [
  // Spices & herbs — a jar each, which is how a spice rack counts.
  good("Salt", "Salt", "SPICES", "PACK", ["Havsalt", "Flagesalt", "Sea salt", "Flaky salt"]),
  good("Pepper", "Peber", "SPICES", "JAR", ["Sort peber", "Black pepper"]),
  good("Paprika", "Paprika", "SPICES", "JAR"),
  good("Cumin", "Spidskommen", "SPICES", "JAR"),
  good("Cinnamon", "Kanel", "SPICES", "JAR"),
  good("Curry powder", "Karry", "SPICES", "JAR", ["Curry"]),
  good("Oregano", "Oregano", "SPICES", "JAR"),
  good("Thyme", "Timian", "SPICES", "JAR"),
  good("Chilli flakes", "Chiliflager", "SPICES", "JAR", ["Chili flakes"]),
  good("Turmeric", "Gurkemeje", "SPICES", "JAR"),
  good("Coriander seeds", "Korianderfrø", "SPICES", "JAR"),
  good("Cardamom", "Kardemomme", "SPICES", "JAR"),
  good("Nutmeg", "Muskatnød", "SPICES", "JAR"),
  good("Bay leaves", "Laurbærblade", "SPICES", "JAR"),
  good("Garam masala", "Garam masala", "SPICES", "JAR"),
  good("Ginger powder", "Ingefær, stødt", "SPICES", "JAR"),
  good("Rosemary", "Rosmarin", "SPICES", "JAR"),
  good("Stock cubes", "Bouillonterninger", "SPICES", "PACK", ["Bouillon", "Stock"]),
  good("Vanilla sugar", "Vaniljesukker", "BAKING", "JAR"),

  // Oil & vinegar.
  good("Olive oil", "Olivenolie", "OIL_VINEGAR", "L"),
  good("Rapeseed oil", "Rapsolie", "OIL_VINEGAR", "L", ["Neutral olie", "Vegetable oil"]),
  good("Sesame oil", "Sesamolie", "OIL_VINEGAR", null),
  good("Vinegar", "Eddike", "OIL_VINEGAR", "L", ["Lagereddike"]),
  good("Balsamic vinegar", "Balsamico", "OIL_VINEGAR", null, ["Balsamicoeddike"]),
  good("White wine vinegar", "Hvidvinseddike", "OIL_VINEGAR", null),

  // Sauces & condiments.
  good("Soy sauce", "Sojasauce", "SAUCES", null, ["Soja"]),
  good("Ketchup", "Ketchup", "SAUCES", null),
  good("Mustard", "Sennep", "SAUCES", null, ["Dijonsennep", "Dijon mustard"]),
  good("Mayonnaise", "Mayonnaise", "SAUCES", null),
  good("Honey", "Honning", "SAUCES", "JAR"),
  good("Fish sauce", "Fiskesauce", "SAUCES", null),
  good("Sriracha", "Sriracha", "SAUCES", null),
  good("Tomato paste", "Tomatpuré", "SAUCES", null, ["Tomatkoncentrat", "Tomato purée"]),

  // Baking.
  good("Flour", "Hvedemel", "BAKING", "KG", ["Mel", "Plain flour"]),
  good("Sugar", "Sukker", "BAKING", "KG", ["Rørsukker"]),
  good("Icing sugar", "Flormelis", "BAKING", null),
  good("Brown sugar", "Farin", "BAKING", null, ["Brun farin"]),
  good("Baking powder", "Bagepulver", "BAKING", "PACK"),
  good("Bicarbonate of soda", "Natron", "BAKING", "PACK", ["Baking soda"]),
  good("Yeast", "Gær", "BAKING", "PACK", ["Tørgær", "Dry yeast"]),
  good("Cocoa powder", "Kakao", "BAKING", null, ["Kakaopulver"]),
  good("Cornflour", "Majsstivelse", "BAKING", null, ["Maizena", "Cornstarch"]),
  good("Oats", "Havregryn", "DRY_GOODS", "KG", ["Rolled oats"]),

  // Pasta, rice & grains.
  good("Rice", "Ris", "DRY_GOODS", "KG", ["Jasminris", "Basmatiris", "Jasmine rice", "Basmati rice"]),
  good("Pasta", "Pasta", "DRY_GOODS", "BAG", ["Spaghetti", "Penne"]),
  good("Couscous", "Couscous", "DRY_GOODS", "BAG"),
  good("Bulgur", "Bulgur", "DRY_GOODS", "BAG"),
  good("Quinoa", "Quinoa", "DRY_GOODS", "BAG"),
  good("Lentils", "Linser", "DRY_GOODS", "BAG", ["Røde linser", "Red lentils"]),
  good("Noodles", "Nudler", "DRY_GOODS", "PACK", ["Ægnudler", "Egg noodles"]),
  good("Breadcrumbs", "Rasp", "DRY_GOODS", "BAG"),

  // Tins & jars.
  good("Chopped tomatoes", "Hakkede tomater", "TINS_JARS", "CAN", ["Tinned tomatoes", "Flåede tomater"]),
  good("Coconut milk", "Kokosmælk", "TINS_JARS", "CAN"),
  good("Chickpeas", "Kikærter", "TINS_JARS", "CAN"),
  good("Kidney beans", "Kidneybønner", "TINS_JARS", "CAN"),
  good("Tuna", "Tun", "TINS_JARS", "CAN"),
  good("Passata", "Passata", "TINS_JARS", null),
  good("Jam", "Syltetøj", "TINS_JARS", "JAR", ["Marmelade"]),
  good("Peanut butter", "Peanutbutter", "TINS_JARS", "JAR", ["Jordnøddesmør"]),

  // Fridge.
  good("Butter", "Smør", "FRIDGE", "PACK"),
  good("Milk", "Mælk", "FRIDGE", "L", ["Letmælk", "Sødmælk"]),
  good("Eggs", "Æg", "FRIDGE", null),
  good("Cream", "Fløde", "FRIDGE", "DL", ["Piskefløde", "Madlavningsfløde"]),
  good("Parmesan", "Parmesan", "FRIDGE", null),
  good("Cheese", "Ost", "FRIDGE", null, ["Revet ost", "Grated cheese"]),
  good("Greek yoghurt", "Græsk yoghurt", "FRIDGE", null),
  good("Garlic", "Hvidløg", "FRIDGE", null),
  good("Lemons", "Citroner", "FRIDGE", null, ["Citron", "Lemon"]),

  // Freezer.
  good("Frozen peas", "Frosne ærter", "FREEZER", "BAG", ["Ærter", "Peas"]),
  good("Frozen spinach", "Frossen spinat", "FREEZER", "BAG"),
  good("Minced meat", "Hakket oksekød", "FREEZER", null, ["Hakket kød", "Mince"]),

  // Drinks.
  good("Coffee", "Kaffe", "DRINKS", "BAG"),
  good("Tea", "Te", "DRINKS", "PACK"),

  // Other.
  good("Onions", "Løg", "OTHER", null, ["Løg", "Onion"]),
  good("Potatoes", "Kartofler", "OTHER", "KG", ["Potato"]),
];

/** Every spelling a good answers to, as keys — built once, since the add box asks per keystroke. */
const BY_KEY: Map<string, PantryGood> = (() => {
  const map = new Map<string, PantryGood>();
  for (const entry of PANTRY_GOODS) {
    for (const spelling of [entry.name.EN, entry.name.DA, ...(entry.also ?? [])]) {
      const key = pantryKey(spelling);
      if (key && !map.has(key)) map.set(key, entry);
    }
  }
  return map;
})();

/**
 * The good a name is, or null where this list has never heard of it.
 *
 * Exact first, and then the longest contiguous run of the name's own whole words — the
 * same shape of match `matchedStockedKey` makes against the pantry, for the same reason:
 * "røget paprika" is still paprika and still goes on the spice shelf, and "hvidløg" is
 * never "løg", because only whole words move. Guessing a shelf from a qualifier dropped is
 * a much smaller bet than keeping a line off the shopping list, which is why this makes it
 * without asking and `stripStocked` does not.
 */
export function lookupGood(name: string): PantryGood | null {
  const key = pantryKey(name);
  if (!key) return null;
  const exact = BY_KEY.get(key);
  if (exact) return exact;

  const words = key.split(/\s+/).filter(Boolean);
  for (let length = words.length - 1; length > 0; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const found = BY_KEY.get(words.slice(start, start + length).join(" "));
      if (found) return found;
    }
  }
  return null;
}

/**
 * The goods a half-typed name could be, written in the household's own language — the
 * add box's second group of suggestions. Anything the pantry already keeps is left out
 * by the caller, which knows what that is.
 *
 * A good one of whose words *starts* with what was typed comes before one that merely
 * contains it somewhere: "sa" is far more likely to be salt than garam masala.
 */
export function goodsMatching(query: string, language: HomeLanguage, limit: number): string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const starts: string[] = [];
  const contains: string[] = [];
  for (const entry of PANTRY_GOODS) {
    const spellings = [entry.name[language], entry.name.EN, entry.name.DA, ...(entry.also ?? [])].map(
      (spelling) => spelling.toLowerCase(),
    );
    if (spellings.some((spelling) => spelling.split(/\s+/).some((word) => word.startsWith(needle)))) {
      starts.push(entry.name[language]);
    } else if (spellings.some((spelling) => spelling.includes(needle))) {
      contains.push(entry.name[language]);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

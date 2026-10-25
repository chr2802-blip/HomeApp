import type { HomeLanguage, PantryCategory, PantryMeasure } from "@prisma/client";
import type { Phrase } from "./copy/say";
import { pantryKey } from "./pantry";

/**
 * The basic goods almost every kitchen keeps, with the shelf each one sits on and how it
 * is usually kept: counted in uses (rice, a tin, an onion) or simply had (salt, oil).
 *
 * It answers two questions for the add box, both instantly and for free: "which of these
 * did you mean" (the suggestions under the name, for somebody who has not typed the salt
 * in yet) and "where does this go" (the shelf and the way of keeping a new entry starts with). Only a
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
  measure: PantryMeasure;
  also?: string[];
};

const good = (EN: string, DA: string, category: PantryCategory, measure: PantryMeasure, also?: string[]): PantryGood => ({
  name: { EN, DA },
  category,
  measure,
  also,
});

export const PANTRY_GOODS: PantryGood[] = [
  // Spices & herbs — had or not, which is how a spice rack is kept.
  good("Salt", "Salt", "SPICES", "ENDLESS", ["Havsalt", "Flagesalt", "Sea salt", "Flaky salt"]),
  good("Pepper", "Peber", "SPICES", "ENDLESS", ["Sort peber", "Black pepper"]),
  good("Paprika", "Paprika", "SPICES", "ENDLESS"),
  good("Cumin", "Spidskommen", "SPICES", "ENDLESS"),
  good("Cinnamon", "Kanel", "SPICES", "ENDLESS"),
  good("Curry powder", "Karry", "SPICES", "ENDLESS", ["Curry"]),
  good("Oregano", "Oregano", "SPICES", "ENDLESS"),
  good("Thyme", "Timian", "SPICES", "ENDLESS"),
  good("Chilli flakes", "Chiliflager", "SPICES", "ENDLESS", ["Chili flakes"]),
  good("Turmeric", "Gurkemeje", "SPICES", "ENDLESS"),
  good("Coriander seeds", "Korianderfrø", "SPICES", "ENDLESS"),
  good("Cardamom", "Kardemomme", "SPICES", "ENDLESS"),
  good("Nutmeg", "Muskatnød", "SPICES", "ENDLESS"),
  good("Bay leaves", "Laurbærblade", "SPICES", "ENDLESS"),
  good("Garam masala", "Garam masala", "SPICES", "ENDLESS"),
  good("Ginger powder", "Ingefær, stødt", "SPICES", "ENDLESS"),
  good("Rosemary", "Rosmarin", "SPICES", "ENDLESS"),
  good("Stock cubes", "Bouillonterninger", "SPICES", "ENDLESS", ["Bouillon", "Stock"]),
  good("Vanilla sugar", "Vaniljesukker", "BAKING", "ENDLESS"),

  // Oil & vinegar.
  good("Olive oil", "Olivenolie", "OIL_VINEGAR", "ENDLESS"),
  good("Rapeseed oil", "Rapsolie", "OIL_VINEGAR", "ENDLESS", ["Neutral olie", "Vegetable oil"]),
  good("Sesame oil", "Sesamolie", "OIL_VINEGAR", "ENDLESS"),
  good("Vinegar", "Eddike", "OIL_VINEGAR", "ENDLESS", ["Lagereddike"]),
  good("Balsamic vinegar", "Balsamico", "OIL_VINEGAR", "ENDLESS", ["Balsamicoeddike"]),
  good("White wine vinegar", "Hvidvinseddike", "OIL_VINEGAR", "ENDLESS"),

  // Sauces & condiments.
  good("Soy sauce", "Sojasauce", "SAUCES", "ENDLESS", ["Soja"]),
  good("Ketchup", "Ketchup", "SAUCES", "ENDLESS"),
  good("Mustard", "Sennep", "SAUCES", "ENDLESS", ["Dijonsennep", "Dijon mustard"]),
  good("Mayonnaise", "Mayonnaise", "SAUCES", "ENDLESS"),
  good("Honey", "Honning", "SAUCES", "ENDLESS"),
  good("Fish sauce", "Fiskesauce", "SAUCES", "ENDLESS"),
  good("Sriracha", "Sriracha", "SAUCES", "ENDLESS"),
  good("Tomato paste", "Tomatpuré", "SAUCES", "ENDLESS", ["Tomatkoncentrat", "Tomato purée"]),

  // Baking.
  good("Flour", "Hvedemel", "BAKING", "ENDLESS", ["Mel", "Plain flour"]),
  good("Sugar", "Sukker", "BAKING", "ENDLESS", ["Rørsukker"]),
  good("Icing sugar", "Flormelis", "BAKING", "ENDLESS"),
  good("Brown sugar", "Farin", "BAKING", "ENDLESS", ["Brun farin"]),
  good("Baking powder", "Bagepulver", "BAKING", "ENDLESS"),
  good("Bicarbonate of soda", "Natron", "BAKING", "ENDLESS", ["Baking soda"]),
  good("Yeast", "Gær", "BAKING", "ENDLESS", ["Tørgær", "Dry yeast"]),
  good("Cocoa powder", "Kakao", "BAKING", "ENDLESS", ["Kakaopulver"]),
  good("Cornflour", "Majsstivelse", "BAKING", "ENDLESS", ["Maizena", "Cornstarch"]),
  good("Oats", "Havregryn", "DRY_GOODS", "PIECES", ["Rolled oats"]),

  // Pasta, rice & grains.
  good("Rice", "Ris", "DRY_GOODS", "PIECES", ["Jasminris", "Basmatiris", "Jasmine rice", "Basmati rice"]),
  good("Pasta", "Pasta", "DRY_GOODS", "PIECES", ["Spaghetti", "Penne"]),
  good("Couscous", "Couscous", "DRY_GOODS", "PIECES"),
  good("Bulgur", "Bulgur", "DRY_GOODS", "PIECES"),
  good("Quinoa", "Quinoa", "DRY_GOODS", "PIECES"),
  good("Lentils", "Linser", "DRY_GOODS", "PIECES", ["Røde linser", "Red lentils"]),
  good("Noodles", "Nudler", "DRY_GOODS", "PIECES", ["Ægnudler", "Egg noodles"]),
  good("Breadcrumbs", "Rasp", "DRY_GOODS", "ENDLESS"),

  // Tins & jars.
  good("Chopped tomatoes", "Hakkede tomater", "TINS_JARS", "PIECES", ["Tinned tomatoes", "Flåede tomater"]),
  good("Coconut milk", "Kokosmælk", "TINS_JARS", "PIECES"),
  good("Chickpeas", "Kikærter", "TINS_JARS", "PIECES"),
  good("Kidney beans", "Kidneybønner", "TINS_JARS", "PIECES"),
  good("Tuna", "Tun", "TINS_JARS", "PIECES"),
  good("Passata", "Passata", "TINS_JARS", "PIECES"),
  good("Jam", "Syltetøj", "TINS_JARS", "ENDLESS", ["Marmelade"]),
  good("Peanut butter", "Peanutbutter", "TINS_JARS", "ENDLESS", ["Jordnøddesmør"]),

  // Fridge.
  good("Butter", "Smør", "FRIDGE", "ENDLESS"),
  good("Milk", "Mælk", "FRIDGE", "ENDLESS", ["Letmælk", "Sødmælk"]),
  good("Eggs", "Æg", "FRIDGE", "ENDLESS"),
  good("Cream", "Fløde", "FRIDGE", "PIECES", ["Piskefløde", "Madlavningsfløde"]),
  good("Parmesan", "Parmesan", "FRIDGE", "ENDLESS"),
  good("Cheese", "Ost", "FRIDGE", "ENDLESS", ["Revet ost", "Grated cheese"]),
  good("Greek yoghurt", "Græsk yoghurt", "FRIDGE", "ENDLESS"),
  good("Garlic", "Hvidløg", "FRIDGE", "ENDLESS"),
  good("Lemons", "Citroner", "FRIDGE", "ENDLESS", ["Citron", "Lemon"]),

  // Freezer.
  good("Frozen peas", "Frosne ærter", "FREEZER", "PIECES", ["Ærter", "Peas"]),
  good("Frozen spinach", "Frossen spinat", "FREEZER", "PIECES"),
  good("Minced meat", "Hakket oksekød", "FREEZER", "PIECES", ["Hakket kød", "Mince"]),

  // Drinks.
  good("Coffee", "Kaffe", "DRINKS", "PIECES"),
  good("Tea", "Te", "DRINKS", "ENDLESS"),

  // Baby.
  good("Baby formula", "Modermælkserstatning", "BABY", "ENDLESS", ["Formula", "Mælkepulver"]),
  good("Baby food", "Babymos", "BABY", "ENDLESS", ["Babymad", "Babygrød", "Klemmepose"]),
  good("Nappies", "Bleer", "BABY", "ENDLESS", ["Diapers", "Ble"]),
  good("Baby wipes", "Vådservietter", "BABY", "ENDLESS", ["Wipes", "Vådserviet"]),

  // Bathroom.
  good("Toilet paper", "Toiletpapir", "BATHROOM", "ENDLESS", ["Toiletrulle", "Toilet roll"]),
  good("Hand soap", "Håndsæbe", "BATHROOM", "ENDLESS", ["Sæbe", "Soap"]),
  good("Shampoo", "Shampoo", "BATHROOM", "ENDLESS"),
  good("Conditioner", "Balsam", "BATHROOM", "ENDLESS"),
  good("Shower gel", "Brusesæbe", "BATHROOM", "ENDLESS", ["Bodyshampoo", "Body wash"]),
  good("Toothpaste", "Tandpasta", "BATHROOM", "ENDLESS"),
  good("Toothbrushes", "Tandbørster", "BATHROOM", "ENDLESS", ["Tandbørste", "Toothbrush"]),
  good("Deodorant", "Deodorant", "BATHROOM", "ENDLESS", ["Deo"]),
  good("Cotton pads", "Vatrondeller", "BATHROOM", "ENDLESS", ["Vatrondel"]),
  good("Plasters", "Plastre", "BATHROOM", "ENDLESS", ["Plaster", "Band-aids"]),

  // Cleaning.
  good("Washing-up liquid", "Opvaskemiddel", "CLEANING", "ENDLESS", ["Dish soap", "Sulfo"]),
  good("Dishwasher tablets", "Opvasketabs", "CLEANING", "ENDLESS", ["Opvaskemaskinetabs", "Tabs"]),
  good("Laundry detergent", "Vaskemiddel", "CLEANING", "ENDLESS", ["Vaskepulver", "Washing powder"]),
  good("Fabric softener", "Skyllemiddel", "CLEANING", "ENDLESS"),
  good("All-purpose cleaner", "Universalrengøring", "CLEANING", "ENDLESS", ["Rengøringsmiddel", "Cleaning spray"]),
  good("Toilet cleaner", "Toiletrens", "CLEANING", "ENDLESS"),
  good("Sponges", "Svampe", "CLEANING", "ENDLESS", ["Svamp", "Sponge", "Opvaskesvampe"]),
  good("Cloths", "Klude", "CLEANING", "ENDLESS", ["Karklude", "Karklud", "Dish cloths"]),
  good("Bin bags", "Affaldsposer", "CLEANING", "ENDLESS", ["Skraldeposer", "Bin liners"]),
  good("Paper towels", "Køkkenrulle", "CLEANING", "ENDLESS", ["Kitchen roll"]),

  // Other.
  good("Onions", "Løg", "OTHER", "PIECES", ["Løg", "Onion"]),
  good("Potatoes", "Kartofler", "OTHER", "PIECES", ["Potato"]),
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

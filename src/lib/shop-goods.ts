import type { PantryCategory, ShopAisle } from "@prisma/client";
import { pantryKey } from "./pantry";
import { PANTRY_GOODS } from "./pantry-goods";
import { SHOP_AISLE_LABELS } from "./copy/lists";

/** Every aisle, in the order a shop is walked and a grouped list is drawn. */
export const SHOP_AISLES = Object.keys(SHOP_AISLE_LABELS) as [ShopAisle, ...ShopAisle[]];

export function isShopAisle(value: string): value is ShopAisle {
  return (SHOP_AISLES as readonly string[]).includes(value);
}

/**
 * Which aisle of a shop the everyday things on a shopping list are found in — the free,
 * instant half of grouping a list by aisle. Only a name neither this list nor a stored
 * `AisleChoice` knows is left for the model (`sortListAisles`, after the fact).
 *
 * Two sources, one answer. The pantry's basics already say which shelf each sits on at
 * home, and a shelf at home is an aisle in the shop often enough to read it across
 * (`AISLE_OF_SHELF`); what the pantry never keeps — vegetables, meat, bread, washing-up
 * liquid — is listed here. Both languages on one line, like `PANTRY_GOODS`, and matching
 * accepts either.
 *
 * Plain data and one lookup, so the list page's client component can place a row the
 * moment it is typed, without asking the server.
 */

const AISLE_OF_SHELF: Record<PantryCategory, ShopAisle> = {
  SPICES: "SPICES_SAUCES",
  OIL_VINEGAR: "SPICES_SAUCES",
  SAUCES: "SPICES_SAUCES",
  BAKING: "DRY_GOODS",
  DRY_GOODS: "DRY_GOODS",
  TINS_JARS: "TINS_JARS",
  FRIDGE: "DAIRY",
  FREEZER: "FROZEN",
  DRINKS: "DRINKS",
  BABY: "BABY",
  BATHROOM: "HOUSEHOLD",
  OTHER: "OTHER",
};

/** Each entry: the aisle, then every name it is known by, in either language. */
const SHOP_GOODS: [ShopAisle, string[]][] = [
  [
    "PRODUCE",
    [
      "løg", "onion", "onions", "rødløg", "red onion", "hvidløg", "garlic", "skalotteløg", "shallot",
      "forårsløg", "spring onion", "porre", "leek", "kartofler", "kartoffel", "potatoes", "potato",
      "søde kartofler", "sweet potato", "gulerødder", "gulerod", "carrots", "carrot", "agurk", "cucumber",
      "tomater", "tomat", "tomatoes", "tomato", "cherrytomater", "cherry tomatoes", "peberfrugt",
      "bell pepper", "salat", "lettuce", "icebergsalat", "spinat", "spinach", "broccoli", "blomkål",
      "cauliflower", "squash", "courgette", "zucchini", "aubergine", "eggplant", "champignon",
      "champignoner", "svampe", "mushrooms", "mushroom", "selleri", "celery", "bladselleri", "kål",
      "hvidkål", "cabbage", "rødkål", "grønkål", "kale", "rosenkål", "brussels sprouts", "majs", "corn",
      "ærter", "peas", "bønner", "grønne bønner", "green beans", "avocado", "avocadoer", "ingefær",
      "ginger", "chili", "chilli", "citron", "citroner", "lemon", "lemons", "lime", "limefrugt",
      "æbler", "æble", "apples", "apple", "pærer", "pære", "pears", "bananer", "banan", "bananas",
      "banana", "appelsiner", "appelsin", "oranges", "orange", "vindruer", "druer", "grapes",
      "jordbær", "strawberries", "blåbær", "blueberries", "hindbær", "raspberries", "melon",
      "vandmelon", "watermelon", "kiwi", "mango", "ananas", "pineapple", "persille", "parsley",
      "koriander", "coriander", "cilantro", "basilikum", "basil", "dild", "dill", "purløg", "chives",
      "mynte", "mint", "frisk timian", "rødbeder", "beetroot", "pastinak", "parsnip", "radiser",
      "radishes", "rucola", "rocket", "arugula", "asparges", "asparagus", "fennikel", "fennel",
    ],
  ],
  [
    "BAKERY",
    [
      "brød", "bread", "rugbrød", "rye bread", "franskbrød", "white bread", "boller", "rolls",
      "burgerboller", "burger buns", "pølsebrød", "hot dog buns", "tortilla", "tortillas",
      "wraps", "pitabrød", "pita", "naan", "baguette", "flutes", "croissant", "croissanter",
      "knækbrød", "crispbread", "toastbrød", "toast", "wienerbrød", "pastry",
    ],
  ],
  [
    "MEAT_FISH",
    [
      "kylling", "chicken", "kyllingebryst", "chicken breast", "kyllingelår", "chicken thighs",
      "hakket oksekød", "oksekød", "minced beef", "ground beef", "beef", "hakket svinekød",
      "svinekød", "pork", "hakket kød", "mince", "flæsk", "flæsk i skiver", "bacon", "pølser",
      "sausages", "pølse", "skinke", "ham", "leverpostej", "pâté", "rullepølse", "salami",
      "pålæg", "cold cuts", "laks", "salmon", "torsk", "cod", "rejer", "prawns", "shrimp",
      "tun", "fisk", "fish", "lam", "lamb", "kalkun", "turkey", "and", "duck", "mørbrad",
      "tenderloin", "entrecote", "steak", "frikadeller", "meatballs",
    ],
  ],
  [
    "DAIRY",
    [
      "mælk", "milk", "letmælk", "minimælk", "sødmælk", "skummetmælk", "fløde", "cream",
      "piskefløde", "madlavningsfløde", "creme fraiche", "crème fraîche", "cremefraiche",
      "yoghurt", "græsk yoghurt", "greek yoghurt", "skyr", "smør", "butter", "margarine",
      "ost", "cheese", "revet ost", "grated cheese", "mozzarella", "parmesan", "feta",
      "cheddar", "flødeost", "cream cheese", "hytteost", "cottage cheese", "æg", "eggs", "egg",
      "kærnemælk", "buttermilk", "havremælk", "oat milk", "ymer", "mascarpone", "ricotta",
      "halloumi", "gær", "yeast",
    ],
  ],
  ["DRY_GOODS", ["havregryn", "oats", "müsli", "muesli", "cornflakes", "cereal", "granola"]],
  [
    "SNACKS",
    [
      "chips", "crisps", "slik", "sweets", "candy", "chokolade", "chocolate", "kiks", "biscuits",
      "cookies", "nødder", "nuts", "mandler", "almonds", "popcorn", "rosiner", "raisins",
    ],
  ],
  [
    // Listed whole, because "frosne ærter" read a word at a time is peas, which are produce.
    "FROZEN",
    [
      "frosne ærter", "frozen peas", "frosne grøntsager", "frozen vegetables", "frosne bær",
      "frozen berries", "frossen spinat", "frozen spinach", "frosne pommes frites", "pommes frites",
      "fries", "is", "ice cream", "fiskepinde", "fish fingers", "frossen pizza",
      "frozen pizza",
    ],
  ],
  [
    "HOUSEHOLD",
    [
      "toiletpapir", "toilet paper", "køkkenrulle", "paper towels", "opvaskemiddel",
      "washing-up liquid", "dish soap", "opvasketabs", "dishwasher tablets", "vaskemiddel",
      "laundry detergent", "skyllemiddel", "fabric softener", "affaldsposer", "bin bags",
      "skraldeposer", "fryseposer", "freezer bags", "sølvpapir", "tin foil", "bagepapir",
      "baking paper", "husholdningsfilm", "cling film", "sæbe", "soap", "håndsæbe", "shampoo",
      "balsam", "conditioner", "tandpasta", "toothpaste", "tandbørste", "toothbrush",
      "deodorant", "batterier", "batteries", "pærer til lampe", "light bulbs", "svampe til opvask",
      "sponges", "rengøringsmiddel", "cleaning spray", "stearinlys", "candles", "servietter",
      "napkins",
    ],
  ],
];

const BY_KEY = new Map<string, ShopAisle>();
// The pantry's goods first, so a name both lists know takes the shop list's own aisle.
for (const good of PANTRY_GOODS) {
  const aisle = AISLE_OF_SHELF[good.category];
  for (const name of [good.name.EN, good.name.DA, ...(good.also ?? [])]) {
    const key = pantryKey(name);
    if (key) BY_KEY.set(key, aisle);
  }
}
for (const [aisle, names] of SHOP_GOODS) {
  for (const name of names) {
    const key = pantryKey(name);
    if (key) BY_KEY.set(key, aisle);
  }
}

/**
 * The aisle the built-in list puts `text` in, or null where it has never heard of it.
 *
 * The key as written first, then the longest run of its own whole words, like
 * `lookupGood`: "økologiske gulerødder" is carrots, and "rødløg" — one word, no space —
 * is only ever itself, never "løg".
 */
export function lookupAisle(text: string): ShopAisle | null {
  const key = pantryKey(text);
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
 * Where a list item goes: what this household said (a stored `AisleChoice`, keyed by
 * `pantryKey`), then the built-in list, then nowhere yet.
 */
export function aisleOf(text: string, remembered: Record<string, ShopAisle>): ShopAisle | null {
  return remembered[pantryKey(text)] ?? lookupAisle(text);
}

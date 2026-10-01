/**
 * A list's or a task's face: the emoji on its tile where there is no picture.
 *
 * The household picks one from `EMOJI_CHOICES`, or leaves it to the app, which guesses
 * from the title (`guessEmoji`). The guess is never stored — a stored guess would be a
 * second answer to "what is this list's face" that stops following the title the moment
 * somebody renames it, and the one that quietly disagreed would be the stored one. So
 * `emoji` null is "nobody chose", and `faceOf` is the one place that turns a row into
 * the face every tile draws.
 */

/** The field the picker submits under, read by `readEmojiChoice`. */
export const EMOJI_FIELD = "emoji";

/**
 * What the picker offers. A fixed set rather than any emoji at all: it is what lets the
 * action hold a form to something (a form can say anything, and a tile drawing whatever
 * arrived would draw a paragraph), and a household choosing among sixty-odd is quicker
 * than one hunting through a keyboard of three thousand. Written as `EmojiField` draws
 * it on a phone — four rows, one theme each, scrolled sideways — and a wider screen
 * folds each row into two of eight. Order is free to change, since what is stored is the
 * emoji itself and never its position.
 */
export const EMOJI_CHOICES = [
  "🛒", "🥦", "🍎", "🥖", "🧀", "🥩", "🐟", "🥚", "🥛", "🍝", "🍕", "🍪", "🍽️", "☕", "🍷", "🍺",
  "🧹", "🧺", "🧽", "🧼", "🧻", "🗑️", "♻️", "🛏️", "🛁", "🪟", "🌱", "🪴", "💡", "🔨", "🔧", "🧰",
  "👶", "🧸", "🐶", "🐱", "🐾", "🐠", "🏃", "⚽", "🎮", "🎨", "🎵", "📚", "🎁", "🎂", "🎄", "🎃",
  "🏡", "🔑", "🧯", "🚗", "✈️", "🧳", "⛺", "📦", "📅", "📝", "✉️", "📞", "💰", "💊", "🦷", "🏥",
] as const;

const CHOSEN = new Set<string>(EMOJI_CHOICES);

/**
 * Words a title is guessed from, both languages on one line and checked in order.
 * Substrings on purpose, unlike the pantry's whole-word matching: Danish compounds carry
 * no space ("indkøbsliste", "vasketøj"), and a wrong guess here costs a funny picture on
 * a tile rather than a line missing from the shop.
 */
const GUESSES: [string[], string][] = [
  [["halloween"], "🎃"],
  [["camping", "telt"], "⛺"],
  [["aquarium", "akvarie"], "🐠"],
  [["football", "soccer", "fodbold"], "⚽"],
  [["gym", "fitness", "workout", "træning", "løbetur"], "🏃"],
  [["toy", "legetøj"], "🧸"],
  [["window", "vindue"], "🪟"],
  [["toilet"], "🧻"],
  [["smoke alarm", "røgalarm", "brandslukker"], "🧯"],
  [["butcher", "slagter", "kød"], "🥩"],
  [["pizza"], "🍕"],
  [["grocer", "shopping", "supermarket", "indkøb", "netto", "føtex", "rema", "lidl", "bilka"], "🛒"],
  [["hardware", "diy", "tool", "byggemarked", "værktøj", "silvan", "bauhaus", "jem & fix"], "🔨"],
  [["christmas", "xmas", "jul"], "🎄"],
  [["gift", "present", "gave", "ønske", "wish"], "🎁"],
  [["birthday", "party", "fødselsdag", "fest"], "🎂"],
  [["pack", "holiday", "vacation", "trip", "travel", "ferie", "rejse", "pakke", "sommerhus"], "🧳"],
  [["baby", "nappy", "diaper", "ble"], "👶"],
  [["dog", "hund", "walk the", "lufte"], "🐶"],
  [["the cat", "cat food", "kattemad", "katten"], "🐱"],
  [["pharmac", "medicine", "apotek", "medicin", "pill"], "💊"],
  [["dentist", "tandlæge", "teeth", "tænder"], "🦷"],
  [["doctor", "hospital", "lægen", "lægetid"], "🏥"],
  [["recycl", "genbrug", "pantflask"], "♻️"],
  [["rubbish", "trash", "garbage", "bins", "skrald"], "🗑️"],
  [["laundry", "washing", "vasketøj", "vask tøj", "tøjvask"], "🧺"],
  [["vacuum", "hoover", "støvsug", "sweep", "clean", "rengør", "gulv"], "🧹"],
  [["dish", "opvask", "wipe", "tørre af", "scrub"], "🧽"],
  [["bed", "sheet", "sengetøj", "seng"], "🛏️"],
  [["plant", "garden", "water the", "blomst", "haven", "vande"], "🌱"],
  [["bulb", "lamp", "pære", "lys"], "💡"],
  [["the car", "car wash", "bilen", "bilvask", "tyre", "dæk"], "🚗"],
  [["book", "library", "bog", "bibliotek", "school", "skole"], "📚"],
  [["bill", "pay", "budget", "tax", "regning", "betal", "skat"], "💰"],
  [["wine", "vin", "drinks"], "🍷"],
  [["coffee", "kaffe"], "☕"],
  [["bak", "bread", "brød", "bage"], "🥖"],
  [["fruit", "frugt", "veg", "grønt"], "🥦"],
  [["dinner", "meal", "cook", "aftensmad", "middag", "mad"], "🍽️"],
];

/** The emoji a title suggests, or null when it suggests nothing worth guessing. */
export function guessEmoji(title: string): string | null {
  const said = title.toLocaleLowerCase("da");
  for (const [words, emoji] of GUESSES) {
    if (words.some((word) => said.includes(word))) return emoji;
  }
  return null;
}

/** What a tile draws: the household's own choice, else the guess, else nothing. */
export function faceOf(thing: { emoji: string | null; title: string }): string | null {
  return thing.emoji ?? guessEmoji(thing.title);
}

/**
 * The choice a form made, the way `THEME_FIELD` is read: `undefined` when the form did
 * not mention it (a face not mentioned is a face left alone), `null` for "let the app
 * guess", and one of `EMOJI_CHOICES` otherwise. A value that is none of those is read as
 * not mentioned rather than refused — it is a picture, and failing a save over one
 * would lose everything else the person typed for the sake of a tile.
 */
export function readEmojiChoice(formData: FormData): string | null | undefined {
  const raw = formData.get(EMOJI_FIELD);
  if (raw === null) return undefined;
  const value = String(raw);
  if (value === "") return null;
  return CHOSEN.has(value) ? value : undefined;
}

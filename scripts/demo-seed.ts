/**
 * `npm run db:demo` — a household worth looking at, in the dev database, in one command.
 *
 * Every UI session used to write this by hand before its first screenshot, and most got
 * something wrong on the way (`List.name` is `title`, there is no green theme, the
 * pasta shelf is `DRY_GOODS`, a user's homes are `memberships`). Twelve session notes in
 * `docs/sessions/` name it as their largest cost. `npm run screenshot` is the other half.
 *
 * What it makes, each time from scratch (it deletes its own homes and people first, and
 * touches nothing else):
 *
 * - **The Flat** — English, lived in: two members, lists with ticks and a grouped
 *   shopping list, tasks overdue / due today / for somebody else / finished, a meal plan
 *   for the week, a pantry with run-out and expiring entries and one unsorted, a streak.
 * - **Sommerhuset** — the same household in Danish, because Danish is longer and is what
 *   truncates.
 * - **Empty home** — members and nothing else, for every empty state.
 *
 * Alex (an admin everywhere) and Sam (a member) are in all three; both log in with
 * `DEMO_PASSWORD`. Refuses any database that is not on this machine.
 */
import { PrismaClient, type HomeLanguage, type PantryCategory, type PantryUnit, type ShopAisle } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pantryKey } from "../src/lib/pantry";
import { dueAtDaysFrom, todayInZone, weekStartInZone } from "../src/lib/time";
import { DEMO_HOMES, DEMO_PASSWORD, DEMO_PEOPLE, type DemoHomeKey } from "./demo-cast";

const DAY = 24 * 60 * 60 * 1000;

function refuseRemote(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is not set — run `npm run setup` first.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to seed demo data into ${host}: db:demo is for a local database only.`);
  }
}

type Content = {
  categories: [string, string];
  recipes: { title: string; minutes: number; servings: number; ingredients: string[]; steps: string[] }[];
  lists: {
    title: string;
    emoji?: string;
    groupByAisle?: boolean;
    trackAmounts?: boolean;
    items: { text: string; amount?: number; done?: boolean; aisle?: ShopAisle }[];
  }[];
  tasks: { title: string; days: number; interval: number | null; who: "alex" | "sam" | null; done?: boolean }[];
  pantry: { name: string; quantity: number; unit?: PantryUnit; shelf: PantryCategory | null; expiresInDays?: number }[];
};

const CONTENT: Record<HomeLanguage, Content> = {
  EN: {
    categories: ["Weeknight", "Baking"],
    recipes: [
      {
        title: "Lasagne",
        minutes: 75,
        servings: 4,
        ingredients: ["500 g minced beef", "1 onion", "2 cloves garlic", "400 g chopped tomatoes", "12 lasagne sheets", "200 g mozzarella", "Salt", "Pepper"],
        steps: ["Chop the onion and garlic.", "Brown the beef with the onion and garlic.", "Add the tomatoes and simmer for 20 minutes.", "Layer with the sheets and mozzarella, and bake for 40 minutes at 200°C."],
      },
      {
        title: "Chicken curry",
        minutes: 35,
        servings: 4,
        ingredients: ["600 g chicken breast", "1 onion", "2 tbsp curry paste", "400 ml coconut milk", "300 g rice"],
        steps: ["Cook the rice.", "Fry the onion and curry paste.", "Add the chicken in pieces, then the coconut milk, and simmer for 15 minutes."],
      },
      {
        title: "Tomato soup",
        minutes: 30,
        servings: 2,
        ingredients: ["800 g chopped tomatoes", "1 onion", "5 dl stock", "1 dl cream"],
        steps: ["Soften the onion.", "Add the tomatoes and stock and simmer for 15 minutes.", "Blend, and stir in the cream."],
      },
      {
        title: "Banana bread",
        minutes: 70,
        servings: 8,
        ingredients: ["3 bananas", "100 g butter", "150 g sugar", "2 eggs", "250 g flour"],
        steps: ["Mash the bananas.", "Beat in the melted butter, sugar and eggs.", "Fold in the flour and bake for 55 minutes at 175°C."],
      },
    ],
    lists: [
      {
        title: "Groceries",
        groupByAisle: true,
        trackAmounts: true,
        items: [
          { text: "Bananas", amount: 6, aisle: "PRODUCE" },
          { text: "Spinach", aisle: "PRODUCE" },
          { text: "Milk", amount: 2, aisle: "DAIRY" },
          { text: "Greek yoghurt 10%", aisle: "DAIRY" },
          { text: "Sourdough bread", aisle: "BAKERY" },
          { text: "Dishwasher tablets" },
          { text: "Coffee beans", done: true },
          { text: "Eggs", amount: 12, done: true },
          { text: "Butter", done: true },
        ],
      },
      { title: "Hardware store", emoji: "🔧", items: [{ text: "Light bulbs E27" }, { text: "Wood glue" }] },
      {
        title: "Packing for the cabin",
        items: [{ text: "Sleeping bags", done: true }, { text: "Torch" }, { text: "Board games" }, { text: "Rain jackets" }],
      },
      { title: "Birthday party", items: [{ text: "Balloons" }, { text: "Candles", done: true }] },
    ],
    tasks: [
      { title: "Water the plants", days: -2, interval: 7, who: "alex" },
      { title: "Take out the recycling", days: 0, interval: 7, who: null },
      { title: "Vacuum the stairs", days: 0, interval: 14, who: "sam" },
      { title: "Change the bed linen", days: 3, interval: 14, who: null },
      { title: "Descale the kettle", days: 9, interval: 60, who: "alex" },
      { title: "Book the chimney sweep", days: 5, interval: null, who: "alex" },
      { title: "Return the library books", days: -1, interval: null, who: "sam", done: true },
    ],
    pantry: [
      { name: "Salt", quantity: 1, shelf: "SPICES" },
      { name: "Black pepper", quantity: 1, shelf: "SPICES" },
      { name: "Smoked paprika", quantity: 0, shelf: "SPICES" },
      { name: "Olive oil", quantity: 0.5, unit: "L", shelf: "OIL_VINEGAR" },
      { name: "Soy sauce", quantity: 1, shelf: "SAUCES" },
      { name: "Flour", quantity: 2, unit: "KG", shelf: "BAKING" },
      { name: "Sugar", quantity: 1, unit: "KG", shelf: "BAKING" },
      { name: "Rice", quantity: 0, unit: "KG", shelf: "DRY_GOODS" },
      { name: "Pasta", quantity: 3, unit: "BAG", shelf: "DRY_GOODS" },
      { name: "Chopped tomatoes", quantity: 4, unit: "CAN", shelf: "TINS_JARS" },
      { name: "Butter", quantity: 1, shelf: "FRIDGE", expiresInDays: 6 },
      { name: "Frozen peas", quantity: 1, unit: "BAG", shelf: "FREEZER" },
      { name: "Toilet paper", quantity: 0, unit: "PACK", shelf: "BATHROOM" },
      { name: "Washing-up liquid", quantity: 1, shelf: "CLEANING" },
      { name: "Tahini", quantity: 1, unit: "JAR", shelf: null },
    ],
  },
  DA: {
    categories: ["Hverdag", "Bagværk"],
    recipes: [
      {
        title: "Lasagne",
        minutes: 75,
        servings: 4,
        ingredients: ["500 g hakket oksekød", "1 løg", "2 fed hvidløg", "400 g hakkede tomater", "12 lasagneplader", "200 g mozzarella", "Salt", "Peber"],
        steps: ["Hak løg og hvidløg.", "Brun kødet med løg og hvidløg.", "Tilsæt tomaterne og lad det simre i 20 minutter.", "Læg lag med plader og mozzarella, og bag i 40 minutter ved 200°C."],
      },
      {
        title: "Kyllingekarry",
        minutes: 35,
        servings: 4,
        ingredients: ["600 g kyllingebryst", "1 løg", "2 spsk karrypasta", "400 ml kokosmælk", "300 g ris"],
        steps: ["Kog risene.", "Steg løg og karrypasta.", "Tilsæt kyllingen i stykker og derefter kokosmælken, og lad det simre i 15 minutter."],
      },
      {
        title: "Tomatsuppe",
        minutes: 30,
        servings: 2,
        ingredients: ["800 g hakkede tomater", "1 løg", "5 dl bouillon", "1 dl fløde"],
        steps: ["Svits løget.", "Tilsæt tomater og bouillon og lad det simre i 15 minutter.", "Blend, og rør fløden i."],
      },
      {
        title: "Bananbrød",
        minutes: 70,
        servings: 8,
        ingredients: ["3 bananer", "100 g smør", "150 g sukker", "2 æg", "250 g hvedemel"],
        steps: ["Mos bananerne.", "Pisk det smeltede smør, sukker og æg i.", "Vend melet i og bag i 55 minutter ved 175°C."],
      },
    ],
    lists: [
      {
        title: "Indkøb",
        groupByAisle: true,
        trackAmounts: true,
        items: [
          { text: "Bananer", amount: 6, aisle: "PRODUCE" },
          { text: "Spinat", aisle: "PRODUCE" },
          { text: "Letmælk", amount: 2, aisle: "DAIRY" },
          { text: "Græsk yoghurt 10%", aisle: "DAIRY" },
          { text: "Surdejsbrød", aisle: "BAKERY" },
          { text: "Opvasketabletter" },
          { text: "Kaffebønner", done: true },
          { text: "Æg", amount: 12, done: true },
          { text: "Smør", done: true },
        ],
      },
      { title: "Byggemarked", emoji: "🔧", items: [{ text: "Pærer E27" }, { text: "Trælim" }] },
      {
        title: "Pakkeliste til sommerhuset",
        items: [{ text: "Soveposer", done: true }, { text: "Lommelygte" }, { text: "Brætspil" }, { text: "Regnjakker" }],
      },
      { title: "Fødselsdag", items: [{ text: "Balloner" }, { text: "Lys", done: true }] },
    ],
    tasks: [
      { title: "Vand planterne", days: -2, interval: 7, who: "alex" },
      { title: "Tag genbrug ud", days: 0, interval: 7, who: null },
      { title: "Støvsug trappen", days: 0, interval: 14, who: "sam" },
      { title: "Skift sengetøj", days: 3, interval: 14, who: null },
      { title: "Afkalk elkedlen", days: 9, interval: 60, who: "alex" },
      { title: "Bestil skorstensfejeren", days: 5, interval: null, who: "alex" },
      { title: "Aflever biblioteksbøgerne", days: -1, interval: null, who: "sam", done: true },
    ],
    pantry: [
      { name: "Salt", quantity: 1, shelf: "SPICES" },
      { name: "Sort peber", quantity: 1, shelf: "SPICES" },
      { name: "Røget paprika", quantity: 0, shelf: "SPICES" },
      { name: "Olivenolie", quantity: 0.5, unit: "L", shelf: "OIL_VINEGAR" },
      { name: "Sojasauce", quantity: 1, shelf: "SAUCES" },
      { name: "Hvedemel", quantity: 2, unit: "KG", shelf: "BAKING" },
      { name: "Sukker", quantity: 1, unit: "KG", shelf: "BAKING" },
      { name: "Ris", quantity: 0, unit: "KG", shelf: "DRY_GOODS" },
      { name: "Pasta", quantity: 3, unit: "BAG", shelf: "DRY_GOODS" },
      { name: "Hakkede tomater", quantity: 4, unit: "CAN", shelf: "TINS_JARS" },
      { name: "Smør", quantity: 1, shelf: "FRIDGE", expiresInDays: 6 },
      { name: "Frosne ærter", quantity: 1, unit: "BAG", shelf: "FREEZER" },
      { name: "Toiletpapir", quantity: 0, unit: "PACK", shelf: "BATHROOM" },
      { name: "Opvaskemiddel", quantity: 1, shelf: "CLEANING" },
      { name: "Tahin", quantity: 1, unit: "JAR", shelf: null },
    ],
  },
};

async function main() {
  refuseRemote(process.env.DATABASE_URL);
  const prisma = new PrismaClient();

  try {
    // Its own, and only its own: the homes by name and the people by address. Deleting a
    // home cascades to everything in it; deleting a person cascades to their memberships.
    await prisma.home.deleteMany({ where: { name: { in: Object.values(DEMO_HOMES).map((home) => home.name) } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(DEMO_PEOPLE).map((person) => person.email) } } });

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const alex = await prisma.user.create({ data: { ...DEMO_PEOPLE.alex, passwordHash } });
    const sam = await prisma.user.create({ data: { ...DEMO_PEOPLE.sam, passwordHash } });
    const people = { alex, sam };

    const homes = {} as Record<DemoHomeKey, string>;
    for (const [key, spec] of Object.entries(DEMO_HOMES) as [DemoHomeKey, (typeof DEMO_HOMES)[DemoHomeKey]][]) {
      const home = await prisma.home.create({
        data: {
          name: spec.name,
          theme: spec.theme,
          language: spec.language,
          members: {
            create: [
              { userId: alex.id, role: "ADMIN" },
              { userId: sam.id, role: "USER" },
            ],
          },
        },
      });
      homes[key] = home.id;
      if (spec.livedIn) await furnish(prisma, home.id, CONTENT[spec.language], people);
    }

    await prisma.user.updateMany({ where: { id: { in: [alex.id, sam.id] } }, data: { activeHomeId: homes.flat } });

    console.log("Demo household ready:");
    for (const [key, spec] of Object.entries(DEMO_HOMES)) console.log(`  ${key.padEnd(6)} ${spec.name} (${spec.language})`);
    console.log(`Log in as ${DEMO_PEOPLE.alex.email} or ${DEMO_PEOPLE.sam.email}, password "${DEMO_PASSWORD}".`);
    console.log("Or: npm run screenshot -- /dashboard");
  } finally {
    await prisma.$disconnect();
  }
}

async function furnish(
  prisma: PrismaClient,
  homeId: string,
  content: Content,
  people: { alex: { id: string }; sam: { id: string } },
) {
  const now = new Date();

  const [weeknight, baking] = await Promise.all(
    content.categories.map((name) => prisma.recipeCategory.create({ data: { homeId, name } })),
  );

  const recipes = [];
  for (const [index, recipe] of content.recipes.entries()) {
    recipes.push(
      await prisma.recipe.create({
        data: {
          homeId,
          title: recipe.title,
          ingredients: recipe.ingredients.join("\n"),
          instructions: recipe.steps.join("\n"),
          totalTimeMinutes: recipe.minutes,
          servings: recipe.servings,
          createdById: people.alex.id,
          // The last one is the cake; the rest are dinners.
          categories: { create: { categoryId: (index === content.recipes.length - 1 ? baking : weeknight)!.id } },
          ratings: { create: [{ userId: people.alex.id, hearts: 5 - (index % 2) }, { userId: people.sam.id, hearts: 4 }] },
        },
      }),
    );
  }

  // Tonight, tomorrow, leftovers the day after, and one later in the week.
  const day = (offset: number) => todayInZone(new Date(now.getTime() + offset * DAY));
  await prisma.mealPlan.createMany({
    data: [
      { homeId, date: day(0), recipeId: recipes[0]!.id },
      { homeId, date: day(1), recipeId: recipes[1]!.id },
      { homeId, date: day(2), leftoverOf: day(1) },
      { homeId, date: day(4), recipeId: recipes[2]!.id },
    ],
  });

  for (const list of content.lists) {
    await prisma.list.create({
      data: {
        homeId,
        title: list.title,
        emoji: list.emoji ?? null,
        groupByAisle: list.groupByAisle ?? false,
        trackAmounts: list.trackAmounts ?? false,
        createdById: people.alex.id,
        items: {
          create: list.items.map((item, position) => ({
            text: item.text,
            amount: item.amount ?? 1,
            done: item.done ?? false,
            completedById: item.done ? people.sam.id : null,
            position,
          })),
        },
      },
    });
    const placed = list.items.filter((item) => item.aisle);
    if (placed.length > 0) {
      await prisma.aisleChoice.createMany({
        data: placed.map((item) => ({ homeId, key: pantryKey(item.text), aisle: item.aisle! })),
        skipDuplicates: true,
      });
    }
  }

  for (const task of content.tasks) {
    await prisma.task.create({
      data: {
        homeId,
        title: task.title,
        intervalDays: task.interval,
        nextDueAt: dueAtDaysFrom(task.days, now),
        lastCompletedAt: task.done ? new Date(now.getTime() - DAY) : null,
        createdById: people.alex.id,
        assigneeId: task.who ? people[task.who].id : null,
      },
    });
  }

  await prisma.pantryItem.createMany({
    data: content.pantry.map((entry) => ({
      homeId,
      name: entry.name,
      key: pantryKey(entry.name),
      quantity: entry.quantity,
      unit: entry.unit ?? null,
      category: entry.shelf,
      expiresOn: entry.expiresInDays === undefined ? null : day(entry.expiresInDays),
    })),
  });

  // A streak: a list cleared this week and the week before.
  await prisma.clearedWeek.createMany({
    data: [weekStartInZone(now), weekStartInZone(new Date(now.getTime() - 7 * DAY))].map((week) => ({ homeId, week })),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

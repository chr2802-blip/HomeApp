import type { Page } from "@playwright/test";
import {
  ACCOUNTS,
  clickAndConfirm,
  expect,
  openDialog,
  openHomeMenu,
  openMenu,
  SAVED_RECIPE,
  test,
} from "./helpers/fixtures";
import { CATEGORIES } from "./helpers/database";

/**
 * The household's basic goods, kept from the header's own menu and read again by the
 * button that puts a recipe on a shopping list.
 *
 * The second half is the whole point and the half a unit test cannot see: a page that
 * stores "Salt" perfectly and still puts salt on the shopping is a pantry nobody would
 * keep for a week.
 */

/** The row's quantity stepper, which is also where its name is read from. */
const quantityGroup = (page: Page, name: string) =>
  page.getByRole("group", { name: `Quantity of ${name}`, exact: true });

/** The row's own number box, inside the stepper above. */
const quantityBox = (page: Page, name: string) =>
  page.getByRole("spinbutton", { name: `Quantity of ${name}`, exact: true });

/** A shelf's own section, by the category it holds ("UNSORTED" for none yet). */
const shelf = (page: Page, category: string) => page.locator(`section[data-shelf="${category}"]`);

/**
 * Presses a control until it takes.
 *
 * Nothing in the markup says when React has hydrated — the server renders the same
 * button either way — so keep offering the press until the page shows what it should.
 */
async function retry(attempt: () => Promise<void>) {
  await expect(attempt).toPass({ timeout: 20_000 });
}

/** Opens the add sheet from the green "+" beside the page's title. */
async function openAdd(page: Page) {
  await retry(async () => {
    await page.getByRole("button", { name: "Add to pantry" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  });
}

/** Adds through the sheet, which closes on success. */
async function keepIn(page: Page, name: string) {
  await openAdd(page);
  await page.getByLabel("Something you keep in").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(quantityGroup(page, name)).toBeVisible();
}

/**
 * Brings a new entry's quantity down to zero, which is the household saying it has run
 * out of it.
 *
 * The stepper is optimistic, so it drops to zero the instant it is pressed and says
 * nothing about whether the write landed — which is exactly what the test above reloads
 * to find out. Returning on the drawn state alone leaves a reload racing the action that
 * is still in flight, and the row comes back at one. So this waits for the action's own
 * round trip as well: a server action posts to the page it was called from. A freshly
 * kept-in entry starts at one, so a single press is the whole way to zero.
 */
async function runOut(page: Page, name: string) {
  await retry(async () => {
    const written = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/pantry"),
      { timeout: 5_000 },
    );
    await page.getByRole("button", { name: `Decrease ${name}`, exact: true }).click();
    await expect(quantityBox(page, name)).toHaveValue("0", { timeout: 1000 });
    await written;
  });
}

async function newList(page: Page, title: string) {
  await page.goto("/lists");
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill(title);
  await page.getByLabel("Track amounts").check();
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);
}

async function newRecipe(page: Page, title: string, ingredients: string) {
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
  await page.getByLabel("Ingredients").fill(ingredients);
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);
}

async function addToList(page: Page, listTitle: string) {
  const trigger = page.getByRole("button", { name: "Add to list" });
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await page.getByRole("menuitem", { name: new RegExp(`^${listTitle}`) }).click();
}

test.beforeEach(async ({ loginAs }) => {
  // The plain member, not the admin: the cupboard is not administration, and the person
  // who finds the rice jar empty is not necessarily the one who runs the house.
  await loginAs(ACCOUNTS.member);
});

test("the pantry is reached from the home's own name, and kept there", async ({ page }) => {
  await page.goto("/dashboard");
  await openHomeMenu(page);
  await page.getByRole("menuitem", { name: "Pantry" }).click();
  await page.waitForURL("/pantry");

  await keepIn(page, "Salt");
  await expect(quantityBox(page, "Salt")).toHaveValue("1");

  // Running out is a quantity dropping to zero, not a delete — the entry stays, and the
  // line goes back on the shopping the next time a recipe asks for it.
  await runOut(page, "Salt");
  // And it is still out after a reload, which is the difference between a quantity that
  // was written and one that was only drawn.
  await page.reload();
  await expect(quantityBox(page, "Salt")).toHaveValue("0");
  await expect(page.getByText("Run out", { exact: true })).toBeVisible();

  // The name is edited by pressing it, the way a list item's is — no menu, no sheet, no
  // Save. Delete keeps the three dots to itself.
  await retry(async () => {
    await page.getByRole("button", { name: "Edit Salt" }).click();
    await expect(page.getByLabel("Edit Salt")).toBeVisible({ timeout: 1000 });
  });
  await page.getByLabel("Edit Salt").fill("Havsalt");
  await page.getByLabel("Edit Salt").press("Enter");
  await expect(quantityGroup(page, "Havsalt")).toBeVisible();
  // The rename moved the entry, it did not bring the quantity back up.
  await expect(quantityBox(page, "Havsalt")).toHaveValue("0");

  await openMenu(page, { label: "Havsalt" });
  await clickAndConfirm(page, "Delete", { confirmLabel: "Remove" });
  await expect(quantityGroup(page, "Havsalt")).toHaveCount(0);
});

test("a good is filed on its shelf, and its shelf and unit are changed in the sheet", async ({
  page,
}) => {
  await page.goto("/pantry");
  await keepIn(page, "Ris");

  // The free list knows rice: on its shelf at once, counted in kilos.
  await expect(shelf(page, "DRY_GOODS").getByRole("group", { name: "Quantity of Ris" })).toBeVisible();
  await expect(quantityGroup(page, "Ris").getByTestId("pantry-unit")).toHaveText("kg");

  await openMenu(page, { label: "Ris" });
  await page.getByRole("menuitem", { name: "Shelf and unit" }).click();
  // The chips are what is pressed; the radios under them are visually hidden.
  const sheet = page.getByRole("dialog");
  await sheet.getByText("Freezer", { exact: true }).click();
  await sheet.getByText("g", { exact: true }).click();
  await expect(sheet.getByRole("radio", { name: "g", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(shelf(page, "FREEZER").getByRole("group", { name: "Quantity of Ris" })).toBeVisible();
  await page.reload();
  await expect(shelf(page, "FREEZER").getByRole("group", { name: "Quantity of Ris" })).toBeVisible();
  await expect(quantityGroup(page, "Ris").getByTestId("pantry-unit")).toHaveText("g");
  await expect(shelf(page, "DRY_GOODS")).toHaveCount(0);
});

test("a name the free list does not know is sorted onto a shelf after it is added", async ({ page }) => {
  await page.goto("/pantry");
  await keepIn(page, "Gochujang");

  // Stored at once, and moved when the model (the stub, here) has answered — nothing
  // waited on it.
  await expect(shelf(page, "SAUCES").getByRole("group", { name: "Quantity of Gochujang" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(shelf(page, "UNSORTED")).toHaveCount(0);
});

test("the add box points at what the pantry already keeps rather than adding it twice", async ({
  page,
}) => {
  await page.goto("/pantry");
  await keepIn(page, "Ris");

  await openAdd(page);
  const name = page.getByLabel("Something you keep in");
  await name.fill("ri");
  await expect(page.getByText("Already in the pantry", { exact: true })).toBeVisible();
  // Picking it adds nothing: the sheet closes onto the row.
  await page.getByRole("option", { name: "Ris" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(quantityGroup(page, "Ris")).toBeInViewport();

  // A name that is exactly one already kept says so before the press.
  await openAdd(page);
  await name.fill("ris");
  await expect(page.getByText("Ris is already in the pantry.")).toBeVisible();

  // And the shelf the list knows is previewed on "choose for me".
  await name.fill("spidskommen");
  await expect(page.getByRole("radio", { name: "Choose for me · Spices & herbs" })).toBeChecked();

  // And a common basic not yet kept is offered in the household's own words.
  await name.fill("olivenol");
  await page.getByRole("option", { name: "Olive oil" }).click();
  await expect(name).toHaveValue("Olive oil");
});

test("the shelves narrow to a search or to what has run out, and widen again", async ({ page }) => {
  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  await keepIn(page, "Spidskommen");
  await runOut(page, "Ris");

  const find = page.getByRole("searchbox", { name: "Find in the pantry" });

  await find.fill("ris");
  await expect(quantityGroup(page, "Ris")).toBeVisible();
  await expect(quantityGroup(page, "Salt")).toBeHidden();

  // A shelf's own name narrows to the shelf.
  await find.fill("spices");
  await expect(quantityGroup(page, "Salt")).toBeVisible();
  await expect(quantityGroup(page, "Spidskommen")).toBeVisible();
  await expect(quantityGroup(page, "Ris")).toBeHidden();
  await expect(shelf(page, "DRY_GOODS")).toBeHidden();

  await find.fill("");
  await page.getByRole("button", { name: "Only run out" }).click();
  await expect(quantityGroup(page, "Ris")).toBeVisible();
  await expect(quantityGroup(page, "Salt")).toBeHidden();

  // Nothing matching says so, and offers the way back.
  await find.fill("kaffe");
  await expect(page.getByText("Nothing in the pantry matches “kaffe”.")).toBeVisible();
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(quantityGroup(page, "Salt")).toBeVisible();

  // The add box's "show it" clears a filter that was hiding the row it points at.
  await find.fill("salt");
  await expect(quantityGroup(page, "Ris")).toBeHidden();
  await openAdd(page);
  await page.getByLabel("Something you keep in").fill("ri");
  await page.getByRole("option", { name: "Ris" }).click();
  await expect(find).toHaveValue("");
  await expect(quantityGroup(page, "Ris")).toBeVisible();
});

test("a name the household already keeps is refused, and the row says what it says", async ({
  page,
}) => {
  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Sukker");

  await retry(async () => {
    await page.getByRole("button", { name: "Edit Sukker" }).click();
    await expect(page.getByLabel("Edit Sukker")).toBeVisible({ timeout: 1000 });
  });
  await page.getByLabel("Edit Sukker").fill("salt");
  await page.getByLabel("Edit Sukker").press("Enter");

  await expect(page.getByText("“salt” is already in the pantry.")).toBeVisible();
  await expect(quantityGroup(page, "Sukker")).toBeVisible();
});

test("a recipe leaves the pantry's own lines off the shopping list", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  // Out of rice, so rice is shopping again — the other half of the one bit an entry
  // carries.
  await runOut(page, "Ris");

  await newRecipe(page, "Karry", "2 tsk salt\n2 dl ris\n500 g kylling");
  await addToList(page, "Groceries");

  // What was left out is said where the press happened: a line that quietly never
  // arrives reads as one the app forgot.
  await expect(page.getByText("Salt already in the pantry.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
  await expect(page.getByText("Ris", { exact: true })).toBeVisible();
  await expect(page.getByText("Salt", { exact: true })).toHaveCount(0);
});

test("everything that has run out goes onto a list in one press", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  await keepIn(page, "Mel");
  await runOut(page, "Ris");
  await runOut(page, "Mel");

  await addToList(page, "Groceries");
  await expect(page.getByText("Added to Groceries.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Ris", { exact: true })).toBeVisible();
  await expect(page.getByText("Mel", { exact: true })).toBeVisible();
  // What is in the cupboard was never the question.
  await expect(page.getByText("Salt", { exact: true })).toHaveCount(0);
});

test("a line naming two things the pantry only partly has is asked about, not guessed at", async ({
  page,
}) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");

  await newRecipe(page, "Karry", "Salt og peber\n500 g kylling");
  await addToList(page, "Groceries");

  const decision = page.getByRole("dialog", { name: "Already have some of this?" });
  await expect(decision).toBeVisible();
  await expect(decision.getByText("Salt already in the pantry.")).toBeVisible();

  // Left unchecked, the default, leaves the line off — the same as a line the pantry
  // answered for outright.
  await decision.getByRole("button", { name: "Add checked" }).click();

  await expect(page.getByText("Salt og peber already in the pantry.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
  await expect(page.getByText("Salt og peber", { exact: true })).toHaveCount(0);
});

test("checking that line in the dialog adds it anyway", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");

  await newRecipe(page, "Karry", "Salt og peber\n500 g kylling");
  await addToList(page, "Groceries");

  const decision = page.getByRole("dialog", { name: "Already have some of this?" });
  await decision.getByRole("checkbox", { name: /Salt og peber/ }).check();
  await decision.getByRole("button", { name: "Add checked" }).click();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Salt og peber", { exact: true })).toBeVisible();
  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
});

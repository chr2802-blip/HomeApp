import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes");
});

test("New recipe asks how to start, before showing either form", async ({ page }) => {
  await openDialog(page, "New recipe");

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import from a link" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
  await expect(page.getByLabel("Recipe link")).toHaveCount(0);
});

test("starting from scratch opens the ordinary, empty create form", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Start from scratch" }).click();

  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save recipe" })).toBeVisible();
});

test("a successful import opens the create form pre-filled", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  // .invalid is reserved by RFC 2606 to never resolve, so a stub server response is
  // faked at the route level rather than depending on any real site staying up. The
  // fetch itself happens on this app's own server, not in the browser, so intercepting
  // the browser's network here would not reach it — instead the server is pointed at a
  // page it can actually resolve, which route mocking cannot help with either. This
  // test exercises the wiring with a link this sandbox cannot reach; the parsing itself
  // is covered by tests/unit/recipe-import.test.ts, with fetch mocked.
  await page.getByLabel("Recipe link").fill("https://recipes.invalid/sunday-roast");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(
    page.getByText("Couldn't reach that page. Check the link and try again."),
  ).toBeVisible({ timeout: 15_000 });
  // Still on the link step — a failed fetch never reaches the create form.
  await expect(page.getByLabel("Title")).toHaveCount(0);
});

test("refuses a link that is not a web address, without leaving the link step", async ({
  page,
}) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  await page.getByLabel("Recipe link").fill("not a link");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
});

test("refuses a link that points back at the server's own network", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  await page.getByLabel("Recipe link").fill("http://127.0.0.1/recipe");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
});

test("Back returns to the choice without losing the ability to cancel", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();
  await page.getByRole("button", { name: "Back" }).click();

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reopening after cancelling starts at the choice again, not where it was left", async ({
  page,
}) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.getByLabel("Title").fill("Abandoned");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openDialog(page, "New recipe");

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
});

/*
 * A recipe link copied specifically to paste in here should not make the cook answer
 * "how do you want to start" or press Fetch a second time — the button already knows.
 * These stub the browser's clipboard rather than the network, so the outcome after the
 * automatic fetch is one of the deterministic, no-network cases already exercised
 * above (a blocked address, refused instantly) rather than anything that depends on
 * reaching a real site.
 */
test.describe("a recipe link already on the clipboard", () => {
  async function withClipboard(page: import("@playwright/test").Page, text: string) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  }

  test("skips the question and starts fetching on its own", async ({ page }) => {
    await withClipboard(page, "http://127.0.0.1/recipe");

    await openDialog(page, "New recipe");

    // Straight to the link step — never the choice screen — and already fetching
    // without a press of the button.
    await expect(page.getByRole("button", { name: "Start from scratch" })).toHaveCount(0);
    await expect(page.getByLabel("Recipe link")).toHaveValue("http://127.0.0.1/recipe");
    await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
  });

  test("still asks first when the clipboard holds no web address", async ({ page }) => {
    await withClipboard(page, "chicken, not garlic, for the soup");

    await openDialog(page, "New recipe");

    await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
    await expect(page.getByLabel("Recipe link")).toHaveCount(0);
  });

  test("opens on the choice anyway when the browser never answers", async ({ page }) => {
    // Not a hypothetical: a Chromium with no clipboard permission granted leaves
    // readText() pending for ever rather than refusing it. The sheet opens *after* that
    // check, so without a bound on the wait the button does nothing at all — no error,
    // no sheet, nothing to see. The tests above catch it only in a browser that hangs;
    // this one asks every browser the same question.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "readText", {
        configurable: true,
        value: () => new Promise(() => {}),
      });
    });
    await page.goto("/recipes");

    await openDialog(page, "New recipe");

    await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
  });

  test("choosing Import from a link by hand starts blank, not from an earlier clipboard fetch", async ({
    page,
  }) => {
    await withClipboard(page, "http://127.0.0.1/recipe");
    await openDialog(page, "New recipe");
    await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Import from a link" }).click();

    await expect(page.getByLabel("Recipe link")).toHaveValue("");
  });
});

/*
 * A reel keeps its recipe in the paragraph under the video, and Meta refuses a signed-out
 * request for that paragraph often enough that the automatic read cannot be the only way
 * in. The box is therefore reachable on purpose and not only after a failure — which is
 * also what lets these tests drive the whole route without fetching anything: the only
 * thing beyond this app they touch is the reading, and that is answered by the worker's
 * own stub (`e2e/helpers/anthropic-stub.mjs`), which hands back one fixed recipe.
 *
 * So what is pinned here is everything on this side of the reading: that the text gets
 * there, that what comes back is rendered into lines, and that the create form opens with
 * them in it, editable, before anything is saved. What the reading itself makes of a
 * caption is a question for the unit suite and for the model.
 */
test.describe("pasting a description", () => {
  async function paste(page: import("@playwright/test").Page, text: string) {
    await openDialog(page, "New recipe");
    await page.getByRole("button", { name: "Import from a link" }).click();
    await page.getByRole("button", { name: "Paste the description instead" }).click();

    await page.getByLabel("Paste the description instead").fill(text);
    await page.getByRole("button", { name: "Read the description" }).click();
  }

  const CAPTION = [
    "🍝 Cremet pasta med kylling",
    "",
    "Ingredienser",
    "- 400 g pasta",
    "- 500 g kyllingebryst",
    "- 2 dl fløde",
    "",
    "Fremgangsmåde",
    "1. Kog pastaen.",
    "2. Steg kyllingen.",
    "",
    "Klar på 25 minutter i alt",
    "#aftensmad #pasta",
  ].join("\n");

  test("reads a pasted description into the create form", async ({ page }) => {
    await paste(page, CAPTION);

    // Straight into the ordinary create form, filled in and still entirely editable.
    await expect(page.getByLabel("Title")).toHaveValue("Cremet pasta med kylling");
    await expect(page.getByLabel("Ingredients")).toHaveValue(
      "400 g pasta\n500 g kyllingebryst, i strimler\n2 dl fløde\nsalt, efter smag",
    );
    await expect(page.getByLabel("Instructions")).toHaveValue("Kog pastaen.\nSteg kyllingen.");
    await expect(page.getByLabel("Total time (minutes)")).toHaveValue("25");
  });

  test("says so when the description is not a recipe, without leaving the step", async ({
    page,
  }) => {
    await paste(page, "Sikke en dejlig aften i haven");

    await expect(page.getByText("Couldn't find a recipe in that description")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveCount(0);
  });

  /*
   * A caption that sends the cook elsewhere for half of it still imports — a recipe that
   * needs checking is more use than no recipe — but it says so above the form, where the
   * checking is about to happen anyway.
   */
  test("says what is worth checking over, above the form it filled in", async ({ page }) => {
    await paste(page, "Cremet pasta\n400 g pasta\nResten i bio, resten i bio");

    await expect(page.getByLabel("Title")).toHaveValue("Cremet pasta med kylling");
    await expect(
      page.getByText("Worth checking: Resten af opskriften står i profilen."),
    ).toBeVisible();
  });
});

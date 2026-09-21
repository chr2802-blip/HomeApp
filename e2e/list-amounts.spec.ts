import { ACCOUNTS, expect, openDialog, openMenu, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * Makes a list through the real sheet, with or without amounts, and leaves the browser
 * on it. Going through the dialog is the point of several of these: the setting is
 * chosen when the list is made, so the checkbox is part of what is under test.
 */
async function newList(page: Page, title: string, withAmounts: boolean) {
  await page.goto("/lists");
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill(title);
  if (withAmounts) await page.getByLabel("Track amounts").check();
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);
}

async function add(page: Page, text: string) {
  await page.getByPlaceholder("Add an item").fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

/**
 * The number in a picker. Asked for by role and by the whole label: the buttons either
 * side of it carry the same words ("Increase Amount for Milk"), so a substring match
 * finds three controls where one was meant.
 */
const amountBox = (page: Page, of?: string) =>
  page.getByRole("spinbutton", { name: of ? `Amount for ${of}` : "Amount", exact: true });

const stepper = (page: Page, direction: "Increase" | "Decrease", of?: string) =>
  page.getByRole("button", {
    name: of ? `${direction} Amount for ${of}` : `${direction} Amount`,
    exact: true,
  });

const storedAmount = (text: string) =>
  prisma()
    .listItem.findFirstOrThrow({ where: { text } })
    .then((item) => item.amount);

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("a list without amounts shows no picker at all", async ({ page }) => {
  await newList(page, "Jobs", false);
  await add(page, "Hoover");

  await expect(amountBox(page)).toHaveCount(0);
  await expect(amountBox(page, "Hoover")).toHaveCount(0);
  expect(await storedAmount("Hoover")).toBe(1);
});

test("items land on 1 unless the add box says otherwise", async ({ page }) => {
  await newList(page, "Groceries", true);

  await expect(amountBox(page)).toHaveValue("1");
  await add(page, "Milk");

  expect(await storedAmount("Milk")).toBe(1);
  await expect(amountBox(page, "Milk")).toHaveValue("1");
});

test("the amount set in the add box is the amount the item gets", async ({ page }) => {
  await newList(page, "Groceries", true);

  await stepper(page, "Increase").click();
  await stepper(page, "Increase").click();
  await expect(amountBox(page)).toHaveValue("3");

  await add(page, "Milk");

  expect(await storedAmount("Milk")).toBe(3);
  await expect(amountBox(page, "Milk")).toHaveValue("3");
  // And the box is back to one, ready for something else.
  await expect(amountBox(page)).toHaveValue("1");
});

test("a typed amount is taken as typed", async ({ page }) => {
  await newList(page, "Groceries", true);

  await amountBox(page).fill("12");
  await add(page, "Eggs");

  expect(await storedAmount("Eggs")).toBe(12);
});

test("an amount can be changed on the row and survives a reload", async ({ page }) => {
  await newList(page, "Groceries", true);
  await add(page, "Milk");

  await stepper(page, "Increase", "Milk").click();
  await expect(amountBox(page, "Milk")).toHaveValue("2");
  await expect.poll(() => storedAmount("Milk")).toBe(2);

  await page.reload();
  await expect(amountBox(page, "Milk")).toHaveValue("2");

  await stepper(page, "Decrease", "Milk").click();
  await expect.poll(() => storedAmount("Milk")).toBe(1);
});

test("the amount cannot be stepped below one", async ({ page }) => {
  await newList(page, "Groceries", true);
  await add(page, "Milk");

  await expect(stepper(page, "Decrease", "Milk")).toBeDisabled();
});

test("ticking an item resets its amount to one, and shows no picker", async ({ page }) => {
  await newList(page, "Groceries", true);

  await amountBox(page).fill("4");
  await add(page, "Milk");

  await page.getByRole("button", { name: "Mark as done" }).click();
  await page.getByRole("button", { name: "Completed (1)" }).click();

  await expect(page.getByText("×1")).toBeVisible();
  await expect(amountBox(page, "Milk")).toHaveCount(0);
  await expect.poll(() => storedAmount("Milk")).toBe(1);
});

test("amounts can be turned on for a list that was made without them", async ({ page }) => {
  await newList(page, "Jobs", false);
  await add(page, "Hoover");

  await openMenu(page);
  await openDialog(page, "Edit");
  await page.getByLabel("Track amounts").check();
  await page.getByRole("button", { name: "Save changes" }).click();

  // The item was always carrying an amount of 1; now it is shown.
  await expect(amountBox(page, "Hoover")).toHaveValue("1");
});

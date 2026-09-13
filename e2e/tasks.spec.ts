import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { dueAtDaysFrom, formatInZone } from "../src/lib/time";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/tasks");
});

async function addTask(
  page: Parameters<typeof openDialog>[0],
  options: { title: string; intervalDays?: string; notes?: string },
) {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill(options.title);
  if (options.intervalDays) {
    await page.getByLabel("Repeat every (days)").fill(options.intervalDays);
  }
  if (options.notes) {
    await page.getByLabel("Notes (optional)").fill(options.notes);
  }
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText(options.title, { exact: true })).toBeVisible();
}

test("the empty state says there are no tasks", async ({ page }) => {
  await expect(page.getByText("No recurring tasks yet.")).toBeVisible();
});

test("a new task appears as due today and never completed", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "7", notes: "Both windowsills" });

  await expect(page.getByText("Due today")).toBeVisible();
  await expect(page.getByText("Both windowsills")).toBeVisible();
  await expect(page.getByText("Every 7 days · never completed")).toBeVisible();
});

test("completing a task reschedules it and records the completion", async ({ page }) => {
  await addTask(page, { title: "Change the filter", intervalDays: "30" });
  await expect(page.getByText("Due today")).toBeVisible();

  await page.getByRole("button", { name: "Mark done" }).click();

  // Due today becomes a date 30 days out, and the footer notes today's completion.
  await expect(page.getByText("Due today")).toBeHidden();
  await expect(page.getByText(/Every 30 days · last done/)).toBeVisible();
});

test("a task can be edited", async ({ page }) => {
  await addTask(page, { title: "Old title", intervalDays: "7" });

  await openDialog(page, "Edit");
  await page.getByLabel("Task", { exact: true }).fill("New title");
  await page.getByLabel("Repeat every (days)").fill("14");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("New title", { exact: true })).toBeVisible();
  await expect(page.getByText(/Every 14 days/)).toBeVisible();
});

test("a task can be deleted", async ({ page }) => {
  await addTask(page, { title: "Doomed task" });

  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No recurring tasks yet.")).toBeVisible();
});

test("an overdue task is flagged", async ({ page }) => {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill("Overdue task");
  await page.getByLabel("Repeat every (days)").fill("7");

  // Counted on the household's clock, which is what the app labels against. Deriving
  // this from toISOString() would use UTC and drift by a day near local midnight.
  await page.getByLabel("First due date").fill(formatInZone(dueAtDaysFrom(-3), "yyyy-MM-dd"));

  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText("3 days overdue")).toBeVisible();
});

test("the browser blocks an interval below the allowed minimum", async ({ page }) => {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill("Bad interval");
  await page.getByLabel("Repeat every (days)").fill("0");
  await page.getByRole("button", { name: "Add task" }).click();

  // min={1} on the input stops the submit, so the dialog stays open.
  await expect(page.getByRole("dialog")).toBeVisible();
});

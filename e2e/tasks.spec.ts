import { ACCOUNTS, clickAndConfirm, expect, openDialog, openMenu, test } from "./helpers/fixtures";
import type { Page } from "@playwright/test";
import { dueAtDaysFrom, formatInZone } from "../src/lib/time";

/**
 * A task is edited by pressing its card, which is a button whose name starts with the
 * task's own. Anchored, because the card's three-dot menu is named after it too.
 */
async function openTask(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/tasks");
});

async function addTask(
  page: Parameters<typeof openDialog>[0],
  options: {
    title: string;
    intervalDays?: string;
    notes?: string;
    assignTo?: string;
    /** A one-off: the repeat picker is set to "Just once" and takes the interval away. */
    once?: boolean;
  },
) {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill(options.title);
  if (options.once) {
    await page.getByLabel("Repeat", { exact: true }).selectOption({ label: "Just once" });
  }
  if (options.intervalDays) {
    await page.getByLabel("Repeat every (days)").fill(options.intervalDays);
  }
  if (options.notes) {
    await page.getByLabel("Notes (optional)").fill(options.notes);
  }
  if (options.assignTo) {
    await page.getByLabel("Assigned to").selectOption({ label: options.assignTo });
  }
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText(options.title, { exact: true })).toBeVisible();
}

test("the empty state says there are no tasks", async ({ page }) => {
  await expect(page.getByText("No tasks yet — add the first one above.")).toBeVisible();
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

test("the dashboard says how much of the week's work is behind you", async ({ page }) => {
  await addTask(page, { title: "Change the filter", intervalDays: "30" });
  await addTask(page, { title: "Water the plants", intervalDays: "7" });

  await page.goto("/dashboard");
  // Two jobs due and neither done: the week has not started.
  await expect(page.getByText("This week · 0 of 2 jobs done")).toBeVisible();

  await page.goto("/tasks");
  await page.getByRole("button", { name: "Mark done" }).first().click();
  await expect(page.getByText(/last done/)).toBeVisible();

  await page.goto("/dashboard");
  // One done, one still owed. A task booked in for next month is not owed today, which
  // is why the total stays two rather than climbing with the household's whole list.
  await expect(page.getByText("This week · 1 of 2 jobs done")).toBeVisible();
});

test("a task can be edited", async ({ page }) => {
  await addTask(page, { title: "Old title", intervalDays: "7" });

  await openTask(page, "Old title");
  await page.getByLabel("Task", { exact: true }).fill("New title");
  await page.getByLabel("Repeat every (days)").fill("14");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("New title", { exact: true })).toBeVisible();
  await expect(page.getByText(/Every 14 days/)).toBeVisible();
});

test("a task can be deleted from its own menu", async ({ page }) => {
  await addTask(page, { title: "Doomed task" });

  await openMenu(page, { label: "Doomed task" });
  await clickAndConfirm(page, "Delete");

  await expect(page.getByText("No tasks yet — add the first one above.")).toBeVisible();
});

test("an overdue task is flagged", async ({ page }) => {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill("Overdue task");
  await page.getByLabel("Repeat every (days)").fill("7");

  // Counted on the household's clock, which is what the app labels against. Deriving
  // this from toISOString() would use UTC and drift by a day near local midnight.
  await page.getByLabel("Due date").fill(formatInZone(dueAtDaysFrom(-3), "yyyy-MM-dd"));

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

test("a task is everyone's until somebody is named", async ({ page }) => {
  await addTask(page, { title: "Bins" });

  await expect(page.getByText(`For ${ACCOUNTS.admin.name}`)).toBeHidden();

  await openTask(page, "Bins");
  await page.getByLabel("Assigned to").selectOption({ label: ACCOUNTS.admin.name });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText(`For ${ACCOUNTS.admin.name}`)).toBeVisible();
});

test("a task can be handed back to the whole home", async ({ page }) => {
  await addTask(page, { title: "Bins", assignTo: ACCOUNTS.admin.name });
  await expect(page.getByText(`For ${ACCOUNTS.admin.name}`)).toBeVisible();

  await openTask(page, "Bins");
  await page.getByLabel("Assigned to").selectOption({ label: "Everyone in the home" });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText(`For ${ACCOUNTS.admin.name}`)).toBeHidden();
});

test("the dashboard separates what is yours from what is somebody else's", async ({ page }) => {
  await addTask(page, { title: "Everybody task" });
  await addTask(page, { title: "My task", assignTo: ACCOUNTS.member.name });
  await addTask(page, { title: "Ada's task", assignTo: ACCOUNTS.admin.name });

  await page.goto("/dashboard");

  const mine = page.locator("section").filter({ has: page.getByRole("heading", { name: "Due for you" }) });
  const theirs = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Due for someone else" }) });

  // An unassigned task is the household's, which includes the person looking at it.
  await expect(mine.getByText("Everybody task")).toBeVisible();
  await expect(mine.getByText("My task")).toBeVisible();
  await expect(mine.getByText("Ada's task")).toBeHidden();

  await expect(theirs.getByText("Ada's task")).toBeVisible();
  await expect(theirs.getByText(ACCOUNTS.admin.name)).toBeVisible();
});

test("the second section stays away when nothing is due for anybody else", async ({ page }) => {
  await addTask(page, { title: "Everybody task" });

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Due for you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Due for someone else" })).toBeHidden();
});

test("anyone can complete a task that names somebody else", async ({ page }) => {
  await addTask(page, { title: "Ada's task", intervalDays: "30", assignTo: ACCOUNTS.admin.name });

  // Naming somebody decides who is reminded, not who is allowed to do the job.
  await page.getByRole("button", { name: "Mark done" }).click();

  await expect(page.getByText(/Every 30 days · last done/)).toBeVisible();
  await expect(page.getByText(`For ${ACCOUNTS.admin.name}`)).toBeVisible();
});

test("pressing a card opens that task and no other", async ({ page }) => {
  await addTask(page, { title: "Water the plants" });
  await addTask(page, { title: "Descale the kettle", intervalDays: "90" });

  await openTask(page, "Descale the kettle");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Task", { exact: true })).toHaveValue("Descale the kettle");
  await expect(dialog.getByLabel("Repeat every (days)")).toHaveValue("90");
});

test("marking a task done does not open its sheet", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "30" });

  await page.getByRole("button", { name: "Mark done" }).click();

  await expect(page.getByText(/Every 30 days · last done/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a one-off is added with no interval to give", async ({ page }) => {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill("Book the plumber");
  await page.getByLabel("Repeat", { exact: true }).selectOption({ label: "Just once" });

  // There is no interval to fill in, which is the point: the field goes away rather
  // than sitting there greyed out.
  await expect(page.getByLabel("Repeat every (days)")).toBeHidden();

  await page.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText("Book the plumber", { exact: true })).toBeVisible();
  await expect(page.getByText("One-off", { exact: true })).toBeVisible();
  await expect(page.getByText("Due today")).toBeVisible();
});

test("the done list stays away until a one-off is finished, and then stays folded", async ({
  page,
}) => {
  await addTask(page, { title: "Book the plumber", once: true });

  await expect(page.getByRole("heading", { name: "Done" })).toBeHidden();

  await page.getByRole("button", { name: "Mark done" }).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();
  await expect(page.getByText("Nothing left to do — nice work.")).toBeVisible();

  // What is finished is kept, not shown: it opens on request rather than pushing what
  // is still to do down the page.
  const section = page.getByRole("button", { name: "Done (1)" });
  await expect(section).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Book the plumber", { exact: true })).toBeHidden();

  await section.click();
  await expect(page.getByText("Book the plumber", { exact: true })).toBeVisible();
});

test("a finished one-off can be brought back exactly as it was", async ({ page }) => {
  await addTask(page, { title: "Book the plumber", once: true });
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

  // The way back is inside the folded section, with the task it belongs to.
  await page.getByRole("button", { name: "Done (1)" }).click();
  await page.getByRole("button", { name: "Reopen" }).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeHidden();
  await expect(page.getByText("Due today")).toBeVisible();
});

test("completing a recurring task leaves the done list empty", async ({ page }) => {
  // A recurring task is never finished: it books itself in again rather than moving to
  // the bottom of the page.
  await addTask(page, { title: "Water the plants", intervalDays: "30" });

  await page.getByRole("button", { name: "Mark done" }).click();

  await expect(page.getByText(/Every 30 days · last done/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Done" })).toBeHidden();
});

test("a recurring task can be turned into a one-off", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "30" });

  await openTask(page, "Water the plants");
  await page.getByLabel("Repeat", { exact: true }).selectOption({ label: "Just once" });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("One-off", { exact: true })).toBeVisible();
  await expect(page.getByText(/Every 30 days/)).toBeHidden();
});

test("a one-off due for somebody else shows on the dashboard like any other", async ({ page }) => {
  await addTask(page, { title: "Book the plumber", once: true, assignTo: ACCOUNTS.admin.name });

  await page.goto("/dashboard");

  const theirs = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Due for someone else" }) });

  await expect(theirs.getByText("Book the plumber")).toBeVisible();
  await expect(theirs.getByText("One-off", { exact: false })).toBeVisible();
});

test("a one-off that has been done drops off the dashboard", async ({ page }) => {
  await addTask(page, { title: "Book the plumber", once: true });
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

  await page.goto("/dashboard");

  await expect(page.getByText("Book the plumber")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Due for you" })).toBeHidden();
});

import { ACCOUNTS, clickAndConfirm, expect, openDialog, openMenu, test } from "./helpers/fixtures";
import type { Page } from "@playwright/test";
import { dueAtDaysFrom, formatInZone } from "../src/lib/time";

/** A task is edited from its three dots, on its row or on its own page. */
async function openTask(page: Page, title: string) {
  await openMenu(page, { label: title });
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Pressing a task's row opens its own page. */
async function openTaskPage(page: Page, title: string) {
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).click();
  await page.waitForURL(/\/tasks\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
}

/** The row's own Done, not the "Done (n)" fold of finished tasks. */
function doneButton(page: Page) {
  return page.getByRole("button", { name: "Done", exact: true });
}

/** The one line a row says about a task, beside its name. */
function row(page: Page, title: string) {
  return page.getByRole("link", { name: new RegExp(`^${title}`) });
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
  await expect(page.getByText("No chores written down yet. Lucky you — or add the first one above.")).toBeVisible();
});

test("a new task appears as due today, and its page says the rest", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "7", notes: "Both windowsills" });

  await expect(row(page, "Water the plants")).toContainText("Due today · Every 7 days");
  // The notes and the history are the task's own page's to say, not the row's.
  await expect(page.getByText("Both windowsills")).toBeHidden();

  await openTaskPage(page, "Water the plants");
  await expect(page.getByText("Both windowsills")).toBeVisible();
  await expect(page.getByText("Not yet")).toBeVisible();
});

test("completing a task reschedules it and records the completion", async ({ page }) => {
  await addTask(page, { title: "Change the filter", intervalDays: "30" });
  await expect(page.getByText("Due today")).toBeVisible();

  await doneButton(page).click();

  // Due today becomes a date 30 days out, and the task's page notes today's completion.
  await expect(page.getByText("Due today")).toBeHidden();
  await openTaskPage(page, "Change the filter");
  await expect(page.getByText("Not yet")).toBeHidden();
});

test("a task can be marked done from its own page", async ({ page }) => {
  await addTask(page, { title: "Change the filter", intervalDays: "30" });
  await openTaskPage(page, "Change the filter");
  await expect(page.getByText("Not yet")).toBeVisible();

  await page.getByRole("button", { name: "Mark done" }).click();

  await expect(page.getByText("Not yet")).toBeHidden();
  await expect(page.getByText("Due today")).toBeHidden();
});

test("a task deleted from its own page goes back to the tasks", async ({ page }) => {
  await addTask(page, { title: "Doomed task" });
  await openTaskPage(page, "Doomed task");

  await openMenu(page, { label: "Doomed task" });
  await clickAndConfirm(page, "Delete");

  await page.waitForURL(/\/tasks$/);
  await expect(page.getByText("No tasks yet — add the first one above.")).toBeVisible();
});

test("pressing a task on the dashboard opens its page", async ({ page }) => {
  await addTask(page, { title: "Water the plants", notes: "Both windowsills" });

  await page.goto("/dashboard");
  await openTaskPage(page, "Water the plants");
  await expect(page.getByText("Both windowsills")).toBeVisible();
});

test("the dashboard says how much of the week's work is behind you", async ({ page }) => {
  await addTask(page, { title: "Change the filter", intervalDays: "30" });
  await addTask(page, { title: "Water the plants", intervalDays: "7" });

  await page.goto("/dashboard");
  // Two jobs due and neither done: the week has not started.
  await expect(page.getByText("This week · 0 of 2 jobs done")).toBeVisible();

  await page.goto("/tasks");
  await doneButton(page).first().click();
  await expect(page.getByText("Due today")).toHaveCount(1);

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
  await expect(row(page, "New title")).toContainText("Every 14 days");
});

test("a task can be deleted from its own menu", async ({ page }) => {
  await addTask(page, { title: "Doomed task" });

  await openMenu(page, { label: "Doomed task" });
  await clickAndConfirm(page, "Delete");

  await expect(page.getByText("No chores written down yet. Lucky you — or add the first one above.")).toBeVisible();
});

test("a due task can be put off until tomorrow from its own menu", async ({ page }) => {
  await addTask(page, { title: "Bins", intervalDays: "7" });
  await expect(page.getByText("Due today")).toBeVisible();

  await openMenu(page, { label: "Bins" });
  await page.getByRole("menuitem", { name: "Snooze to tomorrow" }).click();

  await expect(page.getByText("Due tomorrow")).toBeVisible();
  // Put off, not done: the task still repeats, and still has never been completed.
  await expect(row(page, "Bins")).toContainText("Every 7 days");
  await openTaskPage(page, "Bins");
  await expect(page.getByText("Not yet")).toBeVisible();
});

test("a task due later is not offered a snooze, which would bring it forward", async ({ page }) => {
  await openDialog(page, "New task");
  await page.getByLabel("Task", { exact: true }).fill("Boiler service");
  await page.getByLabel("Repeat every (days)").fill("365");
  await page.getByLabel("Due date").fill(formatInZone(dueAtDaysFrom(30), "yyyy-MM-dd"));
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Boiler service", { exact: true })).toBeVisible();

  await openMenu(page, { label: "Boiler service" });
  await expect(page.getByRole("menuitem", { name: "Snooze to tomorrow" })).toBeHidden();
  // The menu is still the menu: what it holds for this task is edit and delete.
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
});

test("the dashboard can put off a task due today", async ({ page }) => {
  await addTask(page, { title: "Bins", intervalDays: "7" });

  await page.goto("/dashboard");
  await expect(page.getByText("Due today")).toBeVisible();

  await openMenu(page, { label: "Bins" });
  await page.getByRole("menuitem", { name: "Snooze to tomorrow" }).click();

  // Off today's plate. It is still within the three days the dashboard reaches, so the
  // row stays — with tomorrow's date on it.
  await expect(page.getByText("Due today")).toBeHidden();
  await expect(page.getByText("Due tomorrow")).toBeVisible();
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

  await expect(row(page, "Bins")).not.toContainText(ACCOUNTS.admin.name);

  await openTask(page, "Bins");
  await page.getByLabel("Assigned to").selectOption({ label: ACCOUNTS.admin.name });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(row(page, "Bins")).toContainText(ACCOUNTS.admin.name);
});

test("a task can be handed back to the whole home", async ({ page }) => {
  await addTask(page, { title: "Bins", assignTo: ACCOUNTS.admin.name });
  await expect(row(page, "Bins")).toContainText(ACCOUNTS.admin.name);

  await openTask(page, "Bins");
  await page.getByLabel("Assigned to").selectOption({ label: "Everyone in the home" });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(row(page, "Bins")).not.toContainText(ACCOUNTS.admin.name);
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

  // Somebody else's is information rather than a job, so it is folded away with its
  // count on the heading — what is due for *you* is what the first screen is for.
  const fold = theirs.getByRole("button", { name: /Due for someone else/ });
  await expect(fold).toHaveText(/Due for someone else \(1\)/);
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(theirs.getByText("Ada's task")).toBeHidden();

  await fold.click();
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
  await doneButton(page).click();

  await expect(page.getByText("Due today")).toBeHidden();
  await expect(row(page, "Ada's task")).toContainText(ACCOUNTS.admin.name);
});

test("pressing a row opens that task and no other", async ({ page }) => {
  await addTask(page, { title: "Water the plants" });
  await addTask(page, { title: "Descale the kettle", intervalDays: "90" });

  await openTaskPage(page, "Descale the kettle");
  await expect(page.getByText("Every 90 days")).toBeVisible();

  await openTask(page, "Descale the kettle");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Task", { exact: true })).toHaveValue("Descale the kettle");
  await expect(dialog.getByLabel("Repeat every (days)")).toHaveValue("90");
});

test("marking a task done does not leave the list", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "30" });

  await doneButton(page).click();

  await expect(page.getByText("Due today")).toBeHidden();
  await expect(page).toHaveURL(/\/tasks$/);
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

  await expect(row(page, "Book the plumber")).toContainText("Due today · One-off");
});

test("the done list stays away until a one-off is finished, and then stays folded", async ({
  page,
}) => {
  await addTask(page, { title: "Book the plumber", once: true });

  await expect(page.getByRole("heading", { name: "Done" })).toBeHidden();

  await doneButton(page).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();
  await expect(page.getByText("Everything is done. Feet up — you have earned it.")).toBeVisible();

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
  await doneButton(page).click();
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

  await doneButton(page).click();

  await expect(page.getByText("Due today")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Done" })).toBeHidden();
});

test("a recurring task can be turned into a one-off", async ({ page }) => {
  await addTask(page, { title: "Water the plants", intervalDays: "30" });

  await openTask(page, "Water the plants");
  await page.getByLabel("Repeat", { exact: true }).selectOption({ label: "Just once" });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(row(page, "Water the plants")).toContainText("One-off");
  await expect(row(page, "Water the plants")).not.toContainText("Every 30 days");
});

test("a one-off due for somebody else shows on the dashboard like any other", async ({ page }) => {
  await addTask(page, { title: "Book the plumber", once: true, assignTo: ACCOUNTS.admin.name });

  await page.goto("/dashboard");

  const theirs = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Due for someone else" }) });

  // Folded away like everything else that is due for somebody else, and the same card
  // once it is opened — a one-off is not a different kind of thing here.
  await theirs.getByRole("button", { name: /Due for someone else/ }).click();
  await expect(theirs.getByText("Book the plumber")).toBeVisible();
  await expect(theirs.getByText("One-off", { exact: false })).toBeVisible();
});

test("a one-off that has been done drops off the dashboard", async ({ page }) => {
  await addTask(page, { title: "Book the plumber", once: true });
  await doneButton(page).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

  await page.goto("/dashboard");

  await expect(page.getByText("Book the plumber")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Due for you" })).toBeHidden();
});

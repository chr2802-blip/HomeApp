import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { completeTask } from "@/app/actions/tasks";
import { SubmitButton } from "@/components/submit-button";
import { NotificationSetup } from "@/components/notification-setup";
import { dueLabel, dueTone } from "@/lib/due";

export default async function DashboardPage() {
  const user = await requireUser();

  if (!user.homeId) {
    return (
      <>
        <PageHeader title="No home selected" description="Pick a home to work in." />
        <EmptyState>
          <p>You are a super admin without an active home.</p>
          <ButtonLink href="/admin/homes" className="mt-4">
            Go to homes
          </ButtonLink>
        </EmptyState>
      </>
    );
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const db = homeDb(user.homeId);

  const [dueTasks, lists, recipeCount] = await Promise.all([
    db.recurringTask.findMany({
      where: { nextDueAt: { lte: soon } },
      orderBy: { nextDueAt: "asc" },
    }),
    db.list.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { items: true } } },
    }),
    db.recipe.count(),
  ]);

  return (
    <>
      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        description={user.homeName ? `${user.homeName} · what needs attention` : undefined}
      />

      <NotificationSetup />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Tasks due</h2>
        {dueTasks.length === 0 ? (
          <EmptyState>Nothing due in the next few days.</EmptyState>
        ) : (
          <div className="space-y-2">
            {dueTasks.map((task) => (
              <Card key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-slate-500">Every {task.intervalDays} days</p>
                </div>
                <Badge tone={dueTone(task.nextDueAt, now)}>{dueLabel(task.nextDueAt, now)}</Badge>
                <form action={completeTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    Done
                  </SubmitButton>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Recent lists</h2>
        {lists.length === 0 ? (
          <EmptyState>
            No lists yet.{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              Create one
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lists.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <Card className="transition hover:border-slate-400">
                  <p className="font-medium">{list.title}</p>
                  <p className="text-xs text-slate-500">{list._count.items} items</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-medium">Recipes</p>
            <p className="text-xs text-slate-500">{recipeCount} saved in this home</p>
          </div>
          <ButtonLink href="/recipes" variant="secondary">
            Browse
          </ButtonLink>
        </Card>
      </section>
    </>
  );
}

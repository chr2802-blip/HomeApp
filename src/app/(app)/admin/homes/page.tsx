import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHome, deleteHome, switchHome } from "@/app/actions/admin";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { ActionForm } from "@/components/action-form";

export default async function HomesPage() {
  const user = await requireSuperAdmin();

  const homes = await prisma.home.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { members: true, lists: true, tasks: true, recipes: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Homes"
        description="Every home on this installation. Switch into one to administer it."
      />

      <Card className="mb-6">
        <ActionForm
          action={createHome}
          submitLabel="Create home"
          successLabel="Home created."
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="home-name">New home name</Label>
            <Input id="home-name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="home-address">Address (optional)</Label>
            <Input id="home-address" name="address" />
          </div>
        </ActionForm>
      </Card>

      {homes.length === 0 ? (
        <EmptyState>No homes yet — create the first one above.</EmptyState>
      ) : (
        <div className="space-y-3">
          {homes.map((home) => (
            <Card key={home.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{home.name}</p>
                  {home.id === user.homeId && <Badge tone="green">Active</Badge>}
                </div>
                {home.address && <p className="text-xs text-slate-500">{home.address}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {home._count.members} members · {home._count.lists} lists ·{" "}
                  {home._count.tasks} tasks · {home._count.recipes} recipes
                </p>
              </div>
              {home.id !== user.homeId && (
                <form action={switchHome}>
                  <input type="hidden" name="homeId" value={home.id} />
                  <Button variant="secondary">Switch to</Button>
                </form>
              )}
              {/* No Edit: a home is renamed from inside it, under Administration. */}
              <ItemMenu
                name="homeId"
                id={home.id}
                label={home.name}
                deleteAction={deleteHome}
                deleteTitle="Delete home"
                deleteMessage={`Permanently delete "${home.name}"? Its ${home._count.lists} lists, ${home._count.tasks} tasks and ${home._count.recipes} recipes go with it, and its ${home._count.members} members lose this home. This cannot be undone.`}
                className="-mr-2"
              />
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Deleting a home permanently removes its lists, tasks and recipes. Its members keep
        their accounts and whatever other homes they are in.
      </p>
    </>
  );
}

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHome, deleteHome, switchHome } from "@/app/actions/admin";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { ActionForm } from "@/components/action-form";
import { sayIn } from "@/lib/copy/say";
import { HOMES } from "@/lib/copy/homes";

export default async function HomesPage() {
  const user = await requireSuperAdmin();
  const say = sayIn(user.homeLanguage);

  const homes = await prisma.home.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { members: true, lists: true, tasks: true, recipes: true } },
    },
  });

  return (
    <>
      <PageHeader title={say(HOMES.homes)} description={say(HOMES.everyHomeSwitchToAdminister)} />

      <Card className="mb-6">
        <ActionForm
          action={createHome}
          submitLabel={say(HOMES.createHome)}
          successLabel={say(HOMES.homeCreated)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="home-name">{say(HOMES.newHomeName)}</Label>
            <Input id="home-name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="home-address">{say(HOMES.address)}</Label>
            <Input id="home-address" name="address" />
          </div>
        </ActionForm>
      </Card>

      {homes.length === 0 ? (
        <EmptyState>{say(HOMES.noHomesCreateFirst)}</EmptyState>
      ) : (
        <div className="space-y-3">
          {homes.map((home) => (
            <Card key={home.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{home.name}</p>
                  {home.id === user.homeId && <Badge tone="green">{say(HOMES.active)}</Badge>}
                </div>
                {home.address && <p className="text-xs text-slate-500">{home.address}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {say(HOMES.homeStats, {
                    members: home._count.members,
                    lists: home._count.lists,
                    tasks: home._count.tasks,
                    recipes: home._count.recipes,
                  })}
                </p>
              </div>
              {home.id !== user.homeId && (
                <form action={switchHome}>
                  <input type="hidden" name="homeId" value={home.id} />
                  <Button variant="secondary">{say(HOMES.switchTo)}</Button>
                </form>
              )}
              {/* No Edit: a home is renamed from inside it, under its own Settings. */}
              <ItemMenu
                name="homeId"
                id={home.id}
                label={home.name}
                deleteAction={deleteHome}
                deleteTitle={say(HOMES.deleteHome)}
                deleteMessage={say(HOMES.deleteHomeMessage, {
                  name: home.name,
                  lists: home._count.lists,
                  tasks: home._count.tasks,
                  recipes: home._count.recipes,
                  members: home._count.members,
                })}
                className="-mr-2"
              />
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">{say(HOMES.deletingRemovesContent)}</p>
    </>
  );
}

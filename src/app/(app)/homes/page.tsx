import { requireUser } from "@/lib/auth";
import { switchHome } from "@/app/actions/admin";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { PhotoAvatar } from "@/components/photo";
import { HomeDot } from "@/components/home-dot";
import { sayIn } from "@/lib/copy/say";
import { HOMES } from "@/lib/copy/homes";

/**
 * Every home this person belongs to, and the way between them.
 *
 * It is also where anybody with no home at all is sent, because it is the only page
 * that has something to tell them: the rest of the app is one household's lists, tasks
 * and recipes, and there is no household to show.
 */
export default async function HomesPage() {
  const user = await requireUser();
  const say = sayIn(user.homeLanguage);

  return (
    <>
      <PageHeader
        title={say(HOMES.yourHomes)}
        description={say(HOMES.everywhereYouAreAMember)}
        action={
          user.role === "SUPER_ADMIN" ? (
            <ButtonLink href="/admin/homes" variant="secondary">
              {say(HOMES.allHomes)}
            </ButtonLink>
          ) : undefined
        }
      />

      {user.homes.length === 0 ? (
        <EmptyState icon="🏠">
          <p>{say(HOMES.notInAHomeYet)}</p>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {user.homes.map((home) => (
            <Card key={home.id} className="flex flex-wrap items-center gap-3">
              {/* Decorative: the home's name is right beside it. */}
              <PhotoAvatar photoId={home.photoId} alt="" className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <HomeDot theme={home.theme} />
                  <p className="font-medium">{home.name}</p>
                  {home.id === user.homeId && <Badge tone="green">{say(HOMES.active)}</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {home.role === "ADMIN" ? say(HOMES.youRunThisHome) : say(HOMES.member)}
                </p>
              </div>
              {home.id !== user.homeId && (
                <form action={switchHome}>
                  <input type="hidden" name="homeId" value={home.id} />
                  <Button variant="secondary">{say(HOMES.switchTo)}</Button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

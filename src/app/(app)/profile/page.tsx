import { requireUser } from "@/lib/auth";
import { updateOwnProfile } from "@/app/actions/admin";
import { Card, Input, Label, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoAvatar } from "@/components/photo";
import { PhotoField } from "@/components/photo-field";
import { NotificationSetup, TestPushButton } from "@/components/notification-setup";
import { sayIn } from "@/lib/copy/say";
import { PROFILE } from "@/lib/copy/profile";
import { HOMES } from "@/lib/copy/homes";
import { NAV } from "@/lib/copy/nav";
import { NavPinsSetting } from "@/components/nav-pins";
import { DashboardTilesSetting } from "@/components/dashboard-tiles";
import { TILES } from "@/lib/copy/tiles";
import { homeDb } from "@/lib/home-db";
import { faceOf } from "@/lib/emoji";
import { readTiles } from "@/lib/dashboard-tiles";

/**
 * You, rather than any of your homes: your name, your password, your picture and
 * whether reminders reach you.
 *
 * It is one page for somebody in three households, because none of this is a household's
 * business — a name changed here is the name every home sees. That is also why it sits
 * in the header's menu beside Settings rather than inside them: settings belong to a
 * home, and a person does not.
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const say = sayIn(user.homeLanguage);
  // The home open now's lists: a tile can be one of them, and one from another home is
  // not offered here (it still stands, for when that home is open).
  const lists = user.homeId
    ? await homeDb(user.homeId).list.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, emoji: true } })
    : [];
  const tileLists = lists.map((list) => ({ id: list.id, title: list.title, face: faceOf(list) }));
  const tiles = readTiles(user.dashboardTiles, new Set(lists.map((list) => list.id)));

  return (
    <>
      <PageHeader title={say(PROFILE.title)} description={say(PROFILE.description)} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(PROFILE.yourDetailsHeading)}
        </h2>
        <Card>
          <ActionForm
            action={updateOwnProfile}
            submitLabel={say(PROFILE.saveProfile)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Label htmlFor="profile-name">{say(PROFILE.name)}</Label>
              <Input id="profile-name" name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-password">{say(PROFILE.newPassword)}</Label>
              <Input
                id="profile-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={say(PROFILE.leaveBlankToKeep)}
                minLength={8}
              />
            </div>
            {/* Asked for only because the field above exists, and left blank by
                everybody who came here to change their name. A session cookie is a
                bearer token, so this is the one thing on the page that somebody who
                merely has the browser does not also have — and without it, changing a
                name and taking the account over are the same form. */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="profile-current-password">{say(PROFILE.currentPassword)}</Label>
              <Input
                id="profile-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder={say(PROFILE.onlyNeededForNewPassword)}
              />
              <p className="text-xs text-slate-500">{say(PROFILE.changingPasswordSignsOut)}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{say(PROFILE.email)}</Label>
              {/* Shown, not edited: it is what an invitation was sent to and what you
                  sign in with, and changing it is somebody else's job. */}
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
            {/* A picture is stored under a home, so there has to be one to store it
                under. Somebody in no home at all sees the rest of the form and no
                picture field, rather than one whose every upload would be refused. */}
            {user.homeId && (
              <div className="sm:col-span-2">
                <PhotoField
                  defaultPhotoId={user.photoId}
                  label={say(PROFILE.yourPicture)}
                  hint={say(PROFILE.yourPictureHint)}
                />
              </div>
            )}
          </ActionForm>
        </Card>
      </section>

      {/* Only a phone has a tab bar, so only a phone is offered the choice of its two places. */}
      <section className="mb-8 md:hidden">
        <h2 className="mb-1 text-sm font-semibold text-slate-500 uppercase">{say(NAV.profileHeading)}</h2>
        <p className="mb-3 text-sm text-slate-500">{say(NAV.profileHint)}</p>
        <Card>
          <NavPinsSetting pins={user.navPins} />
        </Card>
      </section>

      {user.homeId && (
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold text-slate-500 uppercase">{say(TILES.profileHeading)}</h2>
          <p className="mb-3 text-sm text-slate-500">{say(TILES.profileHint)}</p>
          <Card>
            <DashboardTilesSetting tiles={tiles} lists={tileLists} />
          </Card>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(PROFILE.notificationsHeading)}
        </h2>
        <div className="space-y-3">
          <NotificationSetup showEnabled />
          <Card>
            <p className="mb-3 text-sm text-slate-500">{say(PROFILE.remindersSentHint)}</p>
            <TestPushButton />
          </Card>
        </div>
      </section>

      {user.homes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
            {say(PROFILE.yourHomesHeading)}
          </h2>
          <Card className="divide-y divide-slate-100 p-0">
            {user.homes.map((home) => (
              <div key={home.id} className="flex items-center gap-3 px-4 py-3">
                {/* Decorative: the home's name is right beside it. */}
                <PhotoAvatar photoId={home.photoId} alt="" className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{home.name}</p>
                  <p className="text-xs text-slate-500">
                    {say(home.role === "ADMIN" ? HOMES.youRunThisHome : HOMES.member)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}

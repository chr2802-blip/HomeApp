import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "@/lib/home-db";
import { canSealSecrets } from "@/lib/secret-box";
import { connectNemlig, disconnectNemlig } from "@/app/actions/nemlig";
import { Card, Input, Label } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ItemMenu } from "@/components/item-menu";
import { sayIn } from "@/lib/copy/say";
import { NEMLIG } from "@/lib/copy/nemlig";

/**
 * The household's nemlig.com login, on `/settings`.
 *
 * Drawn only where the installation can keep a secret (`NEMLIG_SECRET_KEY`), because a
 * login this app could not seal is one it must not take. Connected, it says which email
 * and nothing else — the password is never read back out, masked or otherwise — with
 * changing and disconnecting behind the three dots like every other stored thing.
 *
 * The fields are `email` and `password` with the browser's own autocomplete words
 * switched off: these are not this app's login, and a password manager offering the
 * HomeHub password here is offering the wrong one.
 */
export async function NemligSettings({ homeId, language }: { homeId: string; language: HomeLanguage }) {
  if (!canSealSecrets()) return null;
  const say = sayIn(language);
  const account = await homeDb(homeId).nemligAccount.findUnique({
    where: { homeId },
    select: { username: true },
  });

  const fields = (
    <>
      <div className="space-y-1">
        <Label htmlFor="nemlig-email">{say(NEMLIG.email)}</Label>
        <Input
          id="nemlig-email"
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={account?.username ?? ""}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nemlig-password">{say(NEMLIG.password)}</Label>
        <Input id="nemlig-password" name="password" type="password" autoComplete="new-password" required />
        <p className="text-xs text-slate-500">{say(NEMLIG.passwordHint)}</p>
      </div>
    </>
  );

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{say(NEMLIG.heading)}</h2>
      <Card>
        {account ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm break-words">
              {say(NEMLIG.connectedAs, { email: account.username })}
            </p>
            <ItemMenu
              name="homeId"
              id={homeId}
              label={say(NEMLIG.heading)}
              editLabel={say(NEMLIG.changeLogin)}
              editTitle={say(NEMLIG.changeLogin)}
              editSubmitLabel={say(NEMLIG.saveLogin)}
              editAction={connectNemlig}
              deleteLabel={say(NEMLIG.disconnect)}
              deleteTitle={say(NEMLIG.disconnectTitle)}
              deleteConfirmLabel={say(NEMLIG.disconnect)}
              deleteMessage={say(NEMLIG.disconnectMessage)}
              deleteAction={disconnectNemlig}
              className="-mr-2"
            >
              {fields}
            </ItemMenu>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">{say(NEMLIG.intro)}</p>
            <ActionForm action={connectNemlig} submitLabel={say(NEMLIG.connect)} className="grid gap-4 sm:grid-cols-2">
              {fields}
            </ActionForm>
          </>
        )}
      </Card>
    </section>
  );
}

import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { ADMIN_INDEX, SYSTEM } from "@/lib/copy/admin";
import { HOMES } from "@/lib/copy/homes";

/**
 * The installation, which is the super admin's business and nobody else's: every home
 * on it, and how the deployment itself is doing.
 *
 * Running a single household is not here. That is the home's own Settings, reached from
 * its name in the header by whoever runs it — an admin of one household would otherwise
 * be given a tab leading to two pages they cannot open.
 *
 * The two below are the whole of it, so this page is the pair of them rather than a
 * dashboard of its own: anything worth showing here is already on the page it links to.
 */
export default async function AdminPage() {
  const user = await requireSuperAdmin();
  const say = sayIn(user.homeLanguage);

  return (
    <>
      <PageHeader title={say(ADMIN_INDEX.title)} description={say(ADMIN_INDEX.description)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Entry
          href="/admin/system"
          title={say(SYSTEM.title)}
          description={say(ADMIN_INDEX.systemDescription)}
        />
        <Entry
          href="/admin/homes"
          title={say(HOMES.homes)}
          description={say(ADMIN_INDEX.homesDescription)}
        />
      </div>
    </>
  );
}

function Entry({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} prefetch className="pressable block rounded-xl active:scale-[0.98]">
      <Card className="h-full transition hover:border-slate-300 hover:shadow-md">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </Card>
    </Link>
  );
}

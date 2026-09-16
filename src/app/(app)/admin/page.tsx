import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

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
  await requireSuperAdmin();

  return (
    <>
      <PageHeader
        title="Admin"
        description="This installation, rather than any one household."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Entry
          href="/admin/system"
          title="System"
          description="Database health, the reminder job's recent runs, what is stored and the slowest queries of the last day."
        />
        <Entry
          href="/admin/homes"
          title="Homes"
          description="Every home on this installation. Create one, switch into one to administer it, or delete one."
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
    <Link href={href} prefetch className="pressable block rounded-xl active:scale-[0.99]">
      <Card className="h-full transition hover:border-slate-300 hover:shadow-md">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </Card>
    </Link>
  );
}

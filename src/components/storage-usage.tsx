import {
  STORAGE_KINDS,
  STORAGE_LABELS,
  formatBytes,
  formatShare,
  getHomeStorage,
  getInstallationStorage,
  type StorageKind,
} from "@/lib/storage";
import { Card } from "@/components/ui";
import { DonutChart, type DonutSlice } from "@/components/donut-chart";
import { HomeDot } from "@/components/home-dot";

/**
 * What the household is using the database for, and what the installation as a whole is.
 *
 * Two readings of the same question, drawn the same way, because they are asked by two
 * different people: whoever runs a home wants to know why theirs has grown, and the
 * super admin wants to know which home it was.
 *
 * Almost all of it is pictures — a recipe's photo is a hundred times its text — which is
 * why the slices are named after the thing holding the picture rather than after the
 * picture. "Recipes: 40 MB" is an answer somebody can act on; "Photos: 40 MB" is the
 * same number with the useful half taken out.
 */

/** Each kind's colour. Fixed, and the same in every home: see globals.css. */
const KIND_COLOR: Record<StorageKind, string> = {
  recipes: "var(--chart-recipes)",
  lists: "var(--chart-lists)",
  tasks: "var(--chart-tasks)",
  rest: "var(--chart-rest)",
};

/**
 * How many households are named in the ring before the tail is gathered up.
 *
 * Past this the slices are thinner than the gaps between them and the legend is longer
 * than the chart, so the small ones become one quiet slice that still adds up to the
 * right total.
 */
const NAMED_HOMES = 7;

/** One row of the list beside a ring: the colour, what it is, and how much of it. */
function LegendRow({
  swatch,
  label,
  bytes,
  total,
}: {
  swatch: React.ReactNode;
  label: string;
  bytes: number;
  total: number;
}) {
  return (
    <li className="flex items-center gap-2.5 py-1 text-sm">
      {swatch}
      <span className="min-w-0 flex-1 truncate text-slate-600">{label}</span>
      <span className="shrink-0 font-medium tabular-nums">{formatBytes(bytes)}</span>
      <span className="w-10 shrink-0 text-right text-xs text-slate-400 tabular-nums">
        {formatShare(bytes, total)}
      </span>
    </li>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * A ring and the list that reads it out, side by side on anything wider than a phone.
 *
 * The list is not a caption: it is the chart's accessible copy, which is why the ring
 * itself is hidden from a screen reader and every row here carries a size and a share in
 * words. A colour never tells two slices apart on its own.
 */
function Chart({
  title,
  value,
  unit,
  slices,
  total,
}: {
  title: string;
  value: string;
  unit: string;
  slices: (DonutSlice & { swatch?: React.ReactNode })[];
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <DonutChart slices={slices} value={value} label={unit} className="h-40 w-40" />
      {/* Capped, because the sizes are pushed to the far edge of whatever they are
          given: on a wide card the label and its number end up a hand's width apart
          and stop reading as one row. */}
      <div className="min-w-0 w-full flex-1 self-stretch sm:max-w-md">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {title}
        </h3>
        <ul className="divide-y divide-slate-100">
          {slices.map((slice) => (
            <LegendRow
              key={slice.key}
              swatch={slice.swatch ?? <Swatch color={slice.color} />}
              label={slice.label}
              bytes={slice.value}
              total={total}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * How it was counted, said once under each chart.
 *
 * Worth saying because the number will not match anything a hosting dashboard reports:
 * this is what the rows themselves hold, and a database is always larger than its rows.
 */
function Footnote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-4 text-xs text-slate-500">
      Measured as Postgres stores it, after compression. Indexes and the database&rsquo;s own
      overhead are not counted, so the whole database is always somewhat larger than this.
      {children ? " " : ""}
      {children}
    </p>
  );
}

function kindSlices(kinds: Record<StorageKind, number>) {
  return STORAGE_KINDS.map((kind) => ({
    key: kind,
    label: STORAGE_LABELS[kind],
    value: kinds[kind],
    color: KIND_COLOR[kind],
  }));
}

/** One household's own footprint, on its Settings page. */
export async function StorageUsage({ homeId }: { homeId: string }) {
  const storage = await getHomeStorage(homeId);

  return (
    <Card>
      <Chart
        title="What it is"
        value={formatBytes(storage.total)}
        unit="in this home"
        slices={kindSlices(storage.kinds)}
        total={storage.total}
      />
      <Footnote>A picture counts towards whatever is showing it.</Footnote>
    </Card>
  );
}

/**
 * The installation: which household it is going on, and what it is going on.
 *
 * Crossing homes is the whole point of this one, which is why it is on the super
 * admin's System page and nowhere else.
 *
 * A home's slice is that home's own colour, the same one its dot wears in the header's
 * menu and its swatch wears in the picker — a household is recognised by its colour
 * here as everywhere else. Two homes that picked the same one are told apart by the gap
 * between the slices and by their names in the list, as they are in that menu.
 */
export async function StorageAcrossHomes() {
  const storage = await getInstallationStorage();

  const named = storage.homes.slice(0, NAMED_HOMES).filter((home) => home.bytes > 0);
  const tail = storage.homes.slice(named.length);
  const tailBytes = tail.reduce((running, home) => running + home.bytes, 0);

  const homeSlices: (DonutSlice & { swatch?: React.ReactNode })[] = named.map((home) => ({
    key: home.id,
    label: home.name,
    value: home.bytes,
    color: "var(--accent)",
    theme: home.theme,
    swatch: <HomeDot theme={home.theme} />,
  }));

  if (tailBytes > 0) {
    homeSlices.push({
      key: "other-homes",
      label: `${tail.length} smaller ${tail.length === 1 ? "home" : "homes"}`,
      value: tailBytes,
      color: "var(--chart-rest)",
    });
  }

  const total = formatBytes(storage.total);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {/* The same total twice, cut two ways. The words under each number say which
            cut it is, because two rings reading "308 kB · stored" side by side look
            like the same chart drawn twice. */}
        <Card>
          <Chart
            title="Across homes"
            value={total}
            unit={`in ${storage.homes.length} ${storage.homes.length === 1 ? "home" : "homes"}`}
            slices={homeSlices}
            total={storage.total}
          />
        </Card>
        <Card>
          <Chart
            title="What it is"
            value={total}
            unit="of content"
            slices={kindSlices(storage.kinds)}
            total={storage.total}
          />
        </Card>
      </div>
      <Footnote>A picture counts towards whatever is showing it.</Footnote>
    </>
  );
}

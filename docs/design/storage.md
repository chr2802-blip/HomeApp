# How a household's storage is measured

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## How much room a household takes is measured by Postgres, not counted up here

`src/lib/storage.ts` answers "how big is this home", and because a picture's bytes live
in the database rather than in object storage that is a real question with a real number.
`/settings` shows one household its own, as a donut with the total in the hole; **Admin →
System** shows the super admin the same total cut two ways — by home and by kind — which
is one of the few places crossing homes is the point.

It is raw SQL because `pg_column_size` is the only thing that knows what a row occupies:
a value is stored compressed, and adding up `length()` on the way past reports the size of
something the database never wrote. **A whole row (`t.*`) for everything except `Photo`,
whose two blobs are measured column by column.** `pg_column_size` on a column reads the
size out of the TOAST pointer, while building the composite for a whole row fetches the
bytes back — so `pg_column_size(p.*)` would pull every picture in the home through the
connection in order to weigh it, on a page somebody is waiting for.

**A picture counts towards the thing showing it**, which is why the slices are Recipes,
Lists and Tasks and not Photos. A recipe's photo is a hundred times its text, so "Recipes:
40 MB" is something a household can act on and "Photos: 40 MB" is the same number with the
useful half taken out. What is left — the home record, its members and invites, the home's
own picture, the avatars filed here and the uploads nobody finished — is `rest`, drawn in
the one deliberately quiet colour.

The home is bound into the query rather than carried by `homeDb`, which scopes Prisma's
model calls and has nothing to say about raw SQL. `getHomeStorage` takes a home id and
filters the union by it; `getInstallationStorage` names no home at all and is the super
admin's alone.

**A kind is a name in TypeScript and a colour in `globals.css`, and nothing but
`tests/unit/storage.test.ts` holds the two together.** A `var(--chart-whatever)` nobody
defined resolves to nothing, which draws a slice with no stroke: the legend beside it is
still complete and still right, and the ring is simply short a piece. That is a chart
quietly lying about a total, which is worse than one that is visibly broken — and it is
the same failure a theme with no block in the stylesheet has, caught the same way.

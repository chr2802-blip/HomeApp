import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Production's Postgres is a Supabase project, which serves every table in `public` over
 * its Data API to anybody holding the publishable key — and this app hands that key to
 * every signed-in phone for Realtime. Row-level security, with no policy, is what keeps
 * those tables to Prisma alone (`20261004190000_close_supabase_data_api`).
 *
 * Prisma creates a table with RLS off, so a migration that adds one has to turn it on as
 * well. This is the check that it did: it reads the migrated database rather than a list,
 * so a new table cannot be forgotten.
 */
describe("Supabase's Data API", () => {
  it("finds row-level security on every table the migrations created", async () => {
    const tables = await prisma.$queryRaw<{ name: string; rls: boolean }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    expect(tables.length).toBeGreaterThan(10);
    expect(tables.filter((table) => !table.rls).map((table) => table.name)).toEqual([]);
  });

  it("leaves the app itself reading and writing as before", async () => {
    const home = await prisma.home.create({ data: { name: "Still ours" } });
    expect(await prisma.home.findUnique({ where: { id: home.id } })).not.toBeNull();
  });
});

import { prisma } from "@/lib/prisma";
import { testDatabaseName } from "../../scripts/test-db-url.mjs";

// Last line of defence: if anything ever pointed the suite at a real database,
// importing this module fails before a single row is deleted.
testDatabaseName(process.env.DATABASE_URL ?? "");

let tableList: string | null = null;

async function tables() {
  if (tableList) return tableList;

  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  tableList = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  return tableList;
}

/** Empties every table so each test starts from a known, empty database. */
export async function resetDatabase() {
  const list = await tables();
  if (!list) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect() {
  await prisma.$disconnect();
}

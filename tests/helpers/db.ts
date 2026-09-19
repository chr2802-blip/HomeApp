import { prisma } from "@/lib/prisma";
import { testDatabaseName } from "../../scripts/test-db-url.mjs";
import { truncateAll } from "../../scripts/test-db.mjs";

// Last line of defence: if anything ever pointed the suite at a real database,
// importing this module fails before a single row is deleted.
testDatabaseName(process.env.DATABASE_URL ?? "");

/** Empties every table so each test starts from a known, empty database. */
export async function resetDatabase() {
  await truncateAll(prisma);
}

export async function disconnect() {
  await prisma.$disconnect();
}

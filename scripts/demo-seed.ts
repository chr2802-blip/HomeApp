/**
 * `npm run db:demo` — the demo household (`demo-household.ts`) in the dev database, in one
 * command. Kept apart from what it makes so a browser test can make the same household in
 * its own database without running this.
 */
import { seedDevDatabase } from "./demo-household";

seedDevDatabase().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

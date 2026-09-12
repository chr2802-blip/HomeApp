import { disconnect, prepareDatabase } from "./helpers/database";

/** Creates and migrates the E2E database before the app server is asked for a page. */
export default async function globalSetup() {
  await prepareDatabase();
  await disconnect();
}

import { requireHomeUser } from "./auth";
import { assertHomeAccess } from "./access";

/**
 * Builds the "fetch this record and check it belongs to the caller's home" step that
 * every action performs before touching a list, task or recipe.
 *
 * The check lives in one place, so a new kind of record cannot accidentally be reached
 * across homes by forgetting to repeat it.
 */
export function homeScoped<T extends { homeId: string }>(
  label: string,
  find: (id: string) => Promise<T | null>,
) {
  return async function inScope(id: string): Promise<T> {
    const user = await requireHomeUser();
    const record = await find(id);
    if (!record) throw new Error(`${label} not found`);
    assertHomeAccess(user, record.homeId);
    return record;
  };
}

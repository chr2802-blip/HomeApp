import { NemligError, type NemligFailure, type NemligProduct } from "./nemlig";

/**
 * What "Send to Nemlig" decides, kept apart from what it asks Nemlig — so the matching
 * and the filling of the basket are tested with Nemlig played by a function, and the
 * actions in `src/app/actions/nemlig.ts` are only the wiring between the two.
 */

/**
 * How long a press may spend talking to Nemlig before it stops starting new requests.
 * The route's `maxDuration` is 60s; this leaves room for the login, one call still in
 * flight (`NEMLIG_CALL_TIMEOUT_MS`), and the database. An item not reached in time is
 * reported as having timed out rather than cutting the whole press off unanswered.
 */
export const NEMLIG_BUDGET_MS = 40_000;

/** Searches in flight at once. Enough to make a long list quick, few enough to be polite. */
export const NEMLIG_CONCURRENCY = 4;

/** A product chosen for this line before, as `NemligChoice` keeps it. */
export type Remembered = { productId: string; name: string; imageUrl: string | null };

/** One open line of the list, as the review is asked about it. */
export type BasketLine = {
  itemId: string;
  /** `pantryKey` of the text — what a choice is remembered under. */
  key: string;
  /** The list's own words, shown as the row's heading. */
  text: string;
  /** What is searched for: `shoppingText` of the line, amount and unit taken off. */
  term: string;
  quantity: number;
};

export type Proposal = BasketLine & {
  /** What would go in the basket; null is "nothing to propose". */
  chosen: NemligProduct | null;
  /** The chosen product is the one this household picked last time. */
  remembered: boolean;
  /** Everything the search found, to swap to. */
  results: NemligProduct[];
  /** Why there is nothing chosen: Nemlig found nothing, or failed to answer. */
  problem: "notFound" | NemligFailure | null;
};

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter(Boolean);

/**
 * How well a product's name answers a search term, per word of the term:
 * - 4 for the word itself in the name;
 * - 3 for the word *ending* a longer one — "mælk" in "letmælk". Danish runs its
 *   compounds together and puts what the thing *is* last, so letmælk is a kind of milk;
 * - 1 for the word *starting* one — "mælk" in "mælkechokolade", which is a chocolate;
 * - 0 for missing.
 * Summed, and a name saying nothing but the term itself beats one that merely has it.
 */
function nameScore(term: string, name: string): { covers: boolean; score: number } {
  const wanted = words(term);
  const have = words(name);
  let score = 0;
  let covers = true;
  for (const word of wanted) {
    if (have.includes(word)) score += 4;
    else if (have.some((part) => part.endsWith(word))) score += 3;
    else if (have.some((part) => part.startsWith(word))) score += 1;
    else covers = false;
  }
  if (have.length === wanted.length && covers) score += 1;
  return { covers, score };
}

/**
 * The product to propose for a term, or null where none is worth proposing.
 *
 * Only something that can be delivered is ever proposed — a sold-out product in the
 * basket is a line that silently never arrives. Among those, one whose name carries
 * every word of the term comes first, closer matches before looser ones; ties keep
 * Nemlig's own order, which already knows that "mælk" usually means a litre of milk and
 * not a milk chocolate. Where nothing names the term at all, Nemlig's first available
 * answer is still proposed: the household sees it on the review sheet before anything
 * is added, which is what the sheet is for.
 */
export function pickBestMatch(term: string, products: NemligProduct[]): NemligProduct | null {
  const ranked = products
    .map((product, order) => ({ product, order, ...nameScore(term, product.name) }))
    .filter((entry) => entry.product.available)
    .sort(
      (a, b) =>
        Number(b.covers) - Number(a.covers) || b.score - a.score || a.order - b.order,
    );
  return ranked[0]?.product ?? null;
}

/**
 * The proposal for one line: the remembered product where there is one, else the best
 * match. A remembered product is proposed even when this search did not bring it back —
 * it was found once and the household chose it, and an add by id does not need it to be
 * among today's eight — drawn from what was kept, with no price, since a kept price would
 * be a stale one.
 */
export function proposeFor(
  line: BasketLine,
  results: NemligProduct[],
  remembered: Remembered | undefined,
): Proposal {
  if (remembered) {
    const fresh = results.find((product) => product.id === remembered.productId);
    if (!fresh || fresh.available) {
      return {
        ...line,
        results,
        remembered: true,
        problem: null,
        chosen: fresh ?? {
          id: remembered.productId,
          name: remembered.name,
          imageUrl: remembered.imageUrl,
          price: null,
          size: "",
          brand: "",
          available: true,
        },
      };
    }
    // Remembered, but sold out today: fall through to the best of what is in.
  }
  const chosen = pickBestMatch(line.term, results);
  return { ...line, results, remembered: false, chosen, problem: chosen ? null : "notFound" };
}

const failureOf = (error: unknown): NemligFailure =>
  error instanceof NemligError ? error.kind : "unavailable";

/**
 * Runs `work` over `items`, `limit` at a time, starting nothing once `deadline` has
 * passed — those come back as `late` instead. One item failing never stops the others.
 */
async function eachWithin<T, R>(
  items: T[],
  limit: number,
  deadline: number,
  now: () => number,
  work: (item: T) => Promise<R>,
  late: (item: T) => R,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index]!;
      results[index] = now() >= deadline ? late(item) : await work(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Searches Nemlig for every line and proposes a product for each. A search that fails
 * is that line's problem only, named by kind, so the sheet can say "Nemlig did not
 * answer" beside one row and still offer the rest.
 */
export async function proposeAll(
  lines: BasketLine[],
  remembered: Map<string, Remembered>,
  search: (term: string) => Promise<NemligProduct[]>,
  { now = Date.now, budgetMs = NEMLIG_BUDGET_MS, concurrency = NEMLIG_CONCURRENCY } = {},
): Promise<Proposal[]> {
  const deadline = now() + budgetMs;
  const fail = (line: BasketLine, problem: NemligFailure): Proposal => ({
    ...line,
    results: [],
    chosen: null,
    remembered: false,
    problem,
  });

  return eachWithin(
    lines,
    concurrency,
    deadline,
    now,
    async (line) => {
      try {
        return proposeFor(line, await search(line.term), remembered.get(line.key));
      } catch (error) {
        return fail(line, failureOf(error));
      }
    },
    (line) => fail(line, "timeout"),
  );
}

/** One line the household confirmed on the review sheet. */
export type BasketChoice = {
  itemId: string;
  key: string;
  text: string;
  quantity: number;
  product: { id: string; name: string; imageUrl: string | null };
};

export type BasketOutcome = {
  added: BasketChoice[];
  failed: (BasketChoice & { reason: NemligFailure; message: string })[];
};

/**
 * Puts every chosen line in the basket, one after another — a basket is one shared
 * thing on Nemlig's side, and adding to it in parallel is asking for two writes to race
 * over it. A line that fails is recorded and the next one is tried; nothing one line does
 * stops the rest. A login that has stopped working mid-way (`login`) does stop it,
 * because every line after it would fail the same way, and is reported against each.
 */
export async function fillBasket(
  choices: BasketChoice[],
  add: (productId: string, quantity: number) => Promise<void>,
  { now = Date.now, budgetMs = NEMLIG_BUDGET_MS } = {},
): Promise<BasketOutcome> {
  const deadline = now() + budgetMs;
  const outcome: BasketOutcome = { added: [], failed: [] };
  let stopped: { reason: NemligFailure; message: string } | null = null;

  for (const choice of choices) {
    if (stopped) {
      outcome.failed.push({ ...choice, ...stopped });
      continue;
    }
    if (now() >= deadline) {
      outcome.failed.push({ ...choice, reason: "timeout", message: "Ran out of time." });
      continue;
    }
    try {
      await add(choice.product.id, choice.quantity);
      outcome.added.push(choice);
    } catch (error) {
      const reason = failureOf(error);
      const message = error instanceof Error ? error.message : String(error);
      outcome.failed.push({ ...choice, reason, message });
      if (reason === "login") stopped = { reason, message };
    }
  }
  return outcome;
}

/**
 * Kroner as the household's own language writes a price — "12,95" in Danish, "12.95" in
 * English — always with the øre, since that is how a shelf label reads.
 */
export function formatKroner(amount: number, language: "EN" | "DA"): string {
  return new Intl.NumberFormat(language === "DA" ? "da-DK" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

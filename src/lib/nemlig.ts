import { randomUUID } from "crypto";
import { dueAtDaysFrom, formatInZone } from "./time";

/**
 * A client for nemlig.com's own web API — the one its website calls. Unofficial: Nemlig
 * publishes nothing, and what is here was worked out by nemlig-shopper
 * (github.com/mhattingpete/nemlig-shopper, MIT), whose `api.py` this follows endpoint for
 * endpoint and header for header. It is a port rather than a dependency because that
 * package is Python and this app runs only Node, and because it answers "Nemlig did not
 * respond" and "there is no such product" with the same empty list — and the review
 * sheet has to tell a household which one happened.
 *
 * So every failure here is a `NemligError` carrying what *kind* of failure it was, and
 * an empty search result means only that Nemlig found nothing.
 *
 * Only fixed addresses on nemlig.com are ever requested, so this is a plain `fetch`
 * rather than `safeFetch`: nothing here fetches an address somebody else chose.
 *
 * It fills a basket and nothing else. There is deliberately no checkout, no payment, no
 * delivery slot and no clearing of the basket in here, so nothing built on it can do
 * any of those by mistake.
 */

/**
 * `NEMLIG_BASE_URL` points both halves at one stand-in — `e2e/helpers/nemlig-stub.mjs`
 * in the browser suite and for screenshots, the way `ANTHROPIC_BASE_URL` points the
 * readers at theirs. Unset, which is production, they are Nemlig's own.
 */
const api = () => (process.env.NEMLIG_BASE_URL ? `${process.env.NEMLIG_BASE_URL}/webapi` : "https://www.nemlig.com/webapi");
const gateway = () =>
  process.env.NEMLIG_BASE_URL
    ? `${process.env.NEMLIG_BASE_URL}/searchgateway/api`
    : "https://webapi.prod.knl.nemlig.it/searchgateway/api";

/** Where a household finishes the shop itself. The address nemlig-shopper sends people to. */
export const NEMLIG_BASKET_URL = "https://www.nemlig.com/basket";

/**
 * How long one request to Nemlig may take. Short, because a list is many requests and
 * the whole press has to finish inside the route's 60s — see `NEMLIG_BUDGET_MS`.
 */
export const NEMLIG_CALL_TIMEOUT_MS = 8_000;

/** How many results a search brings back for the review sheet to offer. */
export const NEMLIG_RESULTS = 8;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

/** The headers Nemlig's own website sends; `version` is the one it checks. */
const SITE_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "User-Agent": USER_AGENT,
  Referer: "https://www.nemlig.com/",
  version: "11.201.0",
  platform: "web",
  "device-size": "desktop",
};

/**
 * What went wrong, in the terms the household is told it:
 * - `login` — Nemlig refused the email and password;
 * - `timeout` — Nemlig took longer than `NEMLIG_CALL_TIMEOUT_MS`;
 * - `unavailable` — Nemlig could not be reached, or answered with a server error;
 * - `changed` — Nemlig answered, but not in the shape this client knows: the API has
 *   moved, and this file wants updating;
 * - `refused` — Nemlig understood the request and said no (sold out, unknown product).
 */
export type NemligFailure = "login" | "timeout" | "unavailable" | "changed" | "refused";

export class NemligError extends Error {
  constructor(
    readonly kind: NemligFailure,
    message: string,
  ) {
    super(message);
    this.name = "NemligError";
  }
}

export type NemligProduct = {
  id: string;
  name: string;
  /** Kroner. Null where Nemlig did not say. */
  price: number | null;
  /** "1 liter", "500 g" — Nemlig's own description of the pack. */
  size: string;
  brand: string;
  imageUrl: string | null;
  available: boolean;
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Nemlig's anonymous delivery slot when it has not said one: tomorrow, 15:00. Searching
 * wants *a* slot to price against, and an anonymous visitor has not chosen one.
 */
function defaultTimeslot(now: Date): string {
  return `${formatInZone(dueAtDaysFrom(1, now), "yyyyMMdd")}15-60-240`;
}

/**
 * One conversation with Nemlig: the cookies it set, the token it handed out, and the
 * stamps its product addresses are built from. Made with `NemligSession.anonymous()` to
 * search, or `NemligSession.login()` to fill a basket — a session is never stored,
 * because every press is a fresh serverless call anyway.
 */
export class NemligSession {
  private readonly cookies = new Map<string, string>();
  private token: string | null = null;
  private timestamp = "AAAAAAAA-YFA_17hS";
  private timeslot: string;
  private timeslotId = 0;
  private userId = "0";
  private loggedIn = false;

  private constructor(now: Date) {
    this.timeslot = defaultTimeslot(now);
  }

  /** A session that can search but not touch a basket. */
  static async anonymous(now = new Date()): Promise<NemligSession> {
    const session = new NemligSession(now);
    await session.refresh();
    return session;
  }

  /** A session logged in as the household — the only kind that can fill its basket. */
  static async login(username: string, password: string, now = new Date()): Promise<NemligSession> {
    const session = new NemligSession(now);
    let answer: unknown;
    try {
      answer = await session.request(`${api()}/login`, {
        method: "POST",
        body: JSON.stringify({ Username: username, Password: password }),
      });
    } catch (error) {
      // A 4xx from the login form is the password being wrong, not the API moving.
      if (error instanceof NemligError && error.kind === "changed") {
        throw new NemligError("login", error.message);
      }
      throw error;
    }
    if (!isObject(answer)) throw new NemligError("changed", "The login answer was not an object.");
    if (answer.RedirectUrl || answer.MergeSuccessful) {
      session.loggedIn = true;
      if (typeof answer.TimeslotUtc === "string") session.timeslot = answer.TimeslotUtc;
      await session.refresh();
      return session;
    }
    const said = typeof answer.ErrorMessage === "string" ? answer.ErrorMessage : "";
    throw new NemligError("login", said || "Nemlig did not accept the login.");
  }

  /**
   * The token, the stamps and the delivery slot, as Nemlig's website asks for them on
   * load. Only the token is required — without it the search gateway answers nothing —
   * so the rest keep their defaults where Nemlig does not say, exactly as nemlig-shopper
   * does.
   */
  private async refresh() {
    const token = await this.request(`${api()}/Token`);
    if (!isObject(token) || typeof token.access_token !== "string") {
      throw new NemligError("changed", "Nemlig handed out no token.");
    }
    this.token = token.access_token;

    const settings = await this.request(`${api()}/v2/AppSettings/Website`).catch(() => null);
    if (isObject(settings) && typeof settings.CombinedProductsAndSitecoreTimestamp === "string") {
      this.timestamp = settings.CombinedProductsAndSitecoreTimestamp;
    }

    if (this.loggedIn) {
      const user = await this.request(`${api()}/user/GetCurrentUser`).catch(() => null);
      const id = isObject(user) ? (user.DebitorId ?? user.Id) : null;
      if (typeof id === "string" || typeof id === "number") this.userId = String(id);
    }

    const spot = await this.request(`${api()}/Order/DeliverySpot`).catch(() => null);
    if (isObject(spot)) {
      if (typeof spot.TimeslotUtc === "string") this.timeslot = spot.TimeslotUtc;
      if (spot.TimeslotId !== undefined && Number.isFinite(Number(spot.TimeslotId))) {
        this.timeslotId = Number(spot.TimeslotId);
      }
    }
  }

  /** Nemlig's products for a term, best first by Nemlig's own ranking. */
  async search(query: string, take = NEMLIG_RESULTS): Promise<NemligProduct[]> {
    const params = new URLSearchParams({
      query,
      take: String(take),
      skip: "0",
      recipeCount: "0",
      timestamp: this.timestamp,
      timeslotUtc: this.timeslot,
      deliveryZoneId: "1",
      includeFavorites: this.userId,
      TimeSlotId: String(this.timeslotId),
    });
    // The gateway answers 400 to a GET carrying a Content-Type, so it gets headers of
    // its own rather than the site's.
    const answer = await this.request(`${gateway()}/search?${params}`, {
      headers: {
        "X-Correlation-Id": randomUUID(),
        Origin: "https://www.nemlig.com",
        Accept: "application/json, text/plain, */*",
        "User-Agent": USER_AGENT,
        Referer: "https://www.nemlig.com/",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      site: false,
    });
    return parseSearch(answer).slice(0, take);
  }

  /** Puts `quantity` of a product in the household's basket. */
  async addToBasket(productId: string, quantity: number): Promise<void> {
    if (!this.loggedIn) throw new NemligError("login", "Not logged in to Nemlig.");
    const id = Number(productId);
    if (!Number.isSafeInteger(id)) throw new NemligError("refused", `Not a Nemlig product: ${productId}`);

    let answer: unknown;
    try {
      answer = await this.request(`${api()}/basket/AddToBasket`, {
        method: "POST",
        body: JSON.stringify({ ProductId: id, Quantity: quantity }),
      });
    } catch (error) {
      // A 4xx here is Nemlig turning this product down, not the whole API moving.
      if (error instanceof NemligError && error.kind === "changed") {
        throw new NemligError("refused", error.message);
      }
      throw error;
    }
    // nemlig-shopper takes any 200 as success. A 200 that says otherwise is not one.
    if (isObject(answer) && (answer.Success === false || answer.ErrorCode)) {
      const said = typeof answer.ErrorMessage === "string" ? answer.ErrorMessage : "";
      throw new NemligError("refused", said || "Nemlig did not add the product.");
    }
  }

  /**
   * One request, answered as JSON or as a `NemligError` saying which way it failed.
   * Cookies Nemlig sets are kept and sent back, as a browser would: the login is a
   * cookie, and the basket is the logged-in person's.
   */
  private async request(
    url: string,
    { method = "GET", body, headers, site = true }: { method?: string; body?: string; headers?: Record<string, string>; site?: boolean } = {},
  ): Promise<unknown> {
    const sent: Record<string, string> = site
      ? { ...SITE_HEADERS, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }
      : {};
    Object.assign(sent, headers);
    if (this.cookies.size > 0) {
      sent.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        body,
        headers: sent,
        signal: AbortSignal.timeout(NEMLIG_CALL_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new NemligError("timeout", `Nemlig did not answer within ${NEMLIG_CALL_TIMEOUT_MS / 1000}s.`);
      }
      throw new NemligError("unavailable", "Nemlig could not be reached.");
    }

    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const pair = cookie.split(";")[0] ?? "";
      const at = pair.indexOf("=");
      if (at > 0) this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }

    if (response.status >= 500) throw new NemligError("unavailable", `Nemlig answered ${response.status}.`);
    if (!response.ok) throw new NemligError("changed", `Nemlig answered ${response.status}.`);

    const text = await response.text();
    if (text.trim() === "") return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new NemligError("changed", "Nemlig answered with something other than JSON.");
    }
  }
}

/**
 * A search answer's products. The gateway nests them (`Products.Products`); a bare list
 * under `Products` is accepted too, as nemlig-shopper does. Anything else is the API
 * having moved, and says so — never an empty list, which would read as "not found".
 */
export function parseSearch(answer: unknown): NemligProduct[] {
  if (!isObject(answer)) throw new NemligError("changed", "The search answer was not an object.");
  const outer = answer.Products;
  const list = isObject(outer) ? outer.Products : outer;
  if (!Array.isArray(list)) throw new NemligError("changed", "The search answer carried no products.");

  const products = list.flatMap((item) => {
    const product = parseProduct(item);
    return product ? [product] : [];
  });
  if (list.length > 0 && products.length === 0) {
    throw new NemligError("changed", "None of the search's products had an id and a name.");
  }
  return products;
}

function parseProduct(item: unknown): NemligProduct | null {
  if (!isObject(item)) return null;
  const { Id: id, Name: name } = item;
  if ((typeof id !== "number" && typeof id !== "string") || typeof name !== "string" || !name.trim()) return null;

  const availability = isObject(item.Availability) ? item.Availability : {};
  const price = typeof item.Price === "number" && Number.isFinite(item.Price) ? item.Price : null;
  const image = typeof item.PrimaryImage === "string" && /^https?:\/\//.test(item.PrimaryImage) ? item.PrimaryImage : null;

  return {
    id: String(id),
    name: name.trim(),
    price,
    size: typeof item.Description === "string" ? item.Description.trim() : "",
    brand: typeof item.Brand === "string" ? item.Brand.trim() : "",
    imageUrl: image,
    available: availability.IsDeliveryAvailable !== false && availability.IsAvailableInStock !== false,
  };
}

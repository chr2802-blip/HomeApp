import { createServer } from "node:http";

/**
 * A stand-in for nemlig.com, so the browser suite — and a screenshot — can drive "Send
 * to Nemlig" end to end without a real account, a real basket or the network.
 *
 * Pointed at by `NEMLIG_BASE_URL`, it answers the same paths `src/lib/nemlig.ts` asks
 * Nemlig's two hosts for: `/webapi/...` and `/searchgateway/api/search`. It is a stub
 * and not a fake: a small fixed catalogue, searched by whole words, and a basket held in
 * memory that `GET /stub/basket` reads back and `DELETE /stub/basket` empties.
 *
 * Two cases are wired in for the failures the review has to show: the password
 * `wrong-password` is refused at login, and the product "Udsolgt kanel" is accepted into
 * the review and refused by the basket.
 */

const port = Number(process.argv[2]);
if (!Number.isInteger(port)) throw new Error("usage: nemlig-stub.mjs <port>");
const origin = `http://127.0.0.1:${port}`;

const CATALOGUE = [
  { Id: 5001, Name: "Letmælk", Description: "1 l", Brand: "Arla", Price: 12.95, colour: "#3b82f6" },
  { Id: 5002, Name: "Økologisk sødmælk", Description: "1 l", Brand: "Arla", Price: 15.95, colour: "#2563eb" },
  { Id: 5003, Name: "Minimælk", Description: "1 l", Brand: "Mejerigaarden", Price: 11.5, colour: "#60a5fa" },
  { Id: 5004, Name: "Mælkechokolade", Description: "100 g", Brand: "Marabou", Price: 22, colour: "#92400e" },
  { Id: 5101, Name: "Æg fra fritgående høns", Description: "10 stk", Brand: "Hedegaard", Price: 32.95, colour: "#f59e0b" },
  { Id: 5102, Name: "Økologiske æg", Description: "6 stk", Brand: "Kirkholm", Price: 29.95, colour: "#fbbf24" },
  { Id: 5201, Name: "Rugbrød", Description: "1 kg", Brand: "Schulstad", Price: 25, colour: "#78350f" },
  { Id: 5301, Name: "Bananer", Description: "5 stk", Brand: "", Price: 14, colour: "#eab308" },
  { Id: 5401, Name: "Pasta penne", Description: "500 g", Brand: "Barilla", Price: 17.95, colour: "#d97706" },
  { Id: 5501, Name: "Hakket oksekød 8-12%", Description: "500 g", Brand: "Danish Crown", Price: 45, colour: "#b91c1c" },
  { Id: 5601, Name: "Smør", Description: "250 g", Brand: "Lurpak", Price: 24.95, colour: "#fde047" },
  { Id: 5701, Name: "Udsolgt kanel", Description: "40 g", Brand: "Santa Maria", Price: 19, colour: "#7c2d12" },
  { Id: 5702, Name: "Kanel stang", Description: "25 g", Brand: "Santa Maria", Price: 21, colour: "#9a3412", soldOut: true },
];

const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter(Boolean);

/** Products naming every word of the query, whole or inside a compound. */
function search(query) {
  const wanted = words(query);
  return CATALOGUE.filter((product) => {
    const have = words(product.Name);
    return wanted.every((word) => have.some((part) => part.includes(word)));
  }).map(({ Id, Name, Description, Brand, Price, soldOut }) => ({
    Id,
    Name,
    Description,
    Brand,
    Price,
    PrimaryImage: `${origin}/img/${Id}.svg`,
    Availability: { IsDeliveryAvailable: true, IsAvailableInStock: !soldOut },
  }));
}

function picture(id) {
  const product = CATALOGUE.find((entry) => String(entry.Id) === id);
  const colour = product?.colour ?? "#94a3b8";
  const letter = (product?.Name ?? "?").charAt(0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${colour}"/><text x="48" y="62" font-size="44" font-family="sans-serif" text-anchor="middle" fill="white">${letter}</text></svg>`;
}

const basket = [];

createServer((request, response) => {
  const url = new URL(request.url ?? "/", origin);
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const json = (value, status = 200, headers = {}) => {
      response.writeHead(status, { "Content-Type": "application/json", ...headers });
      response.end(JSON.stringify(value));
    };
    const path = url.pathname;

    if (path.startsWith("/img/")) {
      response.writeHead(200, { "Content-Type": "image/svg+xml" });
      return response.end(picture(path.slice(5).replace(/\.svg$/, "")));
    }
    if (path === "/stub/basket") {
      if (request.method === "DELETE") basket.length = 0;
      return json(basket);
    }
    if (path === "/webapi/Token") return json({ access_token: "stub-token" });
    if (path === "/webapi/v2/AppSettings/Website") {
      return json({ CombinedProductsAndSitecoreTimestamp: "STUB-STAMP", SitecorePublishedStamp: "STUB" });
    }
    if (path === "/webapi/user/GetCurrentUser") return json({ DebitorId: 4242 });
    if (path === "/webapi/Order/DeliverySpot") return json({ TimeslotUtc: "2026101215-60-240", TimeslotId: 7 });
    if (path === "/webapi/login" && request.method === "POST") {
      const { Password } = JSON.parse(body || "{}");
      if (Password === "wrong-password") {
        return json({ ErrorCode: 1, ErrorMessage: "Forkert e-mail eller adgangskode" });
      }
      return json({ RedirectUrl: "/", MergeSuccessful: true }, 200, { "Set-Cookie": "stub-session=1; Path=/" });
    }
    if (path === "/searchgateway/api/search") {
      return json({ Products: { Products: search(url.searchParams.get("query") ?? "") } });
    }
    if (path === "/webapi/basket/AddToBasket" && request.method === "POST") {
      if (!String(request.headers.cookie ?? "").includes("stub-session=1")) return json({ Message: "Not logged in" }, 401);
      const { ProductId, Quantity } = JSON.parse(body || "{}");
      if (ProductId === 5701) return json({ ErrorCode: 2, ErrorMessage: "Varen er udsolgt" });
      basket.push({ ProductId, Quantity });
      return json({ Success: true });
    }
    json({ Message: "Not found" }, 404);
  });
}).listen(port, "127.0.0.1");

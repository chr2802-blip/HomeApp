import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecipeFromUrl, parseRecipeFromHtml } from "@/lib/recipe-import";

const HOME_ID = "home-1";

function pageWithLdJson(recipe: unknown, extra = "") {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    ${extra}
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
  </head><body></body></html>`;
}

describe("parseRecipeFromHtml — JSON-LD", () => {
  it("reads a plain schema.org Recipe block", () => {
    const html = pageWithLdJson({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["200 g flour", "2 eggs"],
      recipeInstructions: "Mix and fry.",
    });

    expect(parseRecipeFromHtml(html)).toEqual({
      title: "Pancakes",
      ingredients: "200 g flour\n2 eggs",
      instructions: "Mix and fry.",
      imageUrl: null,
    });
  });

  it("finds the Recipe node nested inside @graph", () => {
    const html = pageWithLdJson({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "A blog post" },
        {
          "@type": "Recipe",
          name: "Lasagne",
          recipeIngredient: ["Pasta", "Sauce"],
          recipeInstructions: ["Layer.", "Bake."],
        },
      ],
    });

    expect(parseRecipeFromHtml(html)).toEqual({
      title: "Lasagne",
      ingredients: "Pasta\nSauce",
      instructions: "Layer.\nBake.",
      imageUrl: null,
    });
  });

  it("flattens HowToStep and HowToSection instructions", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Sunday roast",
      recipeIngredient: ["Chicken"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Prep",
          itemListElement: [
            { "@type": "HowToStep", text: "Preheat the oven." },
            { "@type": "HowToStep", text: "Season the chicken." },
          ],
        },
        { "@type": "HowToStep", text: "Roast for an hour." },
      ],
    });

    expect(parseRecipeFromHtml(html)?.instructions).toBe(
      "Preheat the oven.\nSeason the chicken.\nRoast for an hour.",
    );
  });

  it("accepts @type as an array, as some sites publish it", () => {
    const html = pageWithLdJson({
      "@type": ["Recipe", "NewsArticle"],
      name: "Soup",
      recipeIngredient: ["Stock"],
      recipeInstructions: "Simmer.",
    });

    expect(parseRecipeFromHtml(html)?.title).toBe("Soup");
  });

  it("falls back to the og:title meta tag when the Recipe node has no name", () => {
    const html = pageWithLdJson(
      { "@type": "Recipe", recipeIngredient: ["Stock"], recipeInstructions: "Simmer." },
      '<meta property="og:title" content="Grandma&#39;s Soup" />',
    );

    expect(parseRecipeFromHtml(html)?.title).toBe("Grandma's Soup");
  });

  it("skips a malformed JSON-LD block instead of throwing", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{ not valid json </script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Toast",
        recipeIngredient: ["Bread"],
        recipeInstructions: "Toast it.",
      })}</script>
    </head></html>`;

    expect(parseRecipeFromHtml(html)?.title).toBe("Toast");
  });

  it("returns null when the page has no Recipe data at all", () => {
    expect(parseRecipeFromHtml("<html><head><title>Just a blog</title></head></html>")).toBeNull();
  });

  it("returns null for a Recipe node with a name but nothing to cook", () => {
    const html = pageWithLdJson({ "@type": "Recipe", name: "Empty" });
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it("reads a plain string image", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/pancakes.jpg",
    });
    expect(parseRecipeFromHtml(html)?.imageUrl).toBe("https://example.com/pancakes.jpg");
  });

  it("reads the first of a list of image URLs", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });
    expect(parseRecipeFromHtml(html)?.imageUrl).toBe("https://example.com/a.jpg");
  });

  it("reads an ImageObject's url", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: { "@type": "ImageObject", url: "https://example.com/pancakes.jpg" },
    });
    expect(parseRecipeFromHtml(html)?.imageUrl).toBe("https://example.com/pancakes.jpg");
  });
});

describe("parseRecipeFromHtml — Microdata", () => {
  // The shape a Gemini-suggested cheerio scraper targeted: itemscope/itemtype/itemprop
  // rather than a JSON-LD script block. Both are valid schema.org, and a site that
  // publishes only this one still "follows the standard" — it just follows the older
  // half of it.
  function microdataPage(body: string) {
    return `<!doctype html><html><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        ${body}
      </div>
    </body></html>`;
  }

  it("reads a recipe with no JSON-LD at all", () => {
    const html = microdataPage(`
      <h1 itemprop="name">Pasta med kødsauce</h1>
      <img itemprop="image" src="/images/pasta.jpg" />
      <ul>
        <li itemprop="recipeIngredient">Hakket oksekød</li>
        <li itemprop="recipeIngredient">Pasta</li>
      </ul>
      <div itemprop="recipeInstructions">
        <p>Brun kødet.</p>
        <p>Kog pastaen.</p>
      </div>
    `);

    expect(parseRecipeFromHtml(html)).toEqual({
      title: "Pasta med kødsauce",
      ingredients: "Hakket oksekød\nPasta",
      instructions: "Brun kødet.\nKog pastaen.",
      imageUrl: "/images/pasta.jpg",
    });
  });

  it("reads recipeInstructions repeated once per step", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <ol>
        <li itemprop="recipeInstructions">Heat the stock.</li>
        <li itemprop="recipeInstructions">Simmer for ten minutes.</li>
      </ol>
    `);

    expect(parseRecipeFromHtml(html)?.instructions).toBe(
      "Heat the stock.\nSimmer for ten minutes.",
    );
  });

  it("reads HowToStep-style nested text inside recipeInstructions", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <div itemprop="recipeInstructions">
        <div itemprop="text">Heat the stock.</div>
        <div itemprop="text">Simmer for ten minutes.</div>
      </div>
    `);

    expect(parseRecipeFromHtml(html)?.instructions).toBe(
      "Heat the stock.\nSimmer for ten minutes.",
    );
  });

  it("reads an image from a link's href", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <span itemprop="recipeInstructions">Heat it.</span>
      <link itemprop="image" href="https://example.com/soup.jpg" />
    `);

    expect(parseRecipeFromHtml(html)?.imageUrl).toBe("https://example.com/soup.jpg");
  });

  it("prefers JSON-LD where a page has both, falling back to Microdata field by field", () => {
    const html = `<!doctype html><html><body>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "From JSON-LD",
      })}</script>
      <div itemscope itemtype="https://schema.org/Recipe">
        <span itemprop="name">From Microdata</span>
        <span itemprop="recipeIngredient">Stock</span>
        <span itemprop="recipeInstructions">Heat it.</span>
      </div>
    </body></html>`;

    // The JSON-LD title wins, but it had no ingredients or instructions at all, so
    // those come from the Microdata block instead of the page being refused.
    expect(parseRecipeFromHtml(html)).toEqual({
      title: "From JSON-LD",
      ingredients: "Stock",
      instructions: "Heat it.",
      imageUrl: null,
    });
  });

  it("falls back to og:image when neither format names a picture", () => {
    const html = `<!doctype html><html><head>
      <meta property="og:image" content="https://example.com/og.jpg" />
    </head><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <span itemprop="name">Soup</span>
        <span itemprop="recipeIngredient">Stock</span>
        <span itemprop="recipeInstructions">Heat it.</span>
      </div>
    </body></html>`;

    expect(parseRecipeFromHtml(html)?.imageUrl).toBe("https://example.com/og.jpg");
  });

  it("returns null when the itemtype is some other schema.org type", () => {
    const html = `<div itemscope itemtype="https://schema.org/Article">
      <span itemprop="name">Not a recipe</span>
    </div>`;
    expect(parseRecipeFromHtml(html)).toBeNull();
  });
});

function htmlResponse(html: string, overrides: Partial<Response> = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(html));
      controller.close();
    },
  });
  return {
    ok: true,
    url: "https://example.com/recipe",
    body,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    ...overrides,
  } as Response;
}

describe("fetchRecipeFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const goodHtml = pageWithLdJson({
    "@type": "Recipe",
    name: "Pancakes",
    recipeIngredient: ["Flour"],
    recipeInstructions: "Fry.",
  });

  it("fetches and parses a real-looking page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    expect(await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).toEqual({
      ok: true,
      recipe: { title: "Pancakes", ingredients: "Flour", instructions: "Fry.", photoId: null },
    });
  });

  it("never fetches a link that is not http or https", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("javascript:alert(1)", HOME_ID);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost/recipe",
    "http://127.0.0.1/recipe",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/recipe",
    "http://192.168.1.1/recipe",
    "http://[::1]/recipe",
  ])("never fetches %s", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl(url, HOME_ID);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a redirect that lands on a blocked address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(htmlResponse(goodHtml, { url: "http://169.254.169.254/" })),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
  });

  // fc00::/7 is a real IPv6 range worth refusing, but plenty of ordinary domains also
  // start with "fc" or "fd" — a check that did not first confirm it was looking at an
  // address, not a name, refused every one of them.
  it.each(["https://fcbarcelona.com/recipe", "https://fdic.gov/recipe"])(
    "fetches an ordinary domain that happens to start with fc or fd: %s",
    async (url) => {
      const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchRecipeFromUrl(url, HOME_ID);

      expect(fetchMock).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    },
  );

  it("sends a browser-like User-Agent, so an ordinary site does not just refuse a bare request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["User-Agent"]).toMatch(/Mozilla/);
  });

  // A site that negotiates language rather than reading it off the URL — some
  // multi-country sites do — took an English preference as a reason to swap in its
  // English site instead of the Danish page actually being asked for, which does not
  // have the Danish recipe the link pointed at.
  it("sends no Accept-Language, so a multi-locale site cannot swap in the wrong one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).not.toHaveProperty("Accept-Language");
  });

  it("decodes a page in the charset it declares, rather than assuming UTF-8", async () => {
    // "Kødsauce", the way ISO-8859-1 spells it — the same bytes read as UTF-8 would
    // come out as mojibake, which is exactly the failure this guards against.
    const html = Buffer.from(
      pageWithLdJson({
        "@type": "Recipe",
        name: "K\xf8dsauce",
        recipeIngredient: ["Hakket oksekød"],
        recipeInstructions: "Brun kødet.",
      }),
      "latin1",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.dk/opskrift",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(html);
            controller.close();
          },
        }),
        headers: new Headers({ "content-type": "text/html; charset=iso-8859-1" }),
      }),
    );

    const result = await fetchRecipeFromUrl("https://example.dk/opskrift", HOME_ID);

    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Kødsauce",
        ingredients: "Hakket oksekød",
        instructions: "Brun kødet.",
        photoId: null,
      },
    });
  });

  it("refuses a response that is not HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(goodHtml, { headers: new Headers({ "content-type": "application/pdf" }) }),
      ),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
  });

  it("reports a network failure rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    expect(await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).toEqual({
      ok: false,
      error: "Couldn't reach that page. Check the link and try again.",
    });
  });

  // A page that reaches fine but has nothing to cook from — a reel, a shop page —
  // is what `NewRecipeDialog` offers "Start from scratch" for, and it tells the two
  // apart by this flag rather than by matching the message: a mistyped address or a
  // page that would not load is worth trying again as typed, and neither sets it.
  it("marks a reachable page with nothing to cook from as not a recipe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse("<html><body>a reel</body></html>")));

    expect(await fetchRecipeFromUrl("https://example.com/reel", HOME_ID)).toEqual({
      ok: false,
      error: "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.",
      notARecipe: true,
    });
  });

  it("does not mark a mistyped address as not a recipe", async () => {
    const result = await fetchRecipeFromUrl("not a link", HOME_ID);

    expect(result).toEqual({ ok: false, error: "That doesn't look like a web address." });
  });

  it("gives up on a response larger than the limit", async () => {
    const bigChunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 4; i++) controller.enqueue(bigChunk);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.com/recipe",
        body,
        headers: new Headers({ "content-type": "text/html" }),
      }),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
  });

  // No `image` field anywhere in `goodHtml`, so none of the tests above ever ask this
  // app to fetch a second URL or touch the database — importRecipeImage short-circuits
  // on a null imageUrl. The image fetch itself, which does touch storePhoto and so a
  // real database, is covered in tests/integration/recipe-import.test.ts instead.
  it("never fetches an image when the page names none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never fetches an image whose resolved address is blocked", async () => {
    const withImage = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "http://169.254.169.254/pancakes.jpg",
    });
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(withImage));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    // The recipe itself is still good — a blocked or unreachable picture is left out,
    // never a reason to refuse an otherwise readable recipe.
    expect(result).toEqual({
      ok: true,
      recipe: { title: "Pancakes", ingredients: "Flour", instructions: "Fry.", photoId: null },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecipeFromUrl, parseRecipeFromHtml } from "@/lib/recipe-import";

function pageWithLdJson(recipe: unknown, extra = "") {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    ${extra}
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
  </head><body></body></html>`;
}

describe("parseRecipeFromHtml", () => {
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

    expect(await fetchRecipeFromUrl("https://example.com/recipe")).toEqual({
      ok: true,
      recipe: { title: "Pancakes", ingredients: "Flour", instructions: "Fry." },
    });
  });

  it("never fetches a link that is not http or https", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("javascript:alert(1)");

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

    const result = await fetchRecipeFromUrl(url);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a redirect that lands on a blocked address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(htmlResponse(goodHtml, { url: "http://169.254.169.254/" })),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe")).ok).toBe(false);
  });

  it("refuses a response that is not HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(goodHtml, { headers: new Headers({ "content-type": "application/pdf" }) }),
      ),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe")).ok).toBe(false);
  });

  it("reports a network failure rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    expect(await fetchRecipeFromUrl("https://example.com/recipe")).toEqual({
      ok: false,
      error: "Couldn't reach that page. Check the link and try again.",
    });
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

    expect((await fetchRecipeFromUrl("https://example.com/recipe")).ok).toBe(false);
  });
});

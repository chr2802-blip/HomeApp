import { describe, expect, it } from "vitest";
import { extractFromHtml } from "@/lib/recipe-extract";

/**
 * Stage one of an import, held against real markup with no network and no key.
 *
 * What is being asked of this module changed when the importer was split in two, and the
 * tests changed with it. It no longer produces a recipe, so there is nothing here about
 * whether a page "is" one — that judgement moved to `recipe-normalize.ts`, which is the
 * only thing entitled to make it. What is pinned instead is that every field a page
 * publishes actually comes out: the title, both ways of writing the ingredients and the
 * method, the picture in all four shapes schema.org allows it in, and the machine-readable
 * duration, which is the one thing here trusted over the reader.
 */

const SOURCE = "https://example.com/recipe";

function extract(html: string) {
  return extractFromHtml(html, SOURCE);
}

function pageWithLdJson(recipe: unknown, extra = "") {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    ${extra}
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
  </head><body></body></html>`;
}

describe("extractFromHtml — JSON-LD", () => {
  it("reads a plain schema.org Recipe block", () => {
    const html = pageWithLdJson({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["200 g flour", "2 eggs"],
      recipeInstructions: "Mix and fry.",
    });

    expect(extract(html)).toEqual({
      kind: "page",
      sourceUrl: SOURCE,
      rawTitle: "Pancakes",
      rawContent: "TITLE:\nPancakes\n\nINGREDIENTS:\n200 g flour\n2 eggs\n\nINSTRUCTIONS:\nMix and fry.",
      imageUrl: null,
      timeHintMinutes: null,
    });
  });

  it("labels each block, so the reader knows what the site itself called its ingredients", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Soup",
      description: "A warming bowl for a cold evening.",
      recipeIngredient: ["Stock"],
      recipeInstructions: "Simmer.",
    });

    expect(extract(html)?.rawContent).toBe(
      [
        "TITLE:\nSoup",
        "DESCRIPTION:\nA warming bowl for a cold evening.",
        "INGREDIENTS:\nStock",
        "INSTRUCTIONS:\nSimmer.",
      ].join("\n\n"),
    );
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

    expect(extract(html)?.rawContent).toContain("INGREDIENTS:\nPasta\nSauce");
    expect(extract(html)?.rawContent).toContain("INSTRUCTIONS:\nLayer.\nBake.");
  });

  // A section's own name is frequently the only place a recipe says which component a run
  // of steps belongs to, so it is kept. It used to be dropped in favour of the steps alone,
  // which lost "Til dejen" on every recipe that had one.
  it("keeps a HowToSection's name alongside its steps", () => {
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

    expect(extract(html)?.rawContent).toContain(
      "INSTRUCTIONS:\nPrep\nPreheat the oven.\nSeason the chicken.\nRoast for an hour.",
    );
  });

  it("accepts @type as an array, as some sites publish it", () => {
    const html = pageWithLdJson({
      "@type": ["Recipe", "NewsArticle"],
      name: "Soup",
      recipeIngredient: ["Stock"],
      recipeInstructions: "Simmer.",
    });

    expect(extract(html)?.rawTitle).toBe("Soup");
  });

  it("falls back to the og:title meta tag when the Recipe node has no name", () => {
    const html = pageWithLdJson(
      { "@type": "Recipe", recipeIngredient: ["Stock"], recipeInstructions: "Simmer." },
      '<meta property="og:title" content="Grandma&#39;s Soup" />',
    );

    expect(extract(html)?.rawTitle).toBe("Grandma's Soup");
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

    expect(extract(html)?.rawTitle).toBe("Toast");
  });

  it("reads a plain string image", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/pancakes.jpg",
    });
    expect(extract(html)?.imageUrl).toBe("https://example.com/pancakes.jpg");
  });

  it("reads the first of a list of image URLs", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });
    expect(extract(html)?.imageUrl).toBe("https://example.com/a.jpg");
  });

  it("reads an ImageObject's url", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: { "@type": "ImageObject", url: "https://example.com/pancakes.jpg" },
    });
    expect(extract(html)?.imageUrl).toBe("https://example.com/pancakes.jpg");
  });

  it("reads totalTime as minutes", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      totalTime: "PT1H30M",
    });
    expect(extract(html)?.timeHintMinutes).toBe(90);
  });

  it("adds prepTime and cookTime when there is no totalTime", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      prepTime: "PT10M",
      cookTime: "PT20M",
    });
    expect(extract(html)?.timeHintMinutes).toBe(30);
  });

  it("prefers totalTime over prepTime and cookTime when both are given", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      totalTime: "PT45M",
      prepTime: "PT10M",
      cookTime: "PT20M",
    });
    expect(extract(html)?.timeHintMinutes).toBe(45);
  });

  it("is null when neither totalTime nor prepTime/cookTime is present", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
    });
    expect(extract(html)?.timeHintMinutes).toBeNull();
  });

  it("ignores a duration it cannot parse", () => {
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      totalTime: "about half an hour",
    });
    expect(extract(html)?.timeHintMinutes).toBeNull();
  });
});

describe("extractFromHtml — Microdata", () => {
  // schema.org's older half: itemscope/itemtype/itemprop rather than a JSON-LD script
  // block. A site that publishes only this one still follows the standard.
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

    const raw = extract(html);
    expect(raw?.rawTitle).toBe("Pasta med kødsauce");
    expect(raw?.rawContent).toContain("INGREDIENTS:\nHakket oksekød\nPasta");
    expect(raw?.rawContent).toContain("INSTRUCTIONS:\nBrun kødet.\nKog pastaen.");
    expect(raw?.imageUrl).toBe("/images/pasta.jpg");
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

    expect(extract(html)?.rawContent).toContain(
      "INSTRUCTIONS:\nHeat the stock.\nSimmer for ten minutes.",
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

    expect(extract(html)?.rawContent).toContain(
      "INSTRUCTIONS:\nHeat the stock.\nSimmer for ten minutes.",
    );
  });

  /*
   * The duplicate that started all this. A site writing its method as `<li><p>…</p></li>`
   * matches both halves of a `li, p` selector, and asking for both took every step twice —
   * a recipe that imported with its whole method written out in pairs. The selectors are
   * tried in order now and the first that matches anything wins.
   */
  it("takes a step once when it is marked up as both a list item and a paragraph", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <div itemprop="recipeInstructions">
        <ol>
          <li><p>Heat the stock.</p></li>
          <li><p>Simmer for ten minutes.</p></li>
        </ol>
      </div>
    `);

    expect(extract(html)?.rawContent).toContain(
      "INSTRUCTIONS:\nHeat the stock.\nSimmer for ten minutes.",
    );
  });

  it("reads an image from a link's href", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <span itemprop="recipeInstructions">Heat it.</span>
      <link itemprop="image" href="https://example.com/soup.jpg" />
    `);

    expect(extract(html)?.imageUrl).toBe("https://example.com/soup.jpg");
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
    // those come from the Microdata block instead of the page being given up on.
    const raw = extract(html);
    expect(raw?.rawTitle).toBe("From JSON-LD");
    expect(raw?.rawContent).toContain("INGREDIENTS:\nStock");
    expect(raw?.rawContent).toContain("INSTRUCTIONS:\nHeat it.");
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

    expect(extract(html)?.imageUrl).toBe("https://example.com/og.jpg");
  });

  it("reads a time's datetime attribute, not its visible text", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <span itemprop="recipeInstructions">Heat it.</span>
      <time itemprop="totalTime" datetime="PT40M">40 minutes</time>
    `);

    expect(extract(html)?.timeHintMinutes).toBe(40);
  });

  it("adds prepTime and cookTime when Microdata has no totalTime", () => {
    const html = microdataPage(`
      <span itemprop="name">Soup</span>
      <span itemprop="recipeIngredient">Stock</span>
      <span itemprop="recipeInstructions">Heat it.</span>
      <time itemprop="prepTime" datetime="PT5M"></time>
      <time itemprop="cookTime" datetime="PT15M"></time>
    `);

    expect(extract(html)?.timeHintMinutes).toBe(20);
  });
});

/*
 * A page publishing no structured data at all used to be refused outright, and the recipe
 * plainly sitting there in its markup went untouched. That refusal was right while this
 * module was the thing deciding what a recipe was — a scraper guessing which paragraphs
 * were ingredients fills a cook's form with a cookie banner. It is not right any more: the
 * text goes to something allowed to answer "there is no recipe here", so handing it over
 * costs nothing and rescues every site with an old-fashioned template.
 */
describe("extractFromHtml — a page with no structured data", () => {
  it("falls back to the page's readable text", () => {
    const html = `<!doctype html><html><head><title>Mormors boller</title></head><body>
      <nav>Forside · Opskrifter · Om mig</nav>
      <main>
        <h1>Mormors boller</h1>
        <p>500 g hvedemel</p>
        <p>25 g gær</p>
        <p>Ælt det hele sammen og lad dejen hæve.</p>
      </main>
      <footer>Copyright 2026</footer>
    </body></html>`;

    const raw = extract(html);
    expect(raw?.rawContent).toContain("500 g hvedemel");
    expect(raw?.rawContent).toContain("Ælt det hele sammen");
    expect(raw?.rawTitle).toBe("Mormors boller");
  });

  it("leaves out the furniture, which is never the dinner", () => {
    const html = `<!doctype html><html><body>
      <nav>Forside</nav>
      <header>Reklame</header>
      <script>console.log("tracking")</script>
      <style>body { color: red }</style>
      <main><p>500 g hvedemel</p></main>
      <footer>Copyright</footer>
    </body></html>`;

    const rawContent = extract(html)?.rawContent ?? "";
    expect(rawContent).toContain("500 g hvedemel");
    for (const furniture of ["Forside", "Reklame", "tracking", "color: red", "Copyright"]) {
      expect(rawContent).not.toContain(furniture);
    }
  });

  it("caps how much of a page is ever read", () => {
    const filler = "<p>en meget lang opskrift</p>".repeat(2000);
    const html = `<!doctype html><html><body><main>${filler}</main></body></html>`;

    expect((extract(html)?.rawContent.length ?? 0)).toBeLessThanOrEqual(12_000);
  });

  it("prefers structured data over the page's text where the page has both", () => {
    const html = `<!doctype html><html><body>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Boller",
        recipeIngredient: ["500 g hvedemel"],
        recipeInstructions: "Ælt det sammen.",
      })}</script>
      <main><p>Alt muligt andet på siden</p></main>
    </body></html>`;

    expect(extract(html)?.rawContent).not.toContain("Alt muligt andet");
  });

  it("gives up only on a page with no text on it at all", () => {
    expect(extract("<html><head></head><body></body></html>")).toBeNull();
  });
});

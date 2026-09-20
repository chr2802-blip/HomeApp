import { describe, expect, it } from "vitest";
import { parseRecipeFromCaption } from "@/lib/caption-recipe";

/**
 * The captions here are written the way real recipe reels write them — Danish headings,
 * emoji bullets, a wall of hashtags at the end, a plug for the account in the middle —
 * because that is the input this has to survive. The parser is the part of the reel
 * importer that can be wrong while everything around it works: the fetch succeeds, the
 * form opens, and the ingredients are somebody's tagged friends.
 */

const DANISH_REEL = `🍝 Cremet pasta med kylling

Ingredienser (til 4 personer)
- 400 g pasta
- 500 g kyllingebryst
- 2 dl fløde
- 1 løg
- Frisk basilikum

Fremgangsmåde
1. Kog pastaen efter anvisningen på pakken.
2. Steg kyllingen gyldenbrun på panden.
3. Tilsæt fløde og løg, og lad det simre i 10 min.
4. Vend pastaen i saucen og server med basilikum.

Klar på 25 minutter i alt!

Følg mig for flere opskrifter
#pasta #aftensmad #opskrift #nemmad`;

describe("parseRecipeFromCaption — a caption with its own headings", () => {
  const recipe = parseRecipeFromCaption(DANISH_REEL);

  it("takes the first line as the title, without its emoji", () => {
    expect(recipe?.title).toBe("Cremet pasta med kylling");
  });

  it("splits at the headings and strips the bullets", () => {
    expect(recipe?.ingredients).toBe(
      "400 g pasta\n500 g kyllingebryst\n2 dl fløde\n1 løg\nFrisk basilikum",
    );
  });

  it("strips the step numbers, which the recipe lists in order anyway", () => {
    expect(recipe?.instructions).toBe(
      [
        "Kog pastaen efter anvisningen på pakken.",
        "Steg kyllingen gyldenbrun på panden.",
        "Tilsæt fløde og løg, og lad det simre i 10 min.",
        "Vend pastaen i saucen og server med basilikum.",
      ].join("\n"),
    );
  });

  it("drops the hashtags and the plug for the account", () => {
    expect(recipe?.instructions).not.toMatch(/#|Følg mig/);
  });

  it("reads the total time, and not the 10 minutes one step simmers for", () => {
    expect(recipe?.totalTimeMinutes).toBe(25);
  });
});

describe("parseRecipeFromCaption — headings", () => {
  it("reads the English pair as readily as the Danish one", () => {
    const recipe = parseRecipeFromCaption(
      `Miso butter salmon\n\nIngredients:\n2 salmon fillets\n1 tbsp miso\n\nMethod:\nMix the miso with the butter.\nBake for 12 minutes.`,
    );

    expect(recipe?.ingredients).toBe("2 salmon fillets\n1 tbsp miso");
    expect(recipe?.instructions).toBe("Mix the miso with the butter.\nBake for 12 minutes.");
  });

  it("reads 'Du skal bruge' and 'Sådan gør du', which is how half of them are written", () => {
    const recipe = parseRecipeFromCaption(
      `Boller\n\nDu skal bruge:\n500 g mel\n25 g gær\n\nSådan gør du:\nÆlt det hele sammen.\nBag i ovnen.`,
    );

    expect(recipe?.ingredients).toBe("500 g mel\n25 g gær");
    expect(recipe?.instructions).toBe("Ælt det hele sammen.\nBag i ovnen.");
  });

  it("does not cut the caption at a sentence that merely mentions ingredients", () => {
    const recipe = parseRecipeFromCaption(
      `Suppe\n\nAlle ingredienser kan byttes ud med hvad du har\n\nIngredienser\n1 l bouillon\n2 gulerødder\n1 løg`,
    );

    // The heading is the short line that says only "Ingredienser" — the sentence above
    // it belongs to the title's own paragraph, not to the shopping.
    expect(recipe?.ingredients).toBe("1 l bouillon\n2 gulerødder\n1 løg");
  });

  it("takes the method as everything after the shopping, where only one heading was written", () => {
    const recipe = parseRecipeFromCaption(
      `Pandekager\n\nIngredienser\n250 g mel\n3 æg\n5 dl mælk\n\nPisk det hele sammen til en glat dej og steg dem på en varm pande.`,
    );

    expect(recipe?.ingredients).toBe("250 g mel\n3 æg\n5 dl mælk");
    expect(recipe?.instructions).toBe(
      "Pisk det hele sammen til en glat dej og steg dem på en varm pande.",
    );
  });

  it("takes the shopping as the lines above the method, where only that heading was written", () => {
    const recipe = parseRecipeFromCaption(
      `Tomatsuppe\n\n1 kg tomater\n2 fed hvidløg\n1 dl fløde\n\nFremgangsmåde\nBag tomaterne i ovnen.\nBlend det hele.`,
    );

    expect(recipe?.ingredients).toBe("1 kg tomater\n2 fed hvidløg\n1 dl fløde");
    expect(recipe?.instructions).toBe("Bag tomaterne i ovnen.\nBlend det hele.");
  });
});

describe("parseRecipeFromCaption — a caption with no headings at all", () => {
  it("reads the leading run of quantities as the shopping and the rest as the method", () => {
    const recipe = parseRecipeFromCaption(
      `Hurtig chili\n\n500 g hakket oksekød\n1 dåse kidneybønner\n2 dåser hakkede tomater\n1 tsk spidskommen\n\nBrun kødet i en gryde, og tilsæt resten.\nLad det simre i en halv time, og smag til med salt.`,
    );

    expect(recipe?.ingredients).toBe(
      "500 g hakket oksekød\n1 dåse kidneybønner\n2 dåser hakkede tomater\n1 tsk spidskommen",
    );
    expect(recipe?.instructions).toBe(
      "Brun kødet i en gryde, og tilsæt resten.\nLad det simre i en halv time, og smag til med salt.",
    );
  });

  it("refuses a caption that is a paragraph about dinner rather than a recipe", () => {
    expect(
      parseRecipeFromCaption(
        `Sådan så aftensmaden ud i aften, og den var virkelig god. Vi spiste den ude i haven mens solen gik ned. #aftensmad`,
      ),
    ).toBeNull();
  });

  it("refuses a caption with one or two stray numbers in it", () => {
    expect(
      parseRecipeFromCaption(`Ugens middag\n\n3 ting jeg altid har i køleskabet\n2 af dem er oste`),
    ).toBeNull();
  });

  it("refuses an empty caption, and one that is nothing but hashtags", () => {
    expect(parseRecipeFromCaption("   ")).toBeNull();
    expect(parseRecipeFromCaption("#mad #opskrift\n#aftensmad")).toBeNull();
  });
});

describe("parseRecipeFromCaption — the title", () => {
  it("falls back to the page's title where the caption opens straight into a heading", () => {
    const recipe = parseRecipeFromCaption(
      `Ingredienser\n200 g mel\n2 æg\n\nFremgangsmåde\nRør det sammen.`,
      "Vafler",
    );

    expect(recipe?.title).toBe("Vafler");
    expect(recipe?.ingredients).toBe("200 g mel\n2 æg");
  });

  it("falls back where the caption opens straight into a quantity, keeping that line", () => {
    const recipe = parseRecipeFromCaption(
      `200 g mel\n2 æg\n5 dl mælk\n\nRør det hele sammen og steg dem.`,
      "Pandekager",
    );

    expect(recipe?.title).toBe("Pandekager");
    expect(recipe?.ingredients).toBe("200 g mel\n2 æg\n5 dl mælk");
  });

  it("cuts a caption that opens with a paragraph down to its first sentence", () => {
    const recipe = parseRecipeFromCaption(
      `Den her ret er blevet en fast favorit hjemme hos os. Vi laver den mindst en gang om ugen, og børnene elsker den.\n\nIngredienser\n1 kg kartofler\n2 løg`,
    );

    expect(recipe?.title).toBe("Den her ret er blevet en fast favorit hjemme hos os");
  });

  it("refuses a caption with nothing to call the dish, rather than naming it an ingredient", () => {
    expect(parseRecipeFromCaption(`Ingredienser\n200 g mel\n2 æg`)).toBeNull();
  });
});

describe("parseRecipeFromCaption — the total time", () => {
  it("stays null where the only minutes named belong to a step", () => {
    const recipe = parseRecipeFromCaption(
      `Brød\n\nIngredienser\n500 g mel\n2 dl vand\n\nFremgangsmåde\nBag i 40 min ved 220 grader.`,
    );

    expect(recipe?.totalTimeMinutes).toBeNull();
  });

  it("adds hours to minutes where the caption gives both", () => {
    const recipe = parseRecipeFromCaption(
      `Ragu\n\nIngredienser\n1 kg oksekød\n2 løg\n\nFremgangsmåde\nLad det simre.\n\nTilberedningstid: 2 timer og 30 min`,
    );

    expect(recipe?.totalTimeMinutes).toBe(150);
  });

  it("reads an English total the same way", () => {
    const recipe = parseRecipeFromCaption(
      `Soup\n\nIngredients\n1 l stock\n2 carrots\n\nMethod\nSimmer it.\n\nReady in 35 minutes`,
    );

    expect(recipe?.totalTimeMinutes).toBe(35);
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_BODY, MAX_NAME, MAX_NOTE, bodyText, optionalText, readForm, requiredText } from "@/lib/form";
import { CATEGORY_FIELD, readCategoryChoice } from "@/lib/recipes";

/**
 * Every action that reads user input goes through `readForm`, so what it does with a
 * form is the shape of every one of those tests. It was covered only through them:
 * true of the wording a person sees, and true of the one behaviour the rest of the app
 * is built around avoiding — a repeated field arriving as its last value alone.
 *
 * That last one is why `readCategoryChoice` exists at all. A well-meant change here to
 * gather repeated fields into a list would leave every category test passing and the
 * reason for that function quietly gone, which is exactly the kind of thing a test at
 * this level is for.
 */

const form = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
};

/**
 * Every stored piece of text has a ceiling, and until recently none of them did.
 *
 * Nothing here is about keeping anybody out of anybody else's home — `homeDb` answers
 * that. It is about a household member not being able to make their *own* home
 * unusable: Postgres `text` runs to a gigabyte, and a megabyte-long list title is
 * carried by every page that draws that list, including the one somebody would go to in
 * order to delete it.
 *
 * The numbers are asserted at the boundary rather than at some comfortable value,
 * because the boundary is the only part of a limit that can be wrong: exactly at the
 * limit must pass, one past it must not.
 */
describe("length limits", () => {
  const times = (n: number) => "a".repeat(n);

  it("takes a name exactly at the limit and refuses one past it", () => {
    const schema = z.object({ title: requiredText("Give it a title.") });

    expect(readForm(schema, form([["title", times(MAX_NAME)]]))).toMatchObject({ ok: true });
    expect(readForm(schema, form([["title", times(MAX_NAME + 1)]]))).toMatchObject({ ok: false });
  });

  it("says how long is too long, rather than refusing without saying why", () => {
    const schema = z.object({ title: requiredText("Give it a title.") });

    const result = readForm(schema, form([["title", times(MAX_NAME + 1)]]));

    expect(result).toEqual({ ok: false, error: `That is too long — keep it under ${MAX_NAME} characters.` });
  });

  /*
   * The ceilings live in helpers built once at module scope, where there is no household
   * to ask, so "too long" is said by `readForm` rather than by the `.max()` — and a Danish
   * home used to read it in English on every form in the app.
   */
  it("says how long is too long in the household's own language", () => {
    const schema = z.object({ note: optionalText });

    const result = readForm(schema, form([["note", times(MAX_NOTE + 1)]]), "DA");

    expect(result).toEqual({ ok: false, error: `Det er for langt — hold det under ${MAX_NOTE} tegn.` });
  });

  it("measures a name after trimming, so trailing spaces cannot push it over", () => {
    const schema = z.object({ title: requiredText("Give it a title.") });

    const padded = `  ${times(MAX_NAME)}  `;

    expect(readForm(schema, form([["title", padded]]))).toMatchObject({ ok: true });
  });

  it("gives a note more room than a name, and a body more than a note", () => {
    const schema = z.object({ note: optionalText, method: bodyText });

    expect(MAX_NAME).toBeLessThan(MAX_NOTE);
    expect(MAX_NOTE).toBeLessThan(MAX_BODY);
    expect(readForm(schema, form([["note", times(MAX_NOTE)], ["method", times(MAX_BODY)]]))).toMatchObject({ ok: true });
    expect(readForm(schema, form([["note", times(MAX_NOTE + 1)], ["method", ""]]))).toMatchObject({ ok: false });
    expect(readForm(schema, form([["note", ""], ["method", times(MAX_BODY + 1)]]))).toMatchObject({ ok: false });
  });

  it("still lets an optional field be left out entirely", () => {
    const schema = z.object({ note: optionalText, method: bodyText });

    expect(readForm(schema, form([]))).toEqual({ ok: true, fields: { note: null, method: "" } });
  });
});

describe("readForm", () => {
  const schema = z.object({
    title: requiredText("Give it a title."),
    note: optionalText,
  });

  it("gives back the fields a valid form carried", () => {
    const result = readForm(schema, form([["title", "Pancakes"], ["note", "For Sunday"]]));

    expect(result).toEqual({ ok: true, fields: { title: "Pancakes", note: "For Sunday" } });
  });

  it("trims, and turns a blank optional field into null rather than an empty string", () => {
    const result = readForm(schema, form([["title", "  Pancakes  "], ["note", "   "]]));

    expect(result).toMatchObject({ ok: true, fields: { title: "Pancakes", note: null } });
  });

  it("reports the schema's own wording, not a generic refusal", () => {
    const result = readForm(schema, form([["title", "   "]]));

    expect(result).toEqual({ ok: false, error: "Give it a title." });
  });

  it("reports the first problem when a form has several", () => {
    const two = z.object({
      title: requiredText("Give it a title."),
      body: requiredText("Say something."),
    });

    // One message at a time: the dialog has one place to put it, and a person fixes one
    // field before they can see whether the next is still wrong.
    expect(readForm(two, form([]))).toEqual({ ok: false, error: "Give it a title." });
  });

  it("falls back to a usable message where the schema gave none", () => {
    const silent = z.object({ title: z.string().refine(() => false, { message: "" }) });

    expect(readForm(silent, form([["title", "anything"]]))).toEqual({
      ok: false,
      error: "Check the form and try again.",
    });
  });

  it("keeps only the last of a repeated field", () => {
    const one = z.object({ [CATEGORY_FIELD]: z.string() });

    const result = readForm(one, form([[CATEGORY_FIELD, "a"], [CATEGORY_FIELD, "b"]]));

    // Not a bug to fix here: a schema describes an object, and a form does not. Where
    // several values are meant, they are read from the FormData directly — see below.
    expect(result).toMatchObject({ ok: true, fields: { [CATEGORY_FIELD]: "b" } });
  });
});

describe("readCategoryChoice", () => {
  it("reads every box that was ticked, which is what readForm cannot do", () => {
    const data = form([
      ["title", "Lasagne"],
      [CATEGORY_FIELD, "weeknight"],
      [CATEGORY_FIELD, "italian"],
    ]);

    expect(readCategoryChoice(data)).toEqual(["weeknight", "italian"]);
  });

  it("gives nothing back for a form that mentions no category", () => {
    expect(readCategoryChoice(form([["title", "Lasagne"]]))).toEqual([]);
  });
});

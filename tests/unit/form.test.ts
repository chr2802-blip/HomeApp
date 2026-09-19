import { describe, expect, it } from "vitest";
import { z } from "zod";
import { optionalText, readForm, requiredText } from "@/lib/form";
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

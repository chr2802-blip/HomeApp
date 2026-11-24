import type { Phrase } from "./copy/say";
import { LISTS } from "./copy/lists";
import { TASKS } from "./copy/tasks";
import { RECIPES } from "./copy/recipes";
import { PANTRY } from "./copy/pantry";

export type CreateChoice = { href: string; label: Phrase; emoji: string };

/**
 * What the household makes, each on the page whose "+" makes it. The dashboard's "+"
 * offers these, and so does the tab bar's on any page that makes nothing of its own —
 * one list, so the two cannot come to offer different things.
 */
export const CREATE_CHOICES: CreateChoice[] = [
  { href: "/lists", label: LISTS.newList, emoji: "📝" },
  { href: "/tasks", label: TASKS.newTask, emoji: "🧹" },
  { href: "/recipes", label: RECIPES.newRecipe, emoji: "🍲" },
  { href: "/pantry", label: PANTRY.add, emoji: "🫙" },
];

"use client";

import { useOptimistic, useTransition } from "react";
import { toggleListFavorite } from "@/app/actions/lists";

/**
 * The star that pins a list to the person's own dashboard.
 *
 * It fills the moment it is pressed rather than when the server answers: starring is a
 * passing thought on the way somewhere else, and a control that waits half a second to
 * admit it heard you gets pressed twice.
 */
export function FavoriteButton({
  listId,
  title,
  favorite,
  className = "",
}: {
  listId: string;
  /** Named in the label, so a page full of stars says which list each one is for. */
  title: string;
  favorite: boolean;
  className?: string;
}) {
  const [starred, setStarred] = useOptimistic(favorite);
  const [, startTransition] = useTransition();

  function toggle() {
    const data = new FormData();
    data.set("listId", listId);

    startTransition(async () => {
      setStarred(!starred);
      await toggleListFavorite(data);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // A toggle button keeps one name and reports its state through aria-pressed, so a
      // screen reader says "Favourite Shopping, pressed" rather than renaming the
      // control under the person using it.
      aria-pressed={starred}
      aria-label={`Favourite ${title}`}
      title={starred ? "Remove from favourites" : "Add to favourites"}
      className={`pressable shrink-0 rounded-lg p-2 active:scale-90 ${
        starred ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-slate-500"
      } ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-5 w-5"
        fill={starred ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.47l-4.7 2.48.9-5.23-3.8-3.7 5.25-.76z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

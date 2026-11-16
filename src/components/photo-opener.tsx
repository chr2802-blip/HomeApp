"use client";

import { useState } from "react";
import { PhotoViewer } from "@/components/photo-viewer";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

/**
 * A picture shown at size on a page (a recipe's, a task's) that opens across the whole
 * screen when pressed, to pinch and look closer — what a cook wants of the photo of the
 * finished dish. The picture itself is drawn by the caller, as `children`.
 */
export function PhotoOpener({
  photoId,
  alt,
  className = "",
  children,
}: {
  photoId: string;
  alt: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const say = sayIn(useLanguage());
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={say(APP.photo.open)}
        className={`block cursor-zoom-in ${className}`}
      >
        {children}
      </button>
      {open && <PhotoViewer photoIds={[photoId]} index={0} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { Button, Label } from "@/components/ui";
import { photoUrl } from "@/components/photo";
import { PhotoError, preparePhoto } from "@/lib/downscale";
import { PHOTO_FIELD } from "@/lib/photo-file";
import { useLanguage } from "@/components/language-provider";
import { PHOTOS } from "@/lib/copy/photos";
import { sayIn } from "@/lib/copy/say";

/**
 * Picking a picture for whatever the surrounding form is about.
 *
 * The picture is shrunk and uploaded the moment it is chosen, and the form itself only
 * ever carries the id it was given. That ordering is deliberate: a phone photo is
 * several megabytes, and a form action carrying one would be slow where the connection
 * is worst, would have to be raised past the payload limit, and would give no sign of
 * progress while it went. Here the work is visible, it happens once, and saving the
 * form afterwards is as quick as saving one without a picture.
 *
 * The file input is deliberately unnamed, so the original never reaches the form even
 * as a stray field. What the form submits is the hidden id below — empty when the
 * picture has been taken off, which is how removing one is said.
 */
export function PhotoField({
  defaultPhotoId = null,
  label,
  hint,
}: {
  defaultPhotoId?: string | null;
  label?: string;
  hint?: string;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const [photoId, setPhotoId] = useState<string | null>(defaultPhotoId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function choose(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const prepared = await preparePhoto(file, language);

      const upload = new FormData();
      upload.set("photo", prepared.full, "photo.jpg");
      upload.set("thumb", prepared.thumb, "thumb.jpg");

      const response = await fetch("/api/photos", { method: "POST", body: upload });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) throw new PhotoError(body.error ?? say(PHOTOS.couldNotSave));
      setPhotoId(String(body.id));
    } catch (cause) {
      // Anything that is not the library's own wording is a failed request rather than
      // a bad file, and saying so is more use than repeating a network error.
      setError(
        cause instanceof PhotoError ? cause.message : say(PHOTOS.couldNotUpload),
      );
    } finally {
      setBusy(false);
      // Cleared so that picking the same file again still counts as a change.
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label ?? say(PHOTOS.label)}</Label>

      <input type="hidden" name={PHOTO_FIELD} value={photoId ?? ""} />

      {photoId && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* The stored thumbnail: this is a preview, and the full picture would be
              several hundred kilobytes to say the same thing. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- served from a
              session-checked route, so Next's optimiser cannot fetch it. */}
          <img
            src={photoUrl(photoId, "thumb")}
            alt={say(PHOTOS.chosenAlt)}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {photoId ? say(PHOTOS.change) : say(PHOTOS.add)}
        </Button>
        {photoId && !busy && (
          <Button type="button" variant="ghost" onClick={() => setPhotoId(null)}>
            {say(PHOTOS.remove)}
          </Button>
        )}
        {/* Announced rather than only drawn: on a slow phone this is the only sign
            that anything is happening. */}
        <p aria-live="polite" className="text-xs text-slate-500">
          {busy ? say(PHOTOS.uploading) : ""}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p className="text-xs text-slate-500">{hint ?? say(PHOTOS.hint)}</p>
      )}
    </div>
  );
}

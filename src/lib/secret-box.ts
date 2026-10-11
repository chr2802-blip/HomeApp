import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * A secret this app has to keep and give back — a household's nemlig.com password,
 * which has no OAuth to stand in for it and has to be sent again at every login.
 *
 * AES-256-GCM under `NEMLIG_SECRET_KEY`, which lives only in the deployment's
 * environment, so a copy of the database alone is noise. GCM rather than CBC because it
 * also refuses a ciphertext somebody edited, instead of decrypting it to garbage.
 *
 * The key is hashed to 32 bytes rather than required to be 32 bytes of hex: any long
 * random string pasted into Vercel works, and a wrong length is not a way to fail at the
 * first login of the evening. Sealed text is `v1.<iv>.<tag>.<ciphertext>` in base64url,
 * so a future change of scheme can still read what was written before it.
 */

const VERSION = "v1";
/** Shorter than this and the key is guessable, whatever it is hashed into. */
const MIN_KEY_LENGTH = 32;

function key(secret = process.env.NEMLIG_SECRET_KEY): Buffer {
  if (!secret || secret.length < MIN_KEY_LENGTH) {
    throw new Error(`NEMLIG_SECRET_KEY must be set to at least ${MIN_KEY_LENGTH} characters.`);
  }
  return createHash("sha256").update(secret).digest();
}

/** Whether this installation can keep a secret at all — the Nemlig card's on switch. */
export function canSealSecrets(secret = process.env.NEMLIG_SECRET_KEY): boolean {
  return !!secret && secret.length >= MIN_KEY_LENGTH;
}

export function sealSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** The secret as it was sealed. Throws on a wrong key or a tampered value. */
export function openSecret(sealed: string, secret?: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) {
    throw new Error("Not a sealed secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

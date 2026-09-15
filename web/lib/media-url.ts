/**
 * Media-URL hardening for Supabase Storage.
 *
 * `cinema_assets` is a PUBLIC bucket, so every stored object URL is the
 * permanent form and carries no credential:
 *
 *   https://<project>.supabase.co/storage/v1/object/public/cinema_assets/<path>
 *
 * The *signed* form embeds a JWT with a fixed lifetime instead:
 *
 *   https://<project>.supabase.co/storage/v1/object/sign/cinema_assets/<path>?token=<jwt>
 *
 * Persisting a signed URL into project state — video takes, assets, scene
 * images, character refs, floor plans — produces the worst kind of failure:
 * the artwork works in the session that created it, then silently 400s once the
 * token lapses, days later, looking like data loss rather than expiry.
 *
 * Nothing in this codebase calls `createSignedUrl` today, and no Supabase fetch
 * uses one. These helpers exist so that stays true: normalise on the way into
 * persisted state, and detect on the way out.
 *
 * Note the same reasoning does NOT apply to the service-role/anon keys. Those
 * are JWTs too, and they do expire, but they only ever travel in request
 * headers (`Authorization`, `apikey`) — never inside a stored URL.
 */

const SIGNED_PATH_SEGMENT = "/storage/v1/object/sign/";
const PUBLIC_PATH_SEGMENT = "/storage/v1/object/public/";

/** Inline `data:` payloads are not URLs and never expire — but they are huge. */
export function isInlineDataUri(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("data:");
}

/** True for a URL that carries a time-limited credential. */
export function isExpiringMediaUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("/") || isInlineDataUri(url)) return false;
  if (url.includes(SIGNED_PATH_SEGMENT)) return true;

  try {
    return new URL(url).searchParams.has("token");
  } catch {
    return false;
  }
}

/**
 * Rewrites a signed Storage URL into its permanent public equivalent and
 * removes any `token` parameter. Idempotent, and a no-op for relative paths,
 * inline data URIs, non-URL strings and already-public URLs.
 *
 * Safe because the bucket is public: the public path serves the same bytes
 * without auth, so nothing is lost by dropping the credential.
 */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("/") || isInlineDataUri(url)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const wasSigned = parsed.pathname.includes(SIGNED_PATH_SEGMENT) || parsed.searchParams.has("token");

  if (parsed.pathname.includes(SIGNED_PATH_SEGMENT)) {
    parsed.pathname = parsed.pathname.replace(SIGNED_PATH_SEGMENT, PUBLIC_PATH_SEGMENT);
  }
  parsed.searchParams.delete("token");

  if (wasSigned) {
    console.warn(
      `[MediaUrl] Rewrote a signed/expiring storage URL to the permanent public form. ` +
        `Signed URLs must never be persisted — they break once the token lapses.`
    );
  }

  return parsed.toString();
}

/**
 * True when a media URL is safe to store durably and serve indefinitely:
 * a relative local path, an inline data URI, or a non-signed absolute URL.
 */
export function isDurableMediaUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  if (isInlineDataUri(url)) return true;
  if (url.startsWith("/")) return true;
  try {
    new URL(url);
  } catch {
    return false;
  }
  return !isExpiringMediaUrl(url);
}

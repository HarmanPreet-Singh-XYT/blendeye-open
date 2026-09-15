/**
 * Guard checks for the media-URL hardening in lib/media-url.ts.
 *
 * `cinema_assets` is a public bucket, so stored object URLs must always be the
 * permanent `/object/public/…` form. A signed URL embeds a JWT with a fixed
 * lifetime, and persisting one means the media works in the session that made
 * it and then silently 400s days later — indistinguishable from data loss.
 *
 * Run directly (Node 23+ strips types natively, no test runner needed):
 *   node scripts/check-media-url.ts
 */

import assert from "node:assert/strict";
import {
  isDurableMediaUrl,
  isExpiringMediaUrl,
  isInlineDataUri,
  normalizeMediaUrl,
} from "../lib/media-url.ts";

const PROJ = "https://exampleproject.supabase.co";
const PUBLIC_VIDEO = `${PROJ}/storage/v1/object/public/cinema_assets/videos/omni_abc123.mp4`;
const SIGNED_VIDEO = `${PROJ}/storage/v1/object/sign/cinema_assets/videos/omni_abc123.mp4?token=eyJhbGciOiJIUzI1NiJ9.deadbeef.sig`;
const SIGNED_IMAGE = `${PROJ}/storage/v1/object/sign/cinema_assets/images/portrait.png?token=eyJhbGciOiJIUzI1NiJ9.cafe.sig`;
const PUBLIC_WITH_TOKEN = `${PROJ}/storage/v1/object/public/cinema_assets/audio/scores/score_1.mp3?token=stale`;
const DATA_URI = "data:video/mp4;base64,AAAAIGZ0eXBpc29t";

let failures = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${label}\n       ${(err as Error).message}`);
  }
}

console.log("normalizeMediaUrl");
check("leaves a permanent public URL untouched", () =>
  assert.equal(normalizeMediaUrl(PUBLIC_VIDEO), PUBLIC_VIDEO)
);
check("rewrites a signed URL to the public path and drops the token", () =>
  assert.equal(normalizeMediaUrl(SIGNED_VIDEO), PUBLIC_VIDEO)
);
check("does the same for images (other object types)", () =>
  assert.equal(
    normalizeMediaUrl(SIGNED_IMAGE),
    `${PROJ}/storage/v1/object/public/cinema_assets/images/portrait.png`
  )
);
check("strips a lingering token from a public URL", () =>
  assert.equal(
    normalizeMediaUrl(PUBLIC_WITH_TOKEN),
    `${PROJ}/storage/v1/object/public/cinema_assets/audio/scores/score_1.mp3`
  )
);
check("preserves unrelated query params", () =>
  assert.equal(
    normalizeMediaUrl(
      `${PROJ}/storage/v1/object/public/cinema_assets/videos/a.mp4?download=1&token=x`
    ),
    `${PROJ}/storage/v1/object/public/cinema_assets/videos/a.mp4?download=1`
  )
);
check("leaves relative local paths untouched", () =>
  assert.equal(normalizeMediaUrl("/videos/omni_abc.mp4"), "/videos/omni_abc.mp4")
);
check("leaves inline data URIs untouched", () =>
  assert.equal(normalizeMediaUrl(DATA_URI), DATA_URI)
);
check("returns '' for nullish", () => {
  assert.equal(normalizeMediaUrl(null), "");
  assert.equal(normalizeMediaUrl(undefined), "");
});
check("is idempotent", () =>
  assert.equal(normalizeMediaUrl(normalizeMediaUrl(SIGNED_VIDEO)), PUBLIC_VIDEO)
);

console.log("isExpiringMediaUrl");
check("true for a signed path", () => assert.equal(isExpiringMediaUrl(SIGNED_VIDEO), true));
check("true for any token param", () => assert.equal(isExpiringMediaUrl(PUBLIC_WITH_TOKEN), true));
check("false for a permanent public URL", () =>
  assert.equal(isExpiringMediaUrl(PUBLIC_VIDEO), false)
);
check("false for local paths and data URIs", () => {
  assert.equal(isExpiringMediaUrl("/videos/a.mp4"), false);
  assert.equal(isExpiringMediaUrl(DATA_URI), false);
});

console.log("isDurableMediaUrl / isInlineDataUri");
check("accepts durable forms", () => {
  assert.equal(isDurableMediaUrl(PUBLIC_VIDEO), true);
  assert.equal(isDurableMediaUrl("/videos/a.mp4"), true);
  assert.equal(isDurableMediaUrl(DATA_URI), true);
});
check("rejects signed URLs", () => {
  assert.equal(isDurableMediaUrl(SIGNED_VIDEO), false);
  assert.equal(isDurableMediaUrl(PUBLIC_WITH_TOKEN), false);
});
check("isInlineDataUri", () => {
  assert.equal(isInlineDataUri(DATA_URI), true);
  assert.equal(isInlineDataUri(PUBLIC_VIDEO), false);
});

console.log(failures === 0 ? "\nAll media-url checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

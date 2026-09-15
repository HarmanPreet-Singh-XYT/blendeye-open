# BlendEye / Agentic Cinema — Code Audit

**Scope:** the whole repository — `agent-service/` (Python/FastAPI), `web/` (Next.js 16 app router + libs + components), `supabase/`, `docker-compose.yml`, Dockerfiles, `grafana/`, `.github/workflows/`.
**Date:** 2026-09-12
**Method:** static review of every Python module, all 44 API route handlers, the shared web libs, the SQL schema and the CI/CD config, plus execution-based verification (`.venv/bin/python`) of the traversal, injection, event-loop and unbounded-loop claims. `ruff check` is clean and `pytest` passes 27/27, so lint/style and "missing tests" are out of scope. `npx tsc --noEmit` is clean, so type errors are out of scope.

**Verdict:** the product surface is well built, but it is deployed as an **open, unauthenticated backend** in front of paid AI APIs and a multi-tenant database. Several findings are exploitable by an anonymous `curl`. The two structural causes are (1) authentication exists only in React, never enforced server-side, and (2) all database access runs through the **service-role key**, so RLS never protects anything.

---

## Severity summary

| # | Severity | Finding | Where |
|---|---|---|---|
| C1 | Critical | No auth on 38/44 web API routes and 0/40 agent-service endpoints; backend deployed `--allow-unauthenticated` | `web/app/api/**`, `agent-service/app/**` |
| C2 | Critical | Unauthenticated cross-tenant deletion of any asset | `web/app/api/assets/route.ts:82` |
| C3 | Critical | SQL injection into ClickHouse (2 endpoints) | `continuity.py:51`, `market_viability.py:40` |
| C4 | Critical | SSRF + arbitrary local file read from unauthenticated input | `agent-service/app/routers/media.py:533` |
| C5 | Critical | Unauthenticated write into any project via service-role key | `web/app/api/script/generate/route.ts:32` |
| C6 | Critical | Cross-tenant row hijack: assets and talent keyed by attacker-controlled / global IDs | `supabase-store.ts:415,587` |
| C7 | Critical | Unauthenticated destruction of any project's ClickHouse timeline | `agent-service/app/routers/sharding.py:74` |
| C8 | Critical | Storage RLS lets any signed-in user overwrite/delete any object | `supabase/schema.sql:277` |
| H1–H16 | High | See below | |
| M1–M22 | Medium | See below | |
| L1–L12 | Low | See below | |

---

## Critical

### C1 — There is no server-side authentication anywhere, and the AI backend is on the public internet

**Evidence.** Only 6 of 44 route handlers reference `getAuthUserFromHeader`:

```
assets/route.ts            authRefs=4      media/video/route.ts            authRefs=0
assets/upload/route.ts     authRefs=2      media/image/route.ts            authRefs=0
notes/route.ts             authRefs=4      script/generate/route.ts        authRefs=0
projects/route.ts          authRefs=3      showrunner/chat/route.ts        authRefs=0
projects/[id]/route.ts     authRefs=4      sharding/shard/route.ts         authRefs=0
talent/route.ts            authRefs=4      ... 28 more with authRefs=0
```

There is no `middleware.ts` in `web/` (confirmed: no `middleware.*` anywhere outside `node_modules`). The only gate is the client-side `web/components/cinema/auth-gate.tsx`, which is a React component — it protects the UI, not the API.

On the Python side, nothing authenticates either:

```
$ grep -rn "Depends\|HTTPBearer\|APIKeyHeader\|X-API-Key" agent-service/app
(no auth hits — only the word "security" inside prompt strings)
```

And the deploy workflow publishes that service to the world:

```yaml
# .github/workflows/deploy-backend.yml:91
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}"          # includes GOOGLE_API_KEY
```

with `ALLOWED_ORIGINS=${{ secrets.ALLOWED_ORIGINS || '*' }}` (`:60`) parsed to `["*"]` (`config.py:89`). FastAPI's CORS never constrained non-browser clients anyway. The live URL is published in `grafana/blendeye-studio-dashboard.json:119` and in every CI run's step summary.

**Impact.** Anyone can `POST /api/media/video` (or hit Cloud Run directly) and start a billable Veo render, a Lyria score, an Imagen storyboard, a Gemini agent run, or a billed Parallel Web search — on the project owner's keys, with no rate limit and no per-caller quota. They can also read and destroy other tenants' data through the endpoints listed below. `/metrics` and `/observability/overview` additionally leak internal topology.

**Fix.** Add a shared `requireAuth(req)` helper (or a `middleware.ts` matcher on `/api/:path*`) and apply it to every route that touches a paid API or user data. Require an API key or IAM auth on the Cloud Run service and drop `--allow-unauthenticated`. Never default `ALLOWED_ORIGINS` to `*`.

---

### C2 — Unauthenticated deletion of *any* asset (IDOR, destructive)

`web/app/api/assets/route.ts:77-83` reads the token but never rejects a missing one:

```ts
const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
if (!isSupabaseConfigured()) { ... }
const success = await deleteAssetFromSupabase(id, authUser?.id || null);
```

and `web/lib/supabase-store.ts:611-614` *drops* the ownership predicate when the id is falsy:

```ts
let query = client.from("assets").delete().eq("id", assetId);
if (userId) {
  query = query.eq("user_id", userId);      // skipped entirely when anon
}
```

`client` here is `getSupabaseAdminClient()` (`:608`), which bypasses the `"Assets delete own"` RLS policy at `supabase/schema.sql:248`.

**Impact.** `curl -X DELETE 'https://app/api/assets?id=<asset-id>'` deletes another account's asset. Ids are trivially guessable — the bundled seed library uses fixed ids (`asset-store.ts` `SEED_ASSETS`, e.g. `aeth-video-take1`) and generated ids follow a `asset-<ms>-<6 chars>` pattern. The route returns `{deleted:true}` either way, so nothing surfaces. Contrast `deleteProjectFromSupabase:208-213` and `deleteNoteFromSupabase:330-335`, which correctly `return false` when `userId` is missing — the asset helper simply omits that guard.

**Fix.** 401 in the route when `!authUser`; hard-require `userId` inside `deleteAssetFromSupabase`.

---

### C3 — SQL injection into ClickHouse (two endpoints, unauthenticated)

`agent-service/app/routers/continuity.py:51-63`:

```python
sql = (
    f"SELECT character_name, event_timestamp, event_type, content "
    f"FROM story_events "
    f"WHERE project_id = '{req.project_id}' "      # free-form request-body string
    f"ORDER BY event_timestamp ASC"
)
...
rows = store.client.query(sql).result_rows
```

`agent-service/app/routers/market_viability.py:40-48` has the same bug with `req.genre`:

```python
sql = ("SELECT ... FROM cinematic_precedents "
       f"WHERE genre LIKE '%{req.genre}%' ORDER BY audience_retention_pct DESC LIMIT 5")
rows = store.client.query(sql).result_rows
```

Neither field has a validator. Sibling code proves the intended pattern: `clickhouse_store.knowledge_state` (`:185-199`) and `get_cinematic_precedents` (`:306-309`) both use `{name:String}` bind parameters. `hot_seat.py:53-71` interpolates only for *display* and binds the real query.

**Impact.** `project_id = "x' OR 1=1 --"` returns every tenant's `story_events` (the story's secrets); `genre = "' UNION ALL SELECT ... FROM system.users --"` exfiltrates other tables. The rows are interpolated straight into the LLM prompt (`continuity.py:94-95`) and the SQL is echoed back in `clickhouse_query_executed` (`continuity.py:115`), so the attacker reads the answer in the model's reply. A `sleep(3)` predicate is a CPU DoS against ClickHouse.

**Fix.** Switch both to `{project_id:String}` + `parameters={...}`, and validate the fields with a charset/length pattern.

---

### C4 — SSRF + arbitrary local file read from unauthenticated input

`agent-service/app/routers/media.py:524-548`:

```python
if image_url.startswith(("http://", "https://")):
    with httpx.Client(timeout=10.0) as http_client:
        res = http_client.get(image_url)        # no allowlist, no private-IP block, no redirect cap
        ...
if image_url.startswith("/"):
    cleaned = image_url.lstrip("/")             # lstrip does NOT remove ".."
    p = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / cleaned
    if p.exists() and p.is_file():
        return p.read_bytes(), mime
```

Verified by execution:

```
'/../../agent-service/app/config.py'        exists=True is_file=True
'/../../../../../../../etc/passwd'          exists=True is_file=True
```

Reachable unauthenticated from `POST /media/video` (`media.py:599`), `POST /media/music` (`media.py:934`, including `image_urls`), and `POST /media/video/sequence/start` via `reference_images` (`video_sequencer.py:177-190`) — which in turn is reachable through the web routes `web/app/api/media/video/route.ts:8` and `web/app/api/media/music/route.ts:9`, which forward the client's `image_url` verbatim.

**Impact.** The process runs as uid 999 in Docker or the dev user locally, so it can read `agent-service/.env` (holding `GOOGLE_API_KEY`, `CLICKHOUSE_PASSWORD`, `SUPABASE_SECRET_KEY`, `GRAFANA_SERVICE_ACCOUNT_TOKEN`) and any other readable file. The bytes are forwarded to Google as the Veo/Lyria conditioning image, so this is an exfiltration primitive, not merely disclosure. The HTTP branch reaches internal services and cloud metadata endpoints.

**Fix.** Resolve the static path with `Path.resolve()` and require `is_relative_to(public_root)`. For the HTTP branch, allowlist hosts or reject private/loopback/link-local IPs after resolution and disable redirects.

---

### C5 — Unauthenticated write into *any* project via the service-role key

`web/app/api/script/generate/route.ts:29-45` — no auth check at all, and the update is unscoped:

```ts
const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
if (projectId && isSupabaseConfigured()) {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  await client
    .from("projects")
    .update({ screenplay_text: result.screenplay_text, updated_at: Date.now() })
    .eq("id", projectId);                     // no .eq("user_id", ...)
}
```

Project ids are guessable: `` `project-${Date.now().toString(36)}` `` (`project-store.ts:1284`) plus the fixed literal `"vault-heist-demo"` (`app/canvas-demo/page.tsx:133`).

Two further defects in the same block: the `try/catch` around it is dead code (supabase-js returns `{ data, error }` rather than throwing, and `error` is never inspected), so a failed write is silently reported as success; and the whole thing is `await`ed only inside the `if (result?.screenplay_text)` branch, so it never runs on the cached path.

**Fix.** Require auth, add `.eq("user_id", authUser.id)`, and destructure `{ error }`.

---

### C6 — Cross-tenant row hijack via attacker-controlled / global primary keys

`upsertProjectToSupabase` and `upsertNoteToSupabase` both pre-check ownership. The other two upserts do not.

`web/lib/supabase-store.ts:576-599` (assets) — the route accepts `const assetId = body.id || ...` (`assets/route.ts:43`) and the upsert writes whatever `user_id` it is handed:

```ts
const row = assetToRow(asset, userId);
const { error } = await client.from("assets").upsert(row, { onConflict: "id" });
```

`web/lib/supabase-store.ts:415-437` (talent) — the primary key is a **global** slug derived only from the name:

```ts
const charId = `talent-${character.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
const { error } = await client.from("talent_vault").upsert({
  id: charId,
  user_id: userId || null,
  ...
}, { onConflict: "id" });
```

Both run through `getSupabaseAdminClient()`, so RLS does not block them.

**Impact.** User B `POST`s `{id:"asset-<A's id>", url, name}` and takes ownership of A's row. If B saves a character named "Rae", A's `talent-rae` row is overwritten with `user_id = B`; A's vault entry disappears (`fetchTalentFromSupabase` filters by `user_id`) and A can no longer delete it. Silent cross-tenant data loss.

**Fix.** Add the same "select existing `user_id`, compare, deny on mismatch" guard used for projects/notes, and key talent rows as `talent-${userId}-${slug}`.

---

### C7 — Unauthenticated destruction of any project's ClickHouse timeline

`web/app/api/sharding/shard/route.ts:23` forwards a client-supplied `project_id` → `agent-service/app/routers/sharding.py:62,74`:

```python
def _replace_project_events(store, project_id: str, events: list[StoryEvent]) -> None:
    store.clear_project_events(project_id)
    store.insert_events(events)
```

`clickhouse_store.py:256-270` executes a real mutation:

```python
self._client.command(
    "ALTER TABLE story_events DELETE WHERE project_id = {project_id:String}",
    parameters={"project_id": project_id},
    settings={"mutations_sync": 1},
)
```

**Impact.** Anyone can wipe any project's story-event timeline — the data plane behind the product's core time-gate/knowledge-firewall mechanic — and burn Gemini tokens generating replacement events from attacker text. The clear+insert pair is also non-atomic, so an insert failure leaves the project with zero events.

**Fix.** Require auth, verify project ownership before re-sharding, and make the replacement transactional (insert into a staging table then swap, or verify the delete succeeded before reporting success).

---

### C8 — Storage RLS lets any signed-in user overwrite or delete any object

`supabase/schema.sql:277-281`:

```sql
CREATE POLICY "Authenticated update cinema_assets" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'cinema_assets') WITH CHECK (bucket_id = 'cinema_assets');

CREATE POLICY "Authenticated delete cinema_assets" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'cinema_assets');
```

The browser holds the publishable key, so "authenticated" is any signed-up account. There is no `owner = auth.uid()` predicate, even though uploads are namespaced `users/<userId>/...` (`assets/upload/route.ts:59-60`).

**Impact.** Any signed-in user can overwrite or delete another user's generated media directly via the Storage API — the per-user RLS on the `assets` *table* is irrelevant because the bytes live in `storage.objects`.

**Fix.** Scope both policies with `owner = auth.uid()` and/or `name LIKE 'users/' || auth.uid() || '/%'`.

---

## High

### H1 — No authentication on the agent-service itself (0 of ~40 endpoints)
Covered in C1; listed separately because it is a distinct artifact: even if every Next.js route were fixed, the Cloud Run service is directly reachable and would remain open. Also no rate limiting or per-caller concurrency cap.

### H2 — Unauthenticated upload into a public bucket and onto local disk
`web/app/api/assets/upload/route.ts:22-23` computes `const userId = authUser?.id || null` with **no** 401, then writes the buffer with the admin client to `uploads/shared/<ts>_<name>` in the public `cinema_assets` bucket (`:55-73`) and returns the public URL. There is no file-size limit and `await file.arrayBuffer()` (`:45`) loads the whole body into memory. The local-disk fallback (`:84-91`) writes into `web/public/uploads/assets/shared/`.

The extension is preserved unfiltered (`.html`, `.svg` survive; note the `[^a-zA-Z0-9._-] → _` filter *does* correctly block `../` traversal — that part is fine). When served from a self-hosted/Docker deployment, `public/` is served from disk, so `GET /uploads/assets/shared/<ts>_evil.html` executes JavaScript on the app origin. Because supabase-js persists the session JWT in `localStorage` (`lib/supabase.ts:38-41`), that is a session-theft path. On Vercel the disk write fails (read-only FS), so this variant is Docker/self-host only — but the unauthenticated bucket upload is exploitable everywhere.

**Fix.** Require auth, cap the size, allowlist image/video MIME types, and never serve user uploads from the app origin.

### H3 — Blocking synchronous I/O inside `async` handlers, with the Google SDK configured for **no timeout at all**
`media.py:152,238,414,445,484,617,948,1070`, `showrunner.py:56,73,211`, `continuity.py:63`, `market_viability.py:48`, `fusion.py:82-83` call blocking `google-genai` / `clickhouse-connect` APIs directly on the event loop. The SDK sets no timeout (`google/genai/_api_client.py:1140` defaults `timeout=None`, i.e. *all* timeouts disabled).

**Impact.** One hung upstream call freezes the entire process indefinitely — including `/health` and the status endpoints the UI is polling. The codebase already does this correctly elsewhere (`hot_seat.py:173`, `sharding.py:62`, `observability.py:107` use `run_in_threadpool`/`asyncio.to_thread`), so the pattern is known.

**Fix.** `await asyncio.to_thread(...)` for the sync calls and pass an explicit `HttpOptions(timeout=...)`.

### H4 — The Veo sequencer blocks the event loop for up to 120 s per poll
`video_sequencer.py:245,264` call `dispatch_veo_generation` and `poll_veo_operation` synchronously; the latter performs `client.files.download(...)` and `_upload_bytes_to_supabase(...)` (`media.py:653` uses `httpx.Client(timeout=120)`). Measured with a 100 ms heartbeat: ticks at `[0.0, 518.7, 619.8, ...]` ms — the loop was frozen for the full duration of each call.

**Fix.** `await asyncio.to_thread(...)` around both.

### H5 — A crashed sequence task leaves the job permanently `running`, and `_JOBS` then grows without bound
`video_sequencer.py:233` calls `_build_shot_prompt(shot)` **outside** the `try` block that starts at `:244`, and the frame-extraction `except` at `:312` catches only `FrameExtractionError`. A non-string value in the client-supplied `continuity_bible` raises `TypeError` inside `sanitize_veo_prompt` (`:144`), and `extract_last_frame` can raise `binascii.Error`/`OSError`. Reproduced: after such an exception the job's status stayed `"running"` forever and asyncio logged `Task exception was never retrieved`. `_prune_jobs` (`:107-127`) only evicts **terminal** jobs, so the stuck entry is never removed and the UI polls it forever.

**Fix.** Wrap the whole per-shot body (and the task) so every exit path sets `job.status` to `"error"`, and prune stale non-terminal jobs after a deadline.

### H6 — Swallowed ClickHouse write/delete failures are reported as success
`clickhouse_store.py:256-273` swallows `clear_project_events` failures and `:152-174` diverts failed inserts into process-local `_memory_events`, yet the routers still report `events_written=len(events)` (`sharding.py:68`, `fusion.py:92`).

**Impact.** If the delete fails, the follow-up insert appends a second copy of every event (re-sharding stops being idempotent → duplicated knowledge state, and characters "know" things twice). If the insert fails, the API reports N rows written while the DB has none — and because `knowledge_state` (`:183-209`) returns early on a successful empty query, those memory-only rows are **unreadable** once a client exists. The failure is invisible to the caller.

**Fix.** Have both methods return/raise a real status, surface a non-200 or `_fallback` flag with the true count, and consult `_memory_events` when the cloud result is empty.

### H7 — Unbounded Veo job fan-out from one request
`routers/video_sequence.py:37-40` validates only that `shots` is non-empty. There is no cap on `len(shots)`, on prompt length, or on concurrent jobs. One unauthenticated request with 5,000 shots schedules 5,000 real Veo renders and an `asyncio` task that runs for days; N such requests multiply it, and in-flight jobs are never evicted (H5).

**Fix.** Cap `shots` (≈12), cap concurrent running jobs, and cap total prompt bytes.

### H8 — Unbounded loop count from `target_total_duration_sec`
`routers/shotlist.py:75` declares an unconstrained `target_total_duration_sec: int | None`, and `:180-188`:

```python
target = req.target_total_duration_sec or 25
shot_count = max(len(template_shots), round(target / per_shot))
for i in range(shot_count):
```

Reproduced: `target_total_duration_sec=10_000_000` builds 1,666,667 pydantic models in one synchronous burst (OOM/hang). This is the *fallback* path, taken whenever model output fails to parse.

**Fix.** Clamp the input (e.g. ≤600 s) and cap `shot_count`.

### H9 — Session-scoped production settings are silently discarded on every reload
`web/lib/project-store.ts:701-722` declares `budget`, `currency`, `budgetPerShootDayUsd`, `budgetAllocation`, `budgetCapPolicy`, `shootRegion`, `isStarred`, `povScripts`, `activeSequenceJob`, `seedVersion`, `totalScenesEstimate`. `projectToRow`/`rowToProject` (`supabase-store.ts:22-95`) persist **none** of them (grep finds zero references), and `supabase/schema.sql` has no such columns. The UI reads them back: `edit-project-dialog.tsx:113-117` (`project.budget || 850_000`, `project.currency || "USD"`, `project.budgetAllocation?.locationsPct || 15`), `project-scenes-page.tsx:1058,1545`.

**Impact.** A director sets a £4M budget with a 30 % locations allocation; after a page refresh it is back to $850,000 / 15 %, with no warning. `toggleStarProject` (`project-store.ts:987-993`) is likewise never persisted.

**Fix.** Add the fields to `extendedBundle` (they already have a JSONB home in `initial_events`) and reconstruct them in `rowToProject`.

### H10 — The Studio Commander reports actions as executed when nothing was applied
`web/lib/studio-commander.ts:1358-1396` — every callback is optional, and `summaries.push(...)` fires regardless (61 push sites). The only production call site passes three of them:

```ts
// components/cinema/project-scenes-page.tsx:496-515
executeStudioActions(actions, {...}, {
  setScenes: ..., setActiveSceneId: ..., setScreenplayText: ...,
});
```

`setCharacters`, `setNodes`, `setEdges`, `saveProject` and `recordTakeChange` are all `undefined`.

**Impact.** "Add a character named Rae" creates the character in a local array, reports `Created character "Rae" as a ...` in `execution_summaries`, renders that to the user (`:521-527`) — and persists nothing. Same for `update_project_meta`, `connect_nodes`, `sever_wire`, `attach_asset`, `switch_view`, `replace_character`. No version-control snapshot is recorded either.

**Fix.** Either pass the full callback set from the call site, or return a per-action `applied: false` and an honest "cannot apply" summary.

### H11 — `saveProject` is optimistic with no error check and no rollback
`web/lib/project-store.ts:956-962`:

```ts
fetch("/api/projects", { method: "POST", headers: authHeaders(true), body: JSON.stringify(updatedProject) })
  .catch((err) => { console.warn("[ProjectStore] Project cloud sync warning:", err); });
return true;
```

`.catch()` fires only on network failure, never on HTTP 401/403. The cache is updated *before* the request and returned `true` regardless.

**Impact.** On an expired session or an IDOR denial the user keeps editing a cache that no longer matches the server; the next `syncProjectsWithSupabase` silently reverts everything. Because each save is an independent request, two rapid edits can also land out of order.

**Fix.** `await` the response, treat `!res.ok` as failure and revert (or toast), and serialize writes. The same pattern appears in `deleteProject` (`:1001-1008`), `deleteFromTalentVault` and `deleteScratchpadNote` — the item vanishes from the UI on a 401 and reappears after the next sync.

### H12 — `notifyIfFallback` actively suppresses the offline warning for fabricated location research
`web/lib/fallback-notice.ts:14-26` returns early — skipping the warning — when `search_grounded === true` or any candidate has it:

```ts
if (obj.search_grounded === true) return false;                 // suppress
if (Array.isArray(obj.scenes)) {
  const anyGrounded = obj.scenes.some((s) => s.candidates?.some((c) => c.search_grounded === true || ...));
  if (anyGrounded) return false;                                // suppress
}
if (obj._fallback) { toast.add({ ... "showing offline demo content" ... }); }
```

But `web/app/api/location/research/route.ts` sets exactly that flag on its **hand-authored** fallback (the code after the `try` block, reached only when the real call fails):

```ts
search_grounded: true,                                    // :167 and :237
sources: [
  { title: reg.permitOffice, url: reg.permitUrl },
  { title: `Parallel Web: ${region} Filming Locations & Production Stages`, url: reg.permitUrl },
],
```

alongside `reviews` with invented reviewer names, ratings and quotes, and specific permit fees. The response also carries `_fallback: true` (`:263`) — which `notifyIfFallback` never reaches because it returned early.

**Impact.** Deterministic: whenever the location agent or Parallel is unavailable, the user is shown fabricated permit fees, vendor distances, reviewer quotes and a fake "Parallel Web:" citation, with the offline warning explicitly disabled. The `search_grounded: true` claim is also simply false on this path.

**Fix.** Do not set `search_grounded`/Parallel source titles on the synthetic path (only real `researchLocations` results should), and let `_fallback` drive the notice.

### H13 — Nullable `user_id` makes NULL-owned rows world-readable and world-claimable
`supabase/schema.sql` declares every owner column as `user_id UUID REFERENCES auth.users(id)` with no `NOT NULL`, while the file header (`:7-9`) claims "every row is owned by an account (`user_id NOT NULL` rows only)". The service-role client bypasses RLS, so defensiveness has to live in code — and it is conditional:

```ts
// supabase-store.ts:150-155  (fetchProjectByIdFromSupabase)
if (data.user_id) {                                  // falsy → returned to anyone
  if (!userId || data.user_id !== userId) return null;
}

// supabase-store.ts:182     (upsertProjectToSupabase)
if (existing && existing.user_id && existing.user_id !== explicitUserId) { return false; }
```

`GET /api/projects/[id]` does not require auth at all (`projects/[id]/route.ts:22`), so a NULL-owner row is readable by anonymous callers, and any signed-in user can claim one by PUTting it (the upsert rewrites `user_id`).

**Fix.** `ALTER COLUMN user_id SET NOT NULL`, or treat NULL-owner rows as admin-only and remove both guest fallbacks. `supabase/cleanup-guest-data.sql` exists precisely because these rows are considered dead weight.

### H14 — CI cannot fail, and secrets ship as plaintext env vars
`.github/workflows/deploy-backend.yml:106-114`:

```bash
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")
if [ "$HTTP_STATUS" -eq 200 ]; then echo "✅ Health check passed"
else echo "⚠️ Health check returned HTTP $HTTP_STATUS (check Cloud Run logs)"; fi
```

The step exits 0 on failure — a completely broken revision reports green. Related, in the same file: secrets are passed as plaintext Cloud Run env vars via `--set-env-vars` (`CLICKHOUSE_PASSWORD`, `GOOGLE_API_KEY`, `SUPABASE_SECRET_KEY`, `GRAFANA_SERVICE_ACCOUNT_TOKEN` → readable by anyone with `run.services.get`); auth uses a non-expiring `GCP_SA_KEY` JSON key while `id-token: write` is granted but unused (Workload Identity Federation is the fix); actions are pinned to mutable tags (`@v4`, `@v2`); and the workflow runs **no** tests — `agent-service/tests/` is never executed and there is no build/lint/typecheck job for `web/`.

**Fix.** `curl -fsS --retry 5 ... || exit 1`; `--set-secrets` with Secret Manager; WIF; SHA-pinned actions; add gating test/build jobs.

### H15 — Any project's story events are readable by id (the story's secrets)
`web/app/api/events/route.ts:6` proxies straight to `GET /sharding/events/{project_id}` (`sharding.py:78-85`), which has no ownership concept at all — it is a bare `store.events_for_project(project_id)`. `hot-seat/knowledge` (`hot_seat.py:140-166`) and `hot-seat/ask` are the same shape, and both echo the executed SQL back (`query_sql`). No auth on any of them (C1), and ids are low-entropy (C5).

**Impact.** An attacker enumerates project ids and reads each story's `known_fact` / `unaware_of` rows — i.e. the narrative secrets the entire knowledge-firewall feature exists to protect — plus the full character/objective breakdown.

**Fix.** Require auth and assert project ownership before returning events or knowledge state.

### H16 — Veo operation and sequence job ids have no ownership record
`web/app/api/media/video/status/route.ts:7` and `video/sequence/status/route.ts:7` take `operation_name` / `job_id` from the query string and return the render result for any id. Neither agent-service nor the web layer records which caller started a job (`_JOBS` is a bare `dict[str, SequenceJob]` keyed by a random id, with no owner field). A successful poll on the sequence path also triggers `persistDataUriToBucket` / `persistLocalMediaToBucket` writes.

**Impact.** Anyone holding or guessing an id can read another user's render output and cause the server to re-upload media on their behalf. Combined with C1, the render *content* is already reachable; the missing ownership check makes it permanent even after auth is added elsewhere.

**Fix.** Store the initiating user on the job/operation record (or a signed token alongside the id) and verify it on status reads before persisting anything.

---

## Medium

**M1 — `web/Dockerfile` cannot produce a working web image.** `NEXT_PUBLIC_*` values are inlined at build time, but the Dockerfile runs `npm run build` with no `ARG`/`ENV` and `web/.dockerignore` excludes `.env*`; `docker-compose.yml:78-81` supplies them only as *runtime* `environment:`. The standalone bundle freezes `""`, `isSupabaseConfigured()` returns false, and the documented `docker compose --profile full up --build` flow yields a login-gated app that cannot sign in. Fix: `ARG NEXT_PUBLIC_*` + `ENV` before `npm run build`, passed via compose `build.args`.

**M2 — Unbounded Prometheus label cardinality.** `middleware/telemetry.py:23,48` labels by raw `request.url.path`, which includes the parameterised `GET /sharding/events/{project_id}` (`sharding.py:78`); `media.py:171` labels by free-form `aspect_ratio`; `continuity.py:109` labels by LLM-supplied `severity`. `prometheus_client` never evicts children. Reproduced: 5,000 distinct values produced 10,000 permanent series. Fix: use `request.scope["route"].path` and normalise/whitelist the other two.

**M3 — ffmpeg subprocess has no timeout.** `services/frame_extractor.py:70-81` awaits `proc.communicate()` unconditionally, and `-i` may be an HTTP URL (`:47-49`). A stalled remote clip hangs forever, which compounds H5. Fix: `asyncio.wait_for(..., timeout=30)` + `proc.kill()`.

**M4 — Non-deterministic candidate IDs.** `agents/location_researcher.py:331`: `` f"loc-cluster-{abs(hash(project_title)) % 1000}" `` — Python string hashing is randomised per process. Reproduced: the same title produced `loc-cluster-533-a`, `-628-a`, `-738-a` on three runs. Any persisted `selectedLocationCandidateId` stops resolving after every restart, and 1,000 buckets collide across unrelated projects. Fix: `hashlib.sha1(...).hexdigest()[:8]`.

**M5 — `event_timestamp` is compared lexicographically without format validation.** The DDL stores it as `String` (`clickhouse_store.py:51`) and the time gate is `event_timestamp <= {at_timestamp:String}` (`:191`), but nothing enforces zero-padded `HH:MM:SS` — `perspective_sharder.py:25` documents it only in a description string. A model emitting `"1:20:00"` sorts *after* `"00:30:00"`, silently corrupting the product's core time-gate mechanic while every read still succeeds. Fix: validate with `^\d{2}:\d{2}:\d{2}$` + `strptime`, or store epoch seconds as `UInt32`.

**M6 — Fabricated analyses returned as HTTP 200 with a real-looking query attached.** `continuity.py:123-166`, `market_viability.py:89-133` and `production.py:144-150` return hardcoded verdicts (`overall_continuity_score: 84`, `total_issues: 3`, fixed territory scores) while still echoing `clickhouse_query_executed=sql`, and without a `_fallback` flag. A transient model-parse failure is indistinguishable from a real audit in the response body. Fix: adopt the `_fallback`/`_disclosure` pattern already used in `location_research.py:116-117`.

**M7 — The generation cache has no memory bound and never evicts.** `generation-cache.ts:29-30` calls it an "LRU" but it is a plain `Map`; entries are only replaced when the same key recurs, expired entries are never deleted (`:73-77`), and there is no size cap (`:138-141`). Values include multi-megabyte base64 data-URI videos (`media/video/route.ts:39-41` caches the agent-service result verbatim, and `media.py:728-733` produces them). Fix: evict on read/write and cap the map.

**M8 — The disk and Supabase cache tiers never expire and are never pruned.** `generation-cache.ts:104-124` reads `${key}.json` with no age check; `:162-178` writes one file per unique prompt forever (`fs.writeFileSync` blocks the loop); `generation_cache.created_at` is never consulted. Degraded/`_fallback` results are served indefinitely. Fix: enforce a TTL and prune the directory.

**M9 — Supabase cache writes discard the returned error.** `generation-cache.ts:148-156` does not destructure `{ error }` from the upsert, so a rejected write is silent (contrast the read path at `:84-90`, which does check). Fix: check the error.

**M10 — Cache key omits an input.** `web/app/api/continuity/check/route.ts:25-36` hashes `{projectId, screenplayText, characters}` but calls `checkContinuity(projectId, screenplayText, characters, scenes)` — `scenes` changes the analysis yet does not change the key, so the second request returns the first's issues marked `_cached: true`. Fix: include `scenes`.

**M11 — `syncProjectsWithSupabase` clobbers in-flight optimistic writes.** `project-store.ts:974-981` replaces the whole cache from a GET; it is called on mount and on every `agentic_cinema_auth_changed` event (dispatched on token refresh by `setActiveUser`). A GET racing a pending POST reverts the user's last edit visibly. `syncTalentVaultWithSupabase` and `syncScratchpadNotesWithSupabase` share the pattern. Fix: merge by `id`/`updatedAt`.

**M12 — A failed hydration is cached as "empty account".** `project-store.ts:834-843` writes `projectsCache = (projects ?? [])` even when `fetchCollection` returned `null` (any non-OK response), then dispatches `agentic_cinema_store_hydrated`; `auth-gate.tsx:89-91` uses that to render. A transient 401/500 shows an empty slate with no error, and `await res.json()` at `:807` is unguarded against non-JSON error pages. Fix: distinguish failure from emptiness and surface it.

**M13 — The IDOR pre-check ignores query errors.** `supabase-store.ts:176-185` and `:292-301` discard `error` from the ownership `select`. A failed check leaves `existing` undefined, the guard is skipped, and the upsert proceeds through the RLS-bypassing admin client — the exact outcome the guard exists to prevent. Fix: `if (error) return false`.

**M14 — Hydration race drops assets.** `asset-store.ts:355-380` vs `:396-418`: `getLocalAssets()` kicks off `hydrateAssets()`, but if the user uploads before it resolves, `assetsCache = mergeWithSeedAssets(data.assets)` overwrites the cache without the new asset (it vanishes from the Hub even though the POST succeeded). Fix: merge instead of replace, or guard with a hydration generation counter.

**M15 — Deleting a bundled seed asset is reported as success and then undone.** `asset-store.ts:423-438` filters it out, but every later `hydrateAssets()`/`saveLocalAsset()` re-runs `mergeWithSeedAssets`, which unconditionally re-adds all `SEED_ASSETS`. `asset-hub-dialog.tsx:168-176` offers "Remove Asset" for every row and toasts "Asset Removed". Fix: disable delete for preset assets.

**M16 — Scene-scoped score takes bleed across scenes.** `project-store.ts:1759-1805`: `saveScoreTake` computes `currentTakes = getScoreTakes(projectId, sceneId)` and then writes that list into the *project-level* `scoreTakes`. Because `getScoreTakes` (`:1739-1749`) falls back to `project.scoreTakes` when a scene has none, saving a cue for Scene B makes Scene C appear to own B's cues and destroys the project-level vault. Fix: keep the two lists independent.

**M17 — 0–100 vs 0–1 scale mismatch for talent dials.** `supabase-store.ts:392-393,430` default `confidence: r.confidence ?? 0.7` / `verbalPacing: ?? 0.5`, but the rest of the codebase uses 0–100 (`studio-commander.ts:89-90` uses 70/60; `project-store.ts:2157` uses `?? 60`). Demo-preset characters omit the fields, so they are stored as `0.7` and rendered as a 0.7 % dial (`??` does not trigger on a non-nullish `0.7`). Fix: use the 0–100 scale consistently.

**M18 — Composer `personality` nodes lose their dial callback after reload.** `project-store.ts:2006-2057`'s `rehydrateNodeCallbacks` switch has no `personality` case (falls to `default: break`), and `app/studio/[projectId]/page.tsx:905-908` takes the persisted-node path whenever a scene has stored nodes. `PersonalityNode` calls `data.onTweak?.(...)` (`graph-nodes.tsx:414-426`), so after a reload dragging a dial updates the node but never reaches `onTweakDials`. Fix: add the case, matching `node-dial-*`.

**M19 — Unbounded inputs and no body-size limits.** `media/tts/multi` (`lines` uncapped, and `l.speaker.toUpperCase()` 500s on a non-string), `script/multiverse` (`count` uncapped), `showrunner/chat` (`history` uncapped, spliced into the prompt), `location/research` (whole body forwarded and used as a cache key). Fix: Zod-style validation with explicit maxima on every route.

**M20 — Missing timeouts on three upstream fetches.** `app/api/metrics/route.ts:10`, `app/api/observability/route.ts:10` and `app/api/media/music/stream/route.ts:14` call `fetch` with no `AbortSignal` (every other path uses `lib/agent-service.ts`'s 45 s/60–120 s timeouts). The SSE stream also never aborts on client disconnect. Fix: add timeouts and honour `req.signal`.

**M21 — Upstream error text is reflected to clients.** `lib/agent-service.ts:45-48` embeds `await res.text()` in the thrown `Error`, and ~15 routes return `err.message` verbatim (`media/video:51`, `media/image:104`, `location/scout:45`, `style/extract:19`, `fusion:71`, `market/predict:77`, …). Since the caller can steer which upstream error occurs (C3/C4), this is a read primitive for internal detail. Fix: log the detail, return a generic message.

**M22 — The media bucket is force-public on every schema run.** `supabase/schema.sql:135-137`: `ON CONFLICT (id) DO UPDATE SET public = true`. All generated character refs, footage and scores are world-readable by URL, and the line re-asserts that even if an operator hardens the bucket. Fix: `public = false` + signed URLs.

**M23 — ClickHouse client is created with no timeouts.** `clickhouse_store.py:106-113` passes no `connect_timeout`/`send_receive_timeout`, so defaults (10 s connect / 300 s read) apply to every call — including those made on the event loop (H3). ~40 concurrent slow requests exhaust the AnyIO threadpool and stall every sync endpoint. Fix: `connect_timeout=5, send_receive_timeout=30`.

**M24 — MCP stdio subprocesses are never torn down.** `agents/runner.py:84-114` builds an `InMemoryRunner` and returns without `await runner.close()`; ADK only cleans up toolsets in `Runner.close()` (installed `google/adk/runners.py:2684-2697`), and `build_showrunner_agent(with_mcp=True)` attaches `mcp-clickhouse` and `mcp-grafana` stdio toolsets per request (`showrunner.py:68`). Fix: `await runner.close()` in a `finally`, or build the toolsets once and close them at shutdown.

**M25 — Uncaught `model_validate_json` returns a bare 500.** `sharding.py:45`, `sequence.py:74`, `bridge.py:75`, `fusion.py:67` validate LLM output with no `try/except`, unlike `shotlist.py:291-309` and `multiverse.py:64-71`. Any format deviation yields `500 Internal Server Error` with no diagnostic (and for sharding, aborts before any write). Fix: repair-parse or return a declared `_fallback`.

**M26 — PostgREST filter injection via `projectId`.** `supabase-store.ts:556-558` interpolates a query-string value into an `or()` expression: `` query.or(`project_id.is.null,project_id.eq.${projectId}`) ``. A value containing `,` or `)` alters the filter; a malformed one fails the whole query, which `:564-567` swallows by returning `[]` — the asset library just appears empty. Fix: validate the id and distinguish failure from "no rows".

**M27 — Orphaned assets leak into every project.** `supabase/schema.sql:114` uses `project_id ... ON DELETE SET NULL` while `supabase-store.ts:557` matches `project_id.is.null`, so assets from a deleted project appear in every project's asset list. Fix: `ON DELETE CASCADE` or an explicit "unfiled" flag.

**M28 — Mutable base images.** `docker-compose.yml:9,96` use `clickhouse/clickhouse-server:latest` and `grafana/alloy:latest`, and `grafana/alloy/Dockerfile:4` uses `FROM grafana/alloy:latest`. Every pull is a different unaudited binary. Fix: pin digests.

**M29 — ClickHouse exposed on all interfaces with a trivial password.** `docker-compose.yml:10-12` publishes `8123`/`9000` on `0.0.0.0` over plaintext HTTP (`CLICKHOUSE_SECURE=false`) while every template ships `CLICKHOUSE_PASSWORD=devpassword`. On a shared network that is read/write access to `story_events`. Fix: bind `127.0.0.1:8123:8123` and generate a password.

**M30 — Whole process environment handed to a third-party subprocess.** `services/grafana_mcp.py:28-34` passes `env = {**os.environ, ...}` to `mcp-grafana`, so it receives `GOOGLE_API_KEY`, `PARALLEL_API_KEY`, `SUPABASE_SECRET_KEY` and `CLICKHOUSE_PASSWORD`. It also substitutes `"demo-token"` on misconfiguration instead of failing loudly. Fix: allowlist the env.

**M31 — The public anon key is accepted as a storage write credential.** `routers/media.py:636-642` falls back to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for an upload with `x-upsert: true`, then silently returns `None` when RLS rejects it. Fix: require the secret key only and report misconfiguration.

---

## Low

- **L1 — Double-counted metric.** `routers/observability.py:106` increments `HTTP_REQUESTS_TOTAL` manually for a request the middleware already counts, so the Grafana throughput panel over-reports that endpoint 2×.
- **L2 — Raw exception text in `/metrics`.** `main.py:174` returns `f"ClickHouse unreachable: {exc}"`; driver errors embed host, port, database and username.
- **L3 — Greedy capture `\(resembling ...\)` risk in the Veo sanitizer.** `prompt_sanitizer.py:69-72` uses `[^)]+` across a whole clause; it will delete legitimately-named non-celebrity text and can strip more of the prompt than intended. Low impact, but it silently degrades prompts.
- **L4 — Hardcoded "Elena" in the fallback screenplay.** `app/api/project/generate/route.ts:165,179,181` interpolates `pLead`/`pCounter` everywhere *except* these three strings, so a project with characters named anything else produces a screenplay where a character is addressed as "Elena".
- **L5 — Hard failures returned as HTTP 200 with empty payloads.** `media/tts/route.ts:87`, `media/tts/multi:73`, `media/music:96`, `script/bridge:130` return `audio_url: ""` with status 200; `audio-studio-view.tsx:305-307` only checks `res.ok` and silently drops. Monitoring sees success.
- **L6 — Unguarded `req.json()`.** `app/api/hot-seat/ask/route.ts:5` is the only one of 34 sites without a 400 handler; malformed JSON produces a 500.
- **L7 — Egress amplification.** `app/api/observability/benchmark/route.ts:3,74-78` issues three outbound HEAD probes per unauthenticated POST.
- **L8 — Hop-by-hop header on a proxied SSE response.** `app/api/media/music/stream/route.ts:27,53` forwards `Connection: keep-alive`, which is rejected on HTTP/2 and may force buffering.
- **L9 — Production identifiers baked into tracked files.** `web/next.config.ts:9` hardcodes `vcbclecweorugfucdubm.supabase.co` (redundant with the preceding `*.supabase.co`); `app/api/media/image/route.ts:67,80-96` hardcodes fallback URLs on that project; `grafana/blendeye-studio-dashboard.json:119` embeds the Cloud Run URL with GCP project number `369992010022`; `config.py:48` defaults to the real `blendeye.grafana.net` while CI falls back to a different stack (`:78`). Move to env vars.
- **L10 — Env documentation drift.** `METRICS_TARGET`/`METRICS_SCHEME` (read by `docker-compose.yml:103-104` and `grafana/alloy/config.alloy:17,19`) appear in no `.env.example`; `GEMINI_API_KEY` (read at `web/app/api/showrunner/chat/route.ts:75`) appears in none; the root `.env.example` omits `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` that `docker-compose.yml:78-81` consumes.
- **L11 — Missing index for the RLS predicate.** `project_snapshots` has only `(project_id, created_at DESC)` (`schema.sql:97`) while every access filters `user_id = auth.uid()`. `assets`/`projects`/`talent_vault`/`scratchpad_notes` all have the `user_id` index.
- **L12 — 82 MB of generated media committed to git.** `web/public/videos/*.mp4` and `web/public/audio/scores/*.mp3` (`veo_*.mp4`, `score_*.mp3`) are tracked build outputs. `.git` is 82 MB. Consider Git LFS or an untrack/reference approach.

---

## Verified OK (checked and rejected as false positives)

- **No secrets in git history.** A full `git grep` for `glsa_|AIza|sk-|eyJ|xox|ghp_|PRIVATE KEY` across all revisions returns only placeholder `.env.example` lines. `.env`/`.env.local` are ignored and excluded from both build contexts. *Note:* live tokens do sit in the untracked `.env` and `agent-service/.env` — one `git add -f` from disclosure.
- **`hot_seat.py`'s SQL interpolation is display-only.** `_sql_literal`/`_format_query_sql` (`:53-71`) render for the ClickHouse inspector; the executed query (`clickhouse_store.py:185-199`) and the `LIKE` lookups (`:306-309,319-321`) all use bound parameters. This is the correct pattern that C3 fails to follow.
- **Upload filename traversal is blocked.** The `[^a-zA-Z0-9._-] → _` filter (`assets/upload/route.ts:49`) neutralises `../`; the extension-preservation problem in H2 is separate.
- **The service-role key never reaches the browser.** `getSupabaseAdminClient` reads a non-public var and throws in the browser context; its only importers are `app/api/**` and server-only libs.
- **Route handlers are not response-cached.** Next 16 does not cache route handlers by default (per its own bundled docs), and no route sets `revalidate`/`force-static`, so there is no authenticated-response cache leak.
- **`agent-service.ts` timeouts are correct.** `AbortSignal.timeout` is applied to both `postJson` and `getJson` with a clean `TimeoutError` mapping; only the three fetches in M20 are missing them.
- **The video-sequence job map does not leak.** `video_sequencer.py:99,107-127` caps `_MAX_JOBS = 64` with TTL pruning on both start and status. The real defect is the missing `job_id` ownership check and H5.
- **`generation_cache` RLS is correct and deliberate.** RLS enabled with zero policies (`schema.sql:161-166,251-255`) is intentional and matches `generation-cache.ts`'s admin-only client.
- **The unclosed `genai.Client` is not a leak.** `google/genai/client.py:604` defines `__del__` → `close()`; CPython refcounting releases it at handler exit.
- **A fresh `InMemoryRunner`/session per request is not a leak.** Each runner owns its own `InMemorySessionService`; the graph is dropped when `run_agent_once` returns.
- **The two schema files do not drift.** `web/lib/supabase-schema.sql` is a 3-line pointer naming `supabase/schema.sql` as canonical.
- **Per-user RLS on the data tables is correctly written** (`schema.sql:206-249`, all `USING (user_id = auth.uid())` with matching `WITH CHECK`). It is defeated only because the app routes use the service-role client — which is why C2/C5/C6 matter.
- **Both Dockerfiles run non-root** (`USER appuser`, `USER nextjs`) with committed lockfiles (`uv sync --frozen`, `npm ci`).
- **`cleanup-guest-data.sql` has no injection surface** — entirely static DML.

---

## Suggested remediation order

1. **Stop the bleeding (hours).** Put `requireAuth` on every `web/app/api/**` route (or add `middleware.ts`), require auth/IAM on Cloud Run, and set `ALLOWED_ORIGINS` explicitly. This alone closes C1 and most of C2/C5/C7.
2. **Fix the injection and file-read primitives (hours).** C3 (bind parameters in `continuity.py`/`market_viability.py`) and C4 (`Path.resolve()` + `is_relative_to`, host allowlist).
3. **Close the tenancy holes (days).** C2, C5, C6, C8, H13 — add ownership predicates to every admin-client mutation, unify on the existing `upsertProjectToSupabase` IDOR guard, key talent rows per user, and add `owner = auth.uid()` to the storage policies.
4. **Make failures honest (days).** H6, H9, H10, H11, H12, M6 — stop reporting success for swallowed writes and unapplied actions, and stop discarding persisted fields.
5. **Harden reliability (days).** H3, H4, H5, H7, H8, M2, M3, M23, M24 — threadpool the blocking calls, add timeouts, bound every loop and label set.
6. **Fix CI/CD and packaging (days).** H14, M1, M28, M29 — make the health check fail, move to WIF + Secret Manager, pass `NEXT_PUBLIC_*` as build args, pin images.

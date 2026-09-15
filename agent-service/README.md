# BlendEye — Agent Service

Stateless Python/FastAPI sidecar handling Gemini/ADK agent calls and the
ClickHouse `story_events` store. Next.js (`../web`) owns all Postgres/Supabase
writes and serves the frontend; this service owns everything that needs
Gemini or ClickHouse at runtime. See `../plan.md` for the full architecture.

## Endpoints

- `POST /script/generate` — master script generation from a scene premise.
- `POST /sharding/shard` — Character Perspective Sharder: takes a generated
  screenplay, derives per-character timestamped knowledge events via an ADK
  agent with structured output, writes them to ClickHouse `story_events`.
- `POST /hot-seat/ask` — the time-gated interrogation endpoint. Queries
  ClickHouse for a character's knowledge state at a given story timestamp,
  builds a fresh ADK agent scoped to exactly that knowledge, and answers.
- `GET /health` — liveness check, no external dependencies.

Full request/response schemas: run the server and visit `/docs`.

## Setup

Requires [uv](https://docs.astral.sh/uv/) — it manages the Python version
(pinned via `.python-version`, 3.12), the venv, and locked dependency
versions (`uv.lock`, committed) automatically. No manual venv activation.

```bash
cd agent-service
uv sync   # creates .venv, installs exact locked versions from uv.lock
cp .env.example .env   # then fill in GOOGLE_API_KEY at minimum
```

`/health` and `/script/generate` work with only `GOOGLE_API_KEY` set.
`/sharding/shard` and `/hot-seat/ask` additionally need a reachable
ClickHouse instance — for local dev, start the container from the repo
root (`docker compose up -d clickhouse`) and make sure
`CLICKHOUSE_PASSWORD` here matches the root `.env`'s value (an empty
password is rejected by ClickHouse's HTTP auth, confirmed by testing — use
a real value even for local dev). ClickHouse Cloud works too; see the
`CLICKHOUSE_*` comments in `.env.example`.

Run this service natively, not in Docker, while actively developing —
`--reload` plus a native Python process is a faster edit loop than
anything bind-mount-based, and ClickHouse is the only piece here that
genuinely benefits from staying containerized:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

To pick up new upstream releases (respecting the `mcp`/`mcp-clickhouse` pin
below), run `uv lock -U` then `uv sync`.

## ClickHouse integration

Two separate paths, intentionally:

- `app/services/clickhouse_store.py` — direct `clickhouse-connect` driver,
  used by our own application code for `story_events` reads/writes (the
  Story Event Engine backing the timeline scrubber's time-gate mechanic).
- `app/services/clickhouse_mcp.py` — launches the official `mcp-clickhouse`
  server as a subprocess and wires it into ADK as a tool an agent can call
  itself. This is what provides genuine agent-driven ClickHouse access
  (runtime use of the `mcp-clickhouse` MCP server, not just a SQL driver)
  — reserved for agent-initiated grounding queries
  (plan.md Layer 4), not our own internal reads/writes.

## Dependency note

`mcp-clickhouse` is pinned to `0.5.0` and `mcp` to `>=1.9,<2.0` in
`pyproject.toml`, and `uv.lock` freezes the exact resolved versions of
everything else — every other dependency floor is set to the latest
release available as of 2026-09-04. Newer `mcp-clickhouse` (0.6.0+)
requires `fastmcp>=4.0` which requires `mcp>=2.0`, but `google-adk` 2.8.0's
`McpToolset` imports `mcp.shared.session`, a module that doesn't exist in
`mcp` 2.x's restructured package layout. This is a real, current upstream
conflict between the two packages, confirmed by `uv`'s resolver refusing to
solve it with both packages latest — not a preference. Re-check this pin
(`uv lock -U` and see if it still fails) before upgrading either
dependency.

## Lint / test

```bash
uv run ruff check app/
uv run pytest
```

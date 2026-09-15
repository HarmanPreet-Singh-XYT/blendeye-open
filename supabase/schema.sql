-- ============================================================================
-- AGENTIC CINEMA — SUPABASE (POSTGRESQL) SCHEMA WITH AUTHENTICATION
-- ============================================================================
-- Supports:
-- 1. Full Supabase Auth integration (email/password, magic link, OAuth)
-- 2. User-isolated projects, scratchpads, and revision snapshots
-- 3. Cloud-only storage: every row is owned by an account (user_id NOT NULL
--    rows only). There is no anonymous/guest mode — the app requires sign-in,
--    and no browser-side persistence exists.
--
-- Existing databases that still hold anonymous `user_id IS NULL` demo rows
-- should run supabase/cleanup-guest-data.sql once.
-- ============================================================================

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    genre TEXT,
    premise TEXT,
    scene_title TEXT,
    scene_summary TEXT,
    screenplay_text TEXT,
    director_style TEXT,
    core_secret TEXT,
    primary_location TEXT,
    target_territories JSONB DEFAULT '[]'::jsonb,
    narrative_format TEXT DEFAULT 'feature',
    target_runtime_minutes INTEGER DEFAULT 105,
    scene_placement_seconds INTEGER DEFAULT 1800,
    scene_duration_seconds INTEGER DEFAULT 180,
    characters JSONB DEFAULT '[]'::jsonb,
    initial_events JSONB DEFAULT '[]'::jsonb,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    is_custom BOOLEAN DEFAULT true,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- 2. SCRATCHPAD NOTES TABLE
CREATE TABLE IF NOT EXISTS public.scratchpad_notes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT DEFAULT 'concept',
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_scratchpad_user ON public.scratchpad_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_scratchpad_project ON public.scratchpad_notes(project_id);

-- 3. TALENT VAULT TABLE (Saved Custom Characters)
CREATE TABLE IF NOT EXISTS public.talent_vault (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    archetype TEXT,
    speech_style TEXT,
    subtext_ratio TEXT,
    actor_comp TEXT,
    objective TEXT,
    dials_summary TEXT,
    quirks JSONB DEFAULT '[]'::jsonb,
    role TEXT,
    personality_preset TEXT,
    confidence REAL DEFAULT 0.7,
    verbal_pacing REAL DEFAULT 0.5,
    image_url TEXT,
    full_body_image_url TEXT,
    visual_description TEXT,
    wardrobe TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_talent_user ON public.talent_vault(user_id);

-- 4. PROJECT REVISION SNAPSHOTS TABLE (Graph Version History)
CREATE TABLE IF NOT EXISTS public.project_snapshots (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    display_time TEXT,
    summary TEXT,
    description TEXT,
    category TEXT,
    snapshot JSONB NOT NULL,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON public.project_snapshots(project_id, created_at DESC);

-- 5. GENERATION CACHE TABLE (Server-Side Persistent AI Cache)
CREATE TABLE IF NOT EXISTS public.generation_cache (
    key TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    payload JSONB,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_cache_namespace ON public.generation_cache(namespace);

-- 6. ASSETS TABLE (Media Library, Floor Plans, Character References, Footage)
CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'image', 'video', 'map', 'audio'
    category TEXT NOT NULL, -- 'map', 'character_face', 'character_body', 'location', 'style', 'video', 'audio', 'general'
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    size_bytes BIGINT DEFAULT 0,
    mime_type TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_created ON public.assets(created_at DESC);

-- ============================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cinema_assets', 'cinema_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
--
-- Threat model: the browser only ever holds the publishable (anon) key, so
-- anything an anon policy permits is effectively world-writable. The
-- application reads and writes these tables through Next.js API routes, which
-- prefer the service-role admin client (bypasses RLS) and derive user_id from a
-- verified auth token — see web/app/api/projects/route.ts and
-- web/lib/supabase-store.ts.
--
-- Therefore the policies below grant nothing to `anon` and restrict
-- `authenticated` users to their own rows. Seed/demo templates are stored with
-- user_id IS NULL and are served through the API's admin client, NOT by
-- exposing them as rows any visitor can write. The previous
-- `user_id IS NULL OR user_id = auth.uid()` policies did expose them: because
-- WITH CHECK also accepted `user_id IS NULL`, an anonymous client could update
-- or delete every shared demo slate.
--
-- generation_cache intentionally gets NO policies at all: it is a server-side
-- cache and must only ever be touched with the service-role key.

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scratchpad_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Drop legacy policies if refreshing (idempotent re-run of this file).
    DROP POLICY IF EXISTS "Allow public read/write projects" ON public.projects;
    DROP POLICY IF EXISTS "Allow public read/write scratchpad" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Allow public read/write talent" ON public.talent_vault;
    DROP POLICY IF EXISTS "Allow public read/write snapshots" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Allow public read/write cache" ON public.generation_cache;
    DROP POLICY IF EXISTS "Projects access policy" ON public.projects;
    DROP POLICY IF EXISTS "Scratchpad access policy" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Talent access policy" ON public.talent_vault;
    DROP POLICY IF EXISTS "Snapshots access policy" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Assets access policy" ON public.assets;
    DROP POLICY IF EXISTS "Generation cache access policy" ON public.generation_cache;

    DROP POLICY IF EXISTS "Projects select own" ON public.projects;
    DROP POLICY IF EXISTS "Projects insert own" ON public.projects;
    DROP POLICY IF EXISTS "Projects update own" ON public.projects;
    DROP POLICY IF EXISTS "Projects delete own" ON public.projects;
    DROP POLICY IF EXISTS "Scratchpad select own" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Scratchpad insert own" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Scratchpad update own" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Scratchpad delete own" ON public.scratchpad_notes;
    DROP POLICY IF EXISTS "Talent select own" ON public.talent_vault;
    DROP POLICY IF EXISTS "Talent insert own" ON public.talent_vault;
    DROP POLICY IF EXISTS "Talent update own" ON public.talent_vault;
    DROP POLICY IF EXISTS "Talent delete own" ON public.talent_vault;
    DROP POLICY IF EXISTS "Snapshots select own" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Snapshots insert own" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Snapshots update own" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Snapshots delete own" ON public.project_snapshots;
    DROP POLICY IF EXISTS "Assets select own" ON public.assets;
    DROP POLICY IF EXISTS "Assets insert own" ON public.assets;
    DROP POLICY IF EXISTS "Assets update own" ON public.assets;
    DROP POLICY IF EXISTS "Assets delete own" ON public.assets;

    -- Owner-scoped policies. Anonymous clients get no access to these tables at
    -- all; signed-in users may only read and mutate rows they own.
    CREATE POLICY "Projects select own" ON public.projects
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Projects insert own" ON public.projects
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Projects update own" ON public.projects
        FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Projects delete own" ON public.projects
        FOR DELETE TO authenticated USING (user_id = auth.uid());

    CREATE POLICY "Scratchpad select own" ON public.scratchpad_notes
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Scratchpad insert own" ON public.scratchpad_notes
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Scratchpad update own" ON public.scratchpad_notes
        FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Scratchpad delete own" ON public.scratchpad_notes
        FOR DELETE TO authenticated USING (user_id = auth.uid());

    CREATE POLICY "Talent select own" ON public.talent_vault
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Talent insert own" ON public.talent_vault
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Talent update own" ON public.talent_vault
        FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Talent delete own" ON public.talent_vault
        FOR DELETE TO authenticated USING (user_id = auth.uid());

    CREATE POLICY "Snapshots select own" ON public.project_snapshots
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Snapshots insert own" ON public.project_snapshots
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Snapshots update own" ON public.project_snapshots
        FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Snapshots delete own" ON public.project_snapshots
        FOR DELETE TO authenticated USING (user_id = auth.uid());

    CREATE POLICY "Assets select own" ON public.assets
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Assets insert own" ON public.assets
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Assets update own" ON public.assets
        FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Assets delete own" ON public.assets
        FOR DELETE TO authenticated USING (user_id = auth.uid());

    -- NOTE: public.generation_cache deliberately has RLS enabled and zero
    -- policies. Anon and authenticated requests are denied; only the
    -- service-role key (web/lib/generation-cache.ts) can read or write it.
    -- Previously `FOR ALL USING (true) WITH CHECK (true)` made the shared
    -- generation cache publicly readable, poisonable, and clearable.

    -- Storage RLS policies for cinema_assets bucket.
    -- NOTE: cinema_assets is a PUBLIC bucket, so public URLs (CDN downloads)
    -- work without a SELECT policy. Deliberately omitting a broad SELECT policy
    -- on storage.objects prevents unauthorized listing/scraping of directory
    -- contents.
    DROP POLICY IF EXISTS "Public view cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public insert cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public update cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Public delete cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated insert cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated update cinema_assets" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated delete cinema_assets" ON storage.objects;

    -- Writes require an authenticated session. Server-side uploads use the
    -- service-role key (see web/lib/media-storage-service.ts); when that key is
    -- absent the upload route falls back to local disk rather than silently
    -- accepting anonymous bucket writes.
    CREATE POLICY "Authenticated insert cinema_assets" ON storage.objects
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cinema_assets');

    CREATE POLICY "Authenticated update cinema_assets" ON storage.objects
        FOR UPDATE TO authenticated USING (bucket_id = 'cinema_assets') WITH CHECK (bucket_id = 'cinema_assets');

    CREATE POLICY "Authenticated delete cinema_assets" ON storage.objects
        FOR DELETE TO authenticated USING (bucket_id = 'cinema_assets');
END $$;


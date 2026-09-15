-- ============================================================================
-- ONE-TIME CLEANUP — remove orphaned "guest" / demo rows
-- ============================================================================
--
-- BlendEye used to support an anonymous mode where demo projects and seed
-- content were stored with `user_id IS NULL` and served to anyone. The app is
-- now cloud-only and login-gated (see README → "Storage & Access Model"), so
-- those rows are unreachable dead weight and, under the old permissive RLS
-- policies, were writable by any visitor.
--
-- Run this ONCE against an existing database, after deploying the code change
-- and before the RLS rewrite in supabase/schema.sql matters.
--
-- Review the SELECT counts first. If you want to keep any of this content,
-- re-assign it to a real account instead:
--
--   UPDATE public.projects
--      SET user_id = '<your-auth-user-uuid>'
--    WHERE user_id IS NULL AND id = 'the-project-you-want-to-keep';
--
-- Safe to re-run: each statement is a no-op once the rows are gone.
-- ============================================================================

-- 1. Inspect what will be deleted.
SELECT 'projects' AS table_name, count(*) FROM public.projects WHERE user_id IS NULL
UNION ALL SELECT 'scratchpad_notes', count(*) FROM public.scratchpad_notes WHERE user_id IS NULL
UNION ALL SELECT 'talent_vault',     count(*) FROM public.talent_vault     WHERE user_id IS NULL
UNION ALL SELECT 'project_snapshots',count(*) FROM public.project_snapshots WHERE user_id IS NULL
UNION ALL SELECT 'assets',           count(*) FROM public.assets           WHERE user_id IS NULL;

-- 2. Delete. Children first where a FK points at projects.
DELETE FROM public.project_snapshots WHERE user_id IS NULL;
DELETE FROM public.scratchpad_notes  WHERE user_id IS NULL;
DELETE FROM public.assets            WHERE user_id IS NULL;
DELETE FROM public.talent_vault      WHERE user_id IS NULL;
DELETE FROM public.projects          WHERE user_id IS NULL;

-- 3. Verify: every count below should be 0.
SELECT 'projects' AS table_name, count(*) FROM public.projects WHERE user_id IS NULL
UNION ALL SELECT 'scratchpad_notes', count(*) FROM public.scratchpad_notes WHERE user_id IS NULL
UNION ALL SELECT 'talent_vault',     count(*) FROM public.talent_vault     WHERE user_id IS NULL
UNION ALL SELECT 'project_snapshots',count(*) FROM public.project_snapshots WHERE user_id IS NULL
UNION ALL SELECT 'assets',           count(*) FROM public.assets           WHERE user_id IS NULL;

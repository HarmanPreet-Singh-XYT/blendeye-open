"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  hydrateStore,
  isStoreHydrated,
  purgeLegacyLocalData,
} from "@/lib/project-store";
import { clearAssetCache, hydrateAssets } from "@/lib/asset-store";
import { FilmstripLoader } from "@/components/cinema/filmstrip-loader";

/**
 * Gate for every authenticated surface (dashboard, studio, scene pages).
 *
 * The app is cloud-only: project data lives in Supabase and is read through
 * the in-memory store cache, so a signed-out visitor has nothing to show.
 * This component therefore does three things in order:
 *
 *   1. waits for Supabase to report the session (avoids an anon/auth flash),
 *   2. redirects to /login when there is no session,
 *   3. blocks children until the store has hydrated, so pages can keep reading
 *      the store synchronously without racing an empty cache.
 *
 * It also clears any data left in the browser by the previous local-first
 * storage model.
 */

function GateShell({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <FilmstripLoader frames={10} label={message} />
    </div>
  );
}

function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
        <h1 className="font-heading text-lg font-bold text-foreground">
          Authentication is not configured
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          BlendEye is cloud-only and requires a Supabase project. Set{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          in your environment, then reload.
        </p>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, isConfigured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [storeReady, setStoreReady] = React.useState(false);

  // One-time cleanup of anything the old local-first model left behind.
  React.useEffect(() => {
    purgeLegacyLocalData();
  }, []);

  // Hydrate the cloud cache once a session exists.
  React.useEffect(() => {
    if (loading || !isAuthenticated) {
      setStoreReady(false);
      // Drop the previous session's assets so they can't bleed into the next one.
      clearAssetCache();
      return;
    }
    if (isStoreHydrated()) {
      setStoreReady(true);
      void hydrateAssets();
      return;
    }

    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setStoreReady(true);
    };

    window.addEventListener("agentic_cinema_store_hydrated", markReady);
    void hydrateStore().then(markReady);
    void hydrateAssets();

    return () => {
      cancelled = true;
      window.removeEventListener("agentic_cinema_store_hydrated", markReady);
    };
  }, [loading, isAuthenticated]);

  // Send signed-out visitors to the login screen, preserving where they were.
  React.useEffect(() => {
    if (loading || !isConfigured || isAuthenticated) return;
    const target = pathname
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";
    router.replace(target);
  }, [loading, isConfigured, isAuthenticated, pathname, router]);

  if (!isConfigured) return <ConfigError />;
  if (loading) return <GateShell message="Restoring session" />;
  if (!isAuthenticated) return <GateShell message="Redirecting to sign in" />;
  if (!storeReady) return <GateShell message="Loading your studio" />;

  return <>{children}</>;
}

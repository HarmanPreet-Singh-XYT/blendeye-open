import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Persistent Generation Cache for Agentic Cinema.
 * Uses a tiered architecture:
 * 1. In-memory fast RAM cache (LRU buffer, 30 min TTL)
 * 2. Supabase Postgres `generation_cache` table (distributed, cloud persistent)
 * 3. Local disk cache `.cache/agentic_cinema/` (ephemeral dev fallback)
 *
 * SERVER-ONLY. Every caller is a Next.js API route. The `generation_cache`
 * table has RLS enabled with no policies, so only the service-role admin client
 * can read or write it — a browser-side (anon-key) caller would be denied, and
 * previously would also have let any visitor poison or clear the shared cache.
 * Do not import this module from a client component.
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "agentic_cinema");

// Bump when a cached result shape or the prompt that produced it changes, so
// entries from a previous format are never served. Without this the key was
// `namespace:payload` only, so editing a prompt silently kept returning the old
// generation for an identical payload.
const CACHE_SCHEMA_VERSION = "v2";

// In-memory LRU fast buffer to prevent DB / disk I/O on rapid repeated hits
const memoryCache = new Map<string, { data: any; expiresAt: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 30; // 30 minutes in RAM

let totalHits = 0;
let totalMisses = 0;

function ensureCacheDir(namespace: string): string {
  const dir = path.join(CACHE_DIR, namespace);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Service-role client for the cache table, or null when it isn't configured.
 * Returns null rather than falling back to the anon key, so the caller degrades
 * to the disk cache instead of attempting a write that RLS will reject.
 */
function getCacheSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  try {
    return getSupabaseAdminClient();
  } catch (err) {
    console.warn("[GenerationCache] admin client unavailable; using disk cache only:", err);
    return null;
  }
}

export function hashPayload(namespace: string, payload: unknown): string {
  const normalized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return crypto
    .createHash("sha256")
    .update(`${CACHE_SCHEMA_VERSION}:${namespace}:${normalized}`)
    .digest("hex");
}

export async function getCachedGeneration<T>(
  namespace: string,
  payload: unknown
): Promise<T | null> {
  const key = hashPayload(namespace, payload);

  // 1. Check in-memory buffer
  const inMem = memoryCache.get(key);
  if (inMem && inMem.expiresAt > Date.now()) {
    totalHits++;
    return inMem.data as T;
  }

  // 2. Check Supabase cloud generation_cache table
  if (isSupabaseConfigured()) {
    try {
      const client = getCacheSupabaseClient();
      if (client) {
        const { data, error } = await client
          .from("generation_cache")
          .select("result")
          .eq("key", key)
          .maybeSingle();

        if (!error && data?.result) {
          totalHits++;
          memoryCache.set(key, {
            data: data.result,
            expiresAt: Date.now() + MEMORY_TTL_MS,
          });
          return data.result as T;
        }
      }
    } catch (err) {
      console.warn(`[GenerationCache] Supabase read error for ${namespace}/${key}:`, err);
    }
  }

  // 3. Check persistent disk cache (local dev fallback)
  try {
    const dir = ensureCacheDir(namespace);
    const filePath = path.join(dir, `${key}.json`);

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      totalHits++;

      // Populate memory cache
      memoryCache.set(key, {
        data: parsed.result,
        expiresAt: Date.now() + MEMORY_TTL_MS,
      });

      return parsed.result as T;
    }
  } catch (err) {
    console.warn(`[GenerationCache] Local disk read error for ${namespace}/${key}:`, err);
  }

  totalMisses++;
  return null;
}

export async function setCachedGeneration<T>(
  namespace: string,
  payload: unknown,
  result: T
): Promise<void> {
  const key = hashPayload(namespace, payload);

  // Update in-memory
  memoryCache.set(key, {
    data: result,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });

  // Write to Supabase cloud generation_cache
  if (isSupabaseConfigured()) {
    try {
      const client = getCacheSupabaseClient();
      if (client) {
        await client
          .from("generation_cache")
          .upsert({
            key,
            namespace,
            payload: typeof payload === "object" ? payload : { raw: payload },
            result,
          }, { onConflict: "key" });
      }
    } catch (err) {
      console.warn(`[GenerationCache] Supabase write error for ${namespace}/${key}:`, err);
    }
  }

  // Write to persistent disk
  try {
    const dir = ensureCacheDir(namespace);
    const filePath = path.join(dir, `${key}.json`);

    const record = {
      key,
      namespace,
      cachedAt: new Date().toISOString(),
      payload,
      result,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[GenerationCache] Local disk write error for ${namespace}/${key}:`, err);
  }
}

import { toast } from "@/components/ui/toast";

/**
 * API routes proxy to the Python agent-service and degrade to hardcoded
 * demo content (marked `_fallback: true`) instead of erroring when that
 * backend is unreachable, so the UI stays usable during a live demo.
 * Call this after parsing any such response so the director isn't misled
 * into thinking mock content is a live Gemini/Omni Flash/ClickHouse result.
 */
export function notifyIfFallback(data: unknown, featureLabel: string): boolean {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // If live search grounding succeeded via Parallel Web Systems, do NOT show a false offline warning!
    if (obj.search_grounded === true) {
      return false;
    }

    if (Array.isArray(obj.scenes)) {
      const anyGrounded = obj.scenes.some((s: any) =>
        s.candidates?.some((c: any) => c.search_grounded === true || (Array.isArray(c.sources) && c.sources.some((src: any) => src.title?.toLowerCase().includes("parallel"))))
      );
      if (anyGrounded) {
        return false;
      }
    }

    if (obj._fallback) {
      toast.add({
        title: `${featureLabel}: showing offline demo content`,
        description: "The agent-service backend is unreachable, so this is placeholder output, not a live AI result.",
        type: "warning",
      });
      return true;
    }
  }
  return false;
}

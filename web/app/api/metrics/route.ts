import { NextResponse } from "next/server";

export async function GET() {
  const agentServiceUrl = process.env.AGENT_SERVICE_URL;
  const isProd = process.env.NODE_ENV === "production";
  const effectiveUrl = agentServiceUrl || (!isProd ? "http://localhost:8000" : null);

  if (effectiveUrl) {
    try {
      const res = await fetch(`${effectiveUrl}/metrics`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // Degrade to mock metrics if sidecar is unreachable
    }
  }

  return NextResponse.json({
    studio: "BlendEye Executive Backlot",
    integrations: ["ClickHouse Cloud"],
    mcp_servers: {
      clickhouse_mcp: "unreachable",
      state: "degraded",
    },
    telemetry: {
      uptime_seconds: Math.floor(Date.now() / 1000),
    },
    _fallback: true,
    _error: "agent-service unreachable",
  });
}

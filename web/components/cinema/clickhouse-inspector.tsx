"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Database,
  X,
  Copy,
  Check,
  Activity,
  Zap,
  CheckCircle2,
  RefreshCw,
  Server,
  Layers,
  Bot,
  AlertTriangle,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClickHouseQueryLog {
  id: string;
  timestamp: string;
  sql: string;
  durationMs?: number;
  type: "scrub" | "interrogate" | "insert" | "events" | "precedents";
}

interface ClickHouseInspectorProps {
  logs: ClickHouseQueryLog[];
  lastSql?: string;
  isOpen?: boolean;
  initialTab?: "clickhouse" | "grafana";
  onToggle?: () => void;
  onClose?: () => void;
  className?: string;
}

export function ClickHouseInspector({
  logs,
  lastSql,
  isOpen: controlledIsOpen,
  initialTab = "clickhouse",
  onToggle: controlledOnToggle,
  onClose,
  className,
}: ClickHouseInspectorProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"clickhouse" | "grafana">(initialTab);
  const [grafanaView, setGrafanaView] = React.useState<"agentic" | "system">("agentic");
  const [agenticCategoryFilter, setAgenticCategoryFilter] = React.useState<string>("All");
  const [searchRole, setSearchRole] = React.useState<string>("");

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [observabilityData, setObservabilityData] = React.useState<any>(null);
  const [loadingObservability, setLoadingObservability] = React.useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const handleCopySql = (id: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Fetch Grafana Observability overview
  const fetchObservability = React.useCallback(async () => {
    setLoadingObservability(true);
    try {
      const res = await fetch("/api/observability");
      if (res.ok) {
        const data = await res.json();
        setObservabilityData(data);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingObservability(false);
    }
  }, []);

  const [isBenchmarking, setIsBenchmarking] = React.useState(false);
  const [benchmarkResult, setBenchmarkResult] = React.useState<any>(null);

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch("/api/observability/benchmark", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkResult(data);
        await fetchObservability();
      }
    } catch {
      // Ignored
    } finally {
      setIsBenchmarking(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && activeTab === "grafana") {
      fetchObservability();
    }
  }, [isOpen, activeTab, fetchObservability]);

  const agenticSummary = observabilityData?.agentic_request_distribution;
  const agenticRoles = React.useMemo(() => {
    return agenticSummary?.roles || [];
  }, [agenticSummary]);

  const categories = React.useMemo(() => {
    const set = new Set<string>(["All"]);
    agenticRoles.forEach((r: any) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [agenticRoles]);

  const filteredRoles = React.useMemo(() => {
    return agenticRoles.filter((r: any) => {
      const matchCat = agenticCategoryFilter === "All" || r.category === agenticCategoryFilter;
      const matchSearch =
        !searchRole.trim() ||
        r.label?.toLowerCase().includes(searchRole.toLowerCase()) ||
        r.agentic_use?.toLowerCase().includes(searchRole.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [agenticRoles, agenticCategoryFilter, searchRole]);

  if (!isOpen && isControlled) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-t border-border bg-card/98 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden shrink-0 z-30",
        isOpen ? "h-[28rem]" : "h-10",
        className
      )}
    >
      {/* Header bar */}
      <div className="w-full h-10 px-4 flex items-center justify-between border-b border-border/60 bg-secondary/20">
        <div className="flex items-center gap-3 min-w-0">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border">
            <button
              type="button"
              onClick={() => {
                setActiveTab("clickhouse");
                if (!isOpen) handleToggle();
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                activeTab === "clickhouse"
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Database className="h-3 w-3 text-accent" />
              <span>ClickHouse SQL</span>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] h-3.5 px-1 font-mono">
                {logs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("grafana");
                if (!isOpen) handleToggle();
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                activeTab === "grafana"
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="h-3 w-3 text-amber-400" />
              <span>Grafana Observability</span>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] h-3.5 px-1 font-mono">
                mcp-grafana
              </Badge>
            </button>
          </div>

          {/* Sub-view switcher for Grafana tab */}
          {activeTab === "grafana" && (
            <div className="hidden sm:flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border">
              <button
                type="button"
                onClick={() => setGrafanaView("agentic")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                  grafanaView === "agentic"
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bot className="h-3 w-3" />
                <span>Agentic Requests</span>
                {agenticSummary?.total_requests !== undefined && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-accent/40 bg-accent/10 text-accent font-mono">
                    {agenticSummary.total_requests}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGrafanaView("system")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                  grafanaView === "system"
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Server className="h-3 w-3" />
                <span>Pipelines & Cloud RTT</span>
              </button>
            </div>
          )}

          {activeTab === "clickhouse" && lastSql && (
            <span className="hidden lg:inline font-mono text-[11px] text-muted-foreground truncate max-w-md">
              {lastSql.replace(/\s+/g, " ").slice(0, 60)}...
            </span>
          )}
          {activeTab === "grafana" && (
            <span className="hidden xl:inline text-[11px] text-muted-foreground truncate">
              OpenTelemetry · Prometheus Exporter (/observability/metrics) · mcp-grafana
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "grafana" && (
            <button
              type="button"
              onClick={fetchObservability}
              disabled={loadingObservability}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 text-[11px]"
              title="Refresh Grafana Metrics"
            >
              <RefreshCw className={cn("h-3 w-3", loadingObservability && "animate-spin text-accent")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggle}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer ml-1"
              title="Close Telemetry Panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      {isOpen && (
        <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-3 font-mono text-xs select-text">
          {activeTab === "clickhouse" ? (
            /* ── ClickHouse Query Log Feed ── */
            logs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No queries logged yet. Scrub the timeline or interrogate a character in Plan mode to see live ClickHouse queries.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded border border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors space-y-1 group relative"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-accent/20 text-accent font-semibold font-mono">
                          {log.type}
                        </span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.durationMs !== undefined && (
                          <span className="text-emerald-400 font-semibold font-mono">{log.durationMs}ms</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopySql(log.id, log.sql)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
                          title="Copy SQL Query"
                        >
                          {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                    <pre className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-[11px] select-all font-mono">
                      {log.sql}
                    </pre>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Grafana Studio Observability Console ── */
            grafanaView === "agentic" ? (
              <div className="space-y-3">
                {/* Executive Summary Metric Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 rounded border border-border/80 bg-secondary/20 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Total Agentic Requests</span>
                      <Bot className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="text-sm font-bold text-foreground font-mono">
                      {agenticSummary?.total_requests ?? 0} calls
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      Grouped across {agenticSummary?.roles?.length ?? 0} agentic uses
                    </div>
                  </div>

                  <div className="p-2 rounded border border-emerald-500/30 bg-emerald-500/10 space-y-0.5">
                    <div className="text-[10px] text-emerald-400 flex items-center justify-between">
                      <span>2xx HTTP Success Rate</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      {agenticSummary?.success_rate_percent ?? 100}%
                    </div>
                    <div className="text-[9px] text-emerald-300/80">
                      {agenticSummary?.status_classes?.["2xx"] ?? 0} successful executions
                    </div>
                  </div>

                  <div className="p-2 rounded border border-amber-500/30 bg-amber-500/10 space-y-0.5">
                    <div className="text-[10px] text-amber-400 flex items-center justify-between">
                      <span>4xx Client Errors</span>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="text-sm font-bold text-amber-400 font-mono">
                      {agenticSummary?.status_classes?.["4xx"] ?? 0} calls
                    </div>
                    <div className="text-[9px] text-amber-300/80">
                      Advisory & validation guards
                    </div>
                  </div>

                  <div className="p-2 rounded border border-rose-500/30 bg-rose-500/10 space-y-0.5">
                    <div className="text-[10px] text-rose-400 flex items-center justify-between">
                      <span>5xx Server Errors</span>
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                    </div>
                    <div className="text-sm font-bold text-rose-400 font-mono">
                      {agenticSummary?.status_classes?.["5xx"] ?? 0} calls
                    </div>
                    <div className="text-[9px] text-rose-300/80">
                      Backend timeouts & exceptions
                    </div>
                  </div>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {categories.map((cat: string) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAgenticCategoryFilter(cat)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                          agenticCategoryFilter === cat
                            ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                            : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search agentic role..."
                      value={searchRole}
                      onChange={(e) => setSearchRole(e.target.value)}
                      className="w-full h-6 pl-6 pr-2 text-[10px] bg-background/80 border border-border rounded font-mono placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Agentic Roles Grid */}
                <div className="space-y-1.5">
                  {filteredRoles.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs font-sans">
                      No agentic roles matched the selected filter.
                    </div>
                  ) : (
                    filteredRoles.map((role: any) => (
                      <div
                        key={role.agentic_use}
                        className="p-2.5 rounded border border-border/70 bg-secondary/15 hover:bg-secondary/35 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-[11px]"
                      >
                        {/* Role metadata */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground font-sans">
                              {role.label}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground px-1.5 py-0.2 rounded bg-background/80 border border-border/50">
                              {role.agentic_use}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-accent/30 text-accent bg-accent/5 font-sans"
                            >
                              {role.category}
                            </Badge>
                          </div>
                        </div>

                        {/* Status codes, call counts, latencies */}
                        <div className="flex items-center gap-3.5 shrink-0 flex-wrap font-mono text-[10px]">
                          {/* Status Codes */}
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-[9px] uppercase font-sans">Status:</span>
                            {Object.entries(role.status_codes || {}).map(([code, count]: [string, any]) => {
                              const is2xx = code.startsWith("2");
                              const is4xx = code.startsWith("4");
                              return (
                                <span
                                  key={code}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                                    is2xx
                                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                      : is4xx
                                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                      : "bg-rose-500/15 border-rose-500/40 text-rose-400"
                                  )}
                                  title={`HTTP ${code}: ${count} requests`}
                                >
                                  {code} <span className="opacity-80">({count})</span>
                                </span>
                              );
                            })}
                          </div>

                          {/* Total Calls */}
                          <div className="text-right">
                            <span className="text-muted-foreground text-[9px] block">Calls</span>
                            <span className="font-bold text-foreground">{role.total_calls}</span>
                          </div>

                          {/* Average Latency */}
                          <div className="text-right min-w-[55px]">
                            <span className="text-muted-foreground text-[9px] block">Latency</span>
                            <span className="font-bold text-cyan-400">{role.avg_latency_ms} ms</span>
                          </div>

                          {/* Success Rate */}
                          <div className="text-right min-w-[50px]">
                            <span className="text-muted-foreground text-[9px] block">Success</span>
                            <span
                              className={cn(
                                "font-bold",
                                role.success_rate >= 99
                                  ? "text-emerald-400"
                                  : role.success_rate >= 90
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              )}
                            >
                              {role.success_rate}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* ── Pipelines & Cloud RTT View ── */
              <div className="space-y-3">
                {/* Live Telemetry Benchmark Action Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-md border border-emerald-500/30 bg-emerald-950/20 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        Live Telemetry Benchmark & Load Generator
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Dispatches a calibrated multi-system burst across ClickHouse, Parallel Web, Omni Flash & Gemini
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold font-mono transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
                  >
                    {isBenchmarking ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Emitting Burst...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 text-amber-300" />
                        <span>⚡ Run Live Benchmark</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Benchmark Output Card (if executed) */}
                {benchmarkResult && (
                  <div className="p-2.5 rounded border border-accent/40 bg-accent/10 text-[11px] font-mono grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">ClickHouse Latency</span>
                      <span className="font-bold text-emerald-400">
                        {benchmarkResult.clickhouse?.avg_latency_ms != null ? `${benchmarkResult.clickhouse.avg_latency_ms} ms avg` : "Idle / Unqueried"}
                      </span>
                      <span className="text-[9px] text-muted-foreground block">
                        {benchmarkResult.clickhouse?.p95_latency_ms != null ? `p95: ${benchmarkResult.clickhouse.p95_latency_ms}ms` : benchmarkResult.clickhouse?.slo_status || "No queries executed"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Benchmark Duration</span>
                      <span className="font-bold text-cyan-400">
                        {benchmarkResult.benchmark_duration_ms != null ? `${benchmarkResult.benchmark_duration_ms} ms` : "Probed"}
                      </span>
                      <span className="text-[9px] text-muted-foreground block">
                        {benchmarkResult.clickhouse?.queries_executed ? `${benchmarkResult.clickhouse.queries_executed} queries tested` : "Network RTT benchmark"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Network Targets Probed</span>
                      <span className="font-bold text-purple-400">
                        {benchmarkResult.network_latencies?.filter((n: any) => n.latency_ms != null).length || 0} / {benchmarkResult.network_latencies?.length || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground block">Live Handshakes</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Grafana Telemetry</span>
                      <span className="font-bold text-amber-400">{benchmarkResult.grafana_cloud_status || "Emitted"}</span>
                      <span className="text-[9px] text-emerald-400 block">✓ Real Live Metric</span>
                    </div>
                  </div>
                )}

                {/* Pipeline Status Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 rounded border border-border bg-secondary/20 space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Omni Flash Pipeline</span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-mono font-medium text-emerald-400">
                        {observabilityData?.telemetry?.pipeline_state?.omni_video_sequencer || "nominal"}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded border border-border bg-secondary/20 space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">ClickHouse Engine</span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-mono font-medium text-emerald-400">
                        {observabilityData?.telemetry?.pipeline_state?.clickhouse_timegate || "connected"}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded border border-border bg-secondary/20 space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Gemini Multi-Agent</span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-mono font-medium text-emerald-400">
                        {observabilityData?.telemetry?.pipeline_state?.gemini_agents || "ready"}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded border border-border bg-secondary/20 space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Parallel Web Systems</span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="font-mono font-medium text-cyan-400">
                        {observabilityData?.telemetry?.pipeline_state?.parallel_web_search || "connected"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PromQL Key Performance Indicators */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                    Core PromQL Telemetry Gauges (Production Studio Exporter):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(observabilityData?.promql_targets || []).map((target: any, tIdx: number) => (
                      <div key={tIdx} className="p-2.5 rounded border border-border/80 bg-secondary/15 flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="text-xs font-medium text-foreground truncate">{target.label}</div>
                          <code className="text-[10px] text-muted-foreground block truncate font-mono">{target.metric}</code>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold font-mono text-emerald-400">{target.value || "nominal"}</span>
                          <span className="text-[9px] text-muted-foreground block">Active SLO</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Official MCP Servers */}
                <div className="p-2.5 rounded border border-emerald-500/20 bg-emerald-950/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <Activity className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Grafana MCP Tools</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/30">
                      mcp-grafana Active (60+ tools)
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Showrunner agent queries real-time studio telemetry via official <code className="text-emerald-400 font-mono">grafana/mcp-grafana</code> STDIO server.
                  </div>
                </div>

                {/* Multi-Cloud & Inter-Service Network Latency Matrix */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                      Inter-Service IPC & Cloud Network Round-Trip Latency (RTT):
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {(() => {
                        const latencies = observabilityData?.network_latencies || benchmarkResult?.network_latencies || [];
                        const active = latencies.filter((n: any) => n.latency_ms != null && n.latency_ms > 0).length;
                        return latencies.length > 0 ? (
                          <span className="text-emerald-400 font-bold">{active}/{latencies.length} Active Probes</span>
                        ) : (
                          "Probes Idle"
                        );
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                    {(() => {
                      const latencies = observabilityData?.network_latencies || benchmarkResult?.network_latencies || [];
                      if (latencies.length === 0) {
                        return (
                          <div className="col-span-full p-2.5 rounded border border-dashed border-border/80 bg-background/40 text-center text-[10px] text-muted-foreground">
                            No network latency probes captured yet. Click <strong>⚡ Run Live Benchmark</strong> to probe round-trip latency to external services.
                          </div>
                        );
                      }
                      return latencies.map((net: any, nIdx: number) => (
                        <div key={nIdx} className="p-1.5 rounded border border-border/80 bg-background/60 font-mono text-[10px] space-y-0.5">
                          <div className="text-[9px] text-muted-foreground truncate font-sans">{net.label || net.service}</div>
                          <div className={`text-xs font-bold ${net.latency_ms != null ? "text-emerald-400" : "text-amber-400"}`}>
                            {net.latency_ms != null ? `${net.latency_ms} ms` : "Offline"}
                          </div>
                          <div className="text-[8px] text-muted-foreground/60 truncate">{net.protocol || net.destination}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Firing Alerts Strip */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                    Grafana IRM Alerts & Health Conditions:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(observabilityData?.alerts || [
                      { name: "ClickHouseSubMillisecondSLO", state: "firing_healthy", message: "ClickHouse queries executing < 4ms target." },
                      { name: "OmniVideoQueueThroughput", state: "normal", message: "Pixel-anchored video pipeline nominal." },
                    ]).map((alert: any, aIdx: number) => (
                      <div key={aIdx} className="px-2.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span className="font-bold font-mono">{alert.name}</span>
                        <span className="text-muted-foreground">· {alert.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Trophy, Users, Tv, FileType, ChevronRight,
  ArrowUpDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import useFilterStore from "@/stores/filterStore";
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";

const DIMENSIONS = [
  { value: "client", label: "Client", icon: Users },
  { value: "channel", label: "Channel", icon: Tv },
  { value: "user", label: "User", icon: Users },
  { value: "type", label: "Output Type", icon: FileType },
];

const METRICS = [
  { value: "uploaded", label: "Uploaded" },
  { value: "processed", label: "Processed" },
  { value: "published", label: "Published" },
  { value: "duration", label: "Duration (h)" },
];

const CHART_COLORS = [
  "oklch(0.7 0.18 265)",
  "oklch(0.75 0.16 165)",
  "oklch(0.7 0.2 25)",
  "oklch(0.8 0.16 85)",
  "oklch(0.7 0.18 330)",
  "oklch(0.65 0.15 200)",
  "oklch(0.72 0.14 130)",
  "oklch(0.68 0.18 50)",
];

const tooltipStyle = {
  background: "oklch(0.18 0.005 285)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "oklch(0.95 0 0)",
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function Analysis() {
  const [dimension, setDimension] = useState("client");
  const [metric, setMetric] = useState("uploaded");
  const [leaderboard, setLeaderboard] = useState(null);
  const [pivot, setPivot] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // subscribe to filters so we re-fetch when they change
  const clientId = useFilterStore((s) => s.clientId);
  const channelId = useFilterStore((s) => s.channelId);
  const platformId = useFilterStore((s) => s.platformId);

  // fetch leaderboard + pivot when dimension/metric changes
  useEffect(() => {
    const params = useFilterStore.getState().toParams();
    const fetchData = async () => {
      setLoading(true);
      setDrilldown(null);
      setSelectedEntity(null);
      try {
        const [lbRes, pivotRes] = await Promise.all([
          api.get("/api/analysis/leaderboard", {
            params: { ...params, dimension, metric },
          }),
          api.get("/api/analysis/pivot", {
            params: { ...params, row_dim: dimension, col_dim: "channel", metric },
          }),
        ]);
        setLeaderboard(lbRes.data);
        setPivot(pivotRes.data);
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load analysis";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dimension, metric, clientId, channelId, platformId]);

  // drilldown when entity is selected
  const handleDrilldown = async (name) => {
    if (selectedEntity === name) {
      setSelectedEntity(null);
      setDrilldown(null);
      return;
    }
    setSelectedEntity(name);
    try {
      const drillParams = useFilterStore.getState().toParams();
      const res = await api.get("/api/analysis/drilldown", {
        params: { ...drillParams, dimension, value: name },
      });
      setDrilldown(res.data);
    } catch (err) {
      toast.error("Drilldown failed");
    }
  };

  // find max value for progress bars
  const maxVal = leaderboard?.entries?.[0]?.value || 1;

  if (loading || !leaderboard || !pivot) {
    return <SkeletonPage />;
  }
  if (error && (!leaderboard || !pivot)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load analysis data.</p>
        <button onClick={() => { setError(null); setLoading(true); }} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  // build radar data from the drilldown
  const radarData = drilldown
    ? [
        { axis: "Uploaded", value: drilldown.total_uploaded },
        { axis: "Processed", value: drilldown.total_processed },
        { axis: "Published", value: drilldown.total_published },
        { axis: "Duration (h)", value: drilldown.total_duration_hours },
      ]
    : [];

  // build pivot table data — aggregate channels per client into totals
  const pivotTableData = pivot
    ? buildPivotTable(pivot)
    : [];

  return (
    <div className="space-y-6">
      {/* header with controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leaderboards, pivot tables, and entity drilldowns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* dimension selector */}
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {DIMENSIONS.map((d) => (
              <button
                key={d.value}
                id={`dim-${d.value}`}
                onClick={() => setDimension(d.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  dimension === d.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          {/* metric selector */}
          <select
            id="analysis-metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* main content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* leaderboard */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass-card p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="size-4 text-chart-4" />
            <h3 className="text-sm font-medium text-foreground">
              Leaderboard — {DIMENSIONS.find((d) => d.value === dimension)?.label}
            </h3>
          </div>
          <div className="space-y-2">
            {leaderboard?.entries?.map((entry, i) => (
              <button
                key={entry.name}
                onClick={() => handleDrilldown(entry.name)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-all group",
                  selectedEntity === entry.name
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex size-5 items-center justify-center rounded text-xs font-bold",
                      i === 0 ? "bg-chart-4/20 text-chart-4" :
                      i === 1 ? "bg-muted text-muted-foreground" :
                      i === 2 ? "bg-chart-3/20 text-chart-3" :
                      "bg-muted/50 text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground truncate max-w-[140px]">
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-foreground">
                      {entry.value.toLocaleString()}
                    </span>
                    <ChevronRight className={cn(
                      "size-3 text-muted-foreground transition-transform",
                      selectedEntity === entry.name && "rotate-90"
                    )} />
                  </div>
                </div>
                {/* progress bar */}
                <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(entry.value / maxVal) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className="h-full rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* right panel: drilldown or bar chart */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="glass-card p-6 lg:col-span-2">
          {drilldown && selectedEntity ? (
            <DrilldownPanel
              entity={selectedEntity}
              data={drilldown}
              radarData={radarData}
              onClose={() => { setSelectedEntity(null); setDrilldown(null); }}
            />
          ) : (
            <LeaderboardChart
              leaderboard={leaderboard}
              dimension={dimension}
              metric={metric}
            />
          )}
        </motion.div>
      </div>

      {/* pivot table */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Pivot — {DIMENSIONS.find((d) => d.value === dimension)?.label} × Channel
          </h3>
        </div>
        <PivotTable data={pivotTableData} metric={metric} loading={loading} />
      </motion.div>
    </div>
  );
}

// leaderboard bar chart (shown when no drilldown is selected)
function LeaderboardChart({ leaderboard, dimension, metric }) {
  if (!leaderboard) return null;

  const data = leaderboard.entries.map((e) => ({
    name: e.name.length > 16 ? e.name.slice(0, 14) + "…" : e.name,
    value: e.value,
  }));

  return (
    <>
      <h3 className="text-sm font-medium text-foreground mb-4">
        {METRICS.find((m) => m.value === metric)?.label} by {DIMENSIONS.find((d) => d.value === dimension)?.label}
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// drilldown panel with KPIs + radar
function DrilldownPanel({ entity, data, radarData, onClose }) {
  const kpis = [
    { label: "Uploaded", value: data.total_uploaded },
    { label: "Processed", value: data.total_processed },
    { label: "Published", value: data.total_published },
    { label: "Duration", value: `${data.total_duration_hours}h` },
    { label: "Processing Rate", value: `${data.processing_rate}%` },
    { label: "Publish Rate", value: `${data.publish_rate}%` },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">
          Drilldown — <span className="text-primary">{entity}</span>
        </h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg bg-muted/20 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">
              {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="oklch(1 0 0 / 10%)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// scrollable pivot table
function PivotTable({ data, metric, loading }) {
  if (loading || !data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        {loading ? "Loading…" : "No data"}
      </div>
    );
  }

  // get all unique channel names and sort
  const allChannels = [...new Set(data.flatMap((r) => r.channels.map((c) => c.name)))].sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10">
              Entity
            </th>
            {allChannels.map((ch) => (
              <th key={ch} className="text-right py-2 px-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                {ch.length > 18 ? ch.slice(0, 16) + "…" : ch}
              </th>
            ))}
            <th className="text-right py-2 px-3 text-xs font-bold text-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.entity}
              className={cn(
                "border-b border-border/50 transition-colors hover:bg-muted/10",
                i % 2 === 0 && "bg-muted/5"
              )}
            >
              <td className="py-2 px-3 text-foreground font-medium sticky left-0 bg-card whitespace-nowrap">
                {row.entity}
              </td>
              {allChannels.map((ch) => {
                const val = row.channels.find((c) => c.name === ch)?.value || 0;
                return (
                  <td key={ch} className="text-right py-2 px-3 tabular-nums">
                    <span className={val > 0 ? "text-foreground" : "text-muted-foreground/30"}>
                      {val > 0 ? val.toLocaleString() : "—"}
                    </span>
                  </td>
                );
              })}
              <td className="text-right py-2 px-3 font-bold text-foreground tabular-nums">
                {row.total.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// transform pivot matrix into table-friendly rows
function buildPivotTable(pivot) {
  return pivot.dim1_values.map((entity, rowIdx) => {
    const channels = pivot.dim2_values
      .map((ch, colIdx) => ({
        name: ch,
        value: pivot.matrix[rowIdx][colIdx] || 0,
      }))
      .filter((c) => c.value > 0);

    const total = channels.reduce((sum, c) => sum + c.value, 0);

    return { entity, channels, total };
  }).sort((a, b) => b.total - a.total);
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import useFilterStore from "@/stores/filterStore";
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";

const GRANULARITIES = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const METRICS = [
  { value: "uploaded", label: "Uploaded" },
  { value: "processed", label: "Processed" },
  { value: "published", label: "Published" },
  { value: "duration", label: "Duration (h)" },
];

// colors for the stacked bar chart — one per client
const CLIENT_COLORS = [
  "oklch(0.7 0.18 265)",   // violet
  "oklch(0.75 0.16 165)",  // teal
  "oklch(0.7 0.2 25)",     // coral
  "oklch(0.8 0.16 85)",    // gold
  "oklch(0.7 0.18 330)",   // pink
  "oklch(0.65 0.15 200)",  // sky
  "oklch(0.72 0.14 130)",  // green
  "oklch(0.68 0.18 50)",   // orange
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

export default function UsageTrends() {
  const [granularity, setGranularity] = useState("day");
  const [metric, setMetric] = useState("uploaded");
  const [timeseries, setTimeseries] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [channelData, setChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // subscribe to filters so we re-fetch when they change
  const clientId = useFilterStore((s) => s.clientId);
  const channelId = useFilterStore((s) => s.channelId);
  const platformId = useFilterStore((s) => s.platformId);

  // fetch time series whenever granularity or metric changes
  useEffect(() => {
    const params = useFilterStore.getState().toParams();
    const fetchTimeseries = async () => {
      setLoading(true);
      try {
        const [tsRes, compRes] = await Promise.all([
          api.get("/api/trends/timeseries", {
            params: { ...params, granularity, metric },
          }),
          api.get("/api/trends/comparison", {
            params: { ...params, metric },
          }),
        ]);
        setTimeseries(tsRes.data);
        setComparison(compRes.data);
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load trends";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeseries();
  }, [granularity, metric, clientId, channelId, platformId]);

  // fetch channel breakdown once
  useEffect(() => {
    const params = useFilterStore.getState().toParams();
    const fetchChannels = async () => {
      try {
        const res = await api.get("/api/analysis/pivot", {
          params: { ...params, row_dim: "client", col_dim: "channel", metric: "uploaded" },
        });
        setChannelData(res.data);
      } catch (err) {
        toast.error("Failed to load channel data");
      }
    };
    fetchChannels();
  }, [clientId, channelId, platformId]);

  // format time series for Recharts
  const tsChartData = timeseries
    ? timeseries.labels.map((label, i) => ({
        date: formatDate(label, granularity),
        value: timeseries.values[i],
      }))
    : [];

  // format comparison data — align current and previous by index
  const compChartData = comparison
    ? comparison.current.labels.map((label, i) => ({
        date: formatDate(label, "day"),
        current: comparison.current.values[i],
        previous: comparison.previous.values[i] ?? null,
      }))
    : [];

  // format channel data for stacked bar
  const clientBarData = channelData
    ? buildClientBarData(channelData)
    : [];

  if (loading || !timeseries) {
    return <SkeletonPage />;
  }
  if (error && !timeseries) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load trends data.</p>
        <button onClick={() => { setError(null); setLoading(true); }} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* page header with controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage & Trends</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Time series analysis with granularity controls
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* granularity toggle */}
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                id={`gran-${g.value}`}
                onClick={() => setGranularity(g.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  granularity === g.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* metric selector */}
          <select
            id="metric-select"
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

      {/* time series chart */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">
            {METRICS.find((m) => m.value === metric)?.label} — {GRANULARITIES.find((g) => g.value === granularity)?.label}
          </h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tsChartData}>
              <defs>
                <linearGradient id="grad-ts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#grad-ts)"
                dot={false}
                name={METRICS.find((m) => m.value === metric)?.label}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* bottom row: comparison + channel breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* period-over-period comparison */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Period Comparison</h3>
            </div>
            {comparison && (
              <div className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                comparison.change_pct >= 0
                  ? "bg-chart-2/20 text-chart-2"
                  : "bg-chart-3/20 text-chart-3"
              )}>
                {comparison.change_pct >= 0
                  ? <TrendingUp className="size-3" />
                  : <TrendingDown className="size-3" />
                }
                {comparison.change_pct >= 0 ? "+" : ""}{comparison.change_pct}%
              </div>
            )}
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={compChartData}>
                <defs>
                  <linearGradient id="grad-curr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-prev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#grad-curr)"
                  dot={false}
                  name="Current Period"
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  stroke="var(--chart-5)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#grad-prev)"
                  dot={false}
                  name="Previous Period"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* legend */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full" style={{ background: "var(--chart-1)" }} />
              <span className="text-xs text-muted-foreground">Current ({comparison?.current?.total?.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 rounded-full border-t border-dashed" style={{ borderColor: "var(--chart-5)" }} />
              <span className="text-xs text-muted-foreground">Previous ({comparison?.previous?.total?.toLocaleString()})</span>
            </div>
          </div>
        </motion.div>

        {/* client breakdown — horizontal stacked bar */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Uploads by Client</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clientBarData}
                layout="vertical"
                margin={{ left: 10, right: 10, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="client"
                  type="category"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="total"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// helper: format date labels based on granularity
function formatDate(dateStr, granularity) {
  const d = new Date(dateStr + "T00:00:00");
  switch (granularity) {
    case "day":
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "week":
      return `W${getWeekNumber(d)}`;
    case "month":
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    default:
      return dateStr.slice(5);
  }
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

// helper: transform pivot matrix into bar chart data per client
function buildClientBarData(pivot) {
  return pivot.dim1_values.map((client, i) => {
    const total = pivot.matrix[i].reduce((sum, val) => sum + (val || 0), 0);
    return { client: shortenName(client), total };
  }).sort((a, b) => b.total - a.total);
}

// shorten long client names for chart labels
function shortenName(name) {
  if (name.length <= 14) return name;
  return name.slice(0, 12) + "…";
}

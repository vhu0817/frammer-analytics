import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis,
} from "recharts";
import {
  Upload, Cog, Send, Clock,
  TrendingUp, TrendingDown, AlertTriangle, Minus,
} from "lucide-react";
import api from "@/lib/api";
import useFilterStore from "@/stores/filterStore";
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";

// our chart color palette from the CSS tokens — mapped to oklch values
const CHART_COLORS = [
  "oklch(0.7 0.18 265)",   // violet
  "oklch(0.75 0.16 165)",  // teal
  "oklch(0.7 0.2 25)",     // coral
  "oklch(0.8 0.16 85)",    // gold
  "oklch(0.7 0.18 330)",   // pink
  "oklch(0.65 0.15 200)",  // sky
];

// reusable animation wrapper
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function ExecutiveSummary() {
  const [kpis, setKpis] = useState(null);
  const [sparklines, setSparklines] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [typeMix, setTypeMix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // subscribe to filters so we re-fetch when they change
  const clientId = useFilterStore((s) => s.clientId);
  const channelId = useFilterStore((s) => s.channelId);
  const platformId = useFilterStore((s) => s.platformId);

  useEffect(() => {
    const params = useFilterStore.getState().toParams();
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [kpiRes, sparkRes, alertRes, typeRes] = await Promise.all([
          api.get("/api/executive/kpis", { params }),
          api.get("/api/executive/sparklines", { params }),
          api.get("/api/executive/alerts", { params }),
          api.get("/api/funnel/type-mix", { params }),
        ]);
        setKpis(kpiRes.data);
        setSparklines(sparkRes.data);
        setAlerts(alertRes.data);
        setTypeMix(typeRes.data);
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load dashboard data";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [clientId, channelId, platformId]);

  if (loading || !kpis) return <SkeletonPage />;
  if (error && !kpis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load dashboard data.</p>
        <button onClick={() => { setError(null); setLoading(true); }} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  // transform sparkline data into the format Recharts wants
  const sparkData = sparklines.days.map((day, i) => ({
    date: day.slice(5), // "06-01" format for compact display
    uploaded: sparklines.uploaded[i],
    processed: sparklines.processed[i],
    published: sparklines.published[i],
    duration: sparklines.duration_hours[i],
  }));

  // KPI card definitions
  const kpiCards = [
    {
      label: "Videos Uploaded",
      value: kpis.total_uploaded.toLocaleString(),
      icon: Upload,
      sparkKey: "uploaded",
      color: "var(--chart-1)",
    },
    {
      label: "Processing Rate",
      value: `${kpis.processing_rate}%`,
      icon: Cog,
      sparkKey: "processed",
      color: "var(--chart-2)",
    },
    {
      label: "Publish Rate",
      value: `${kpis.publish_rate}%`,
      icon: Send,
      sparkKey: "published",
      color: "var(--chart-3)",
    },
    {
      label: "Total Duration",
      value: `${kpis.total_duration_hours.toLocaleString()}h`,
      icon: Clock,
      sparkKey: "duration",
      color: "var(--chart-4)",
    },
  ];

  // donut chart data (top 6 output types, rest grouped as "Other")
  const outputTypes = typeMix?.output_types || [];
  const donutData = outputTypes.slice(0, 6).map((t) => ({
    name: t.type,
    value: t.count,
    pct: t.pct,
  }));
  if (outputTypes.length > 6) {
    const otherCount = outputTypes.slice(6).reduce((s, t) => s + t.count, 0);
    const otherPct = outputTypes.slice(6).reduce((s, t) => s + t.pct, 0);
    donutData.push({ name: "Other", value: otherCount, pct: Math.round(otherPct * 10) / 10 });
  }

  return (
    <div className="space-y-6">
      {/* page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executive Summary</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of video processing pipeline performance
        </p>
      </div>

      {/* KPI cards with mini sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            {...fadeUp}
            transition={{ delay: i * 0.08 }}
            className="glass-card-hover p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.label}
              </p>
              <kpi.icon className="size-4 text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>

            {/* mini sparkline */}
            <div className="mt-3 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`grad-${kpi.sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={kpi.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey={kpi.sparkKey}
                    stroke={kpi.color}
                    strokeWidth={1.5}
                    fill={`url(#grad-${kpi.sparkKey})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* bottom row: sparkline detail chart + donut chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 30-day trend chart — wider */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="glass-card p-6 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-4">30-Day Upload Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id="grad-trend-up" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-trend-pub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.005 285)",
                    border: "1px solid oklch(1 0 0 / 10%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "oklch(0.95 0 0)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="uploaded"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#grad-trend-up)"
                  dot={false}
                  name="Uploaded"
                />
                <Area
                  type="monotone"
                  dataKey="published"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#grad-trend-pub)"
                  dot={false}
                  name="Published"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* legend */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
              <span className="text-xs text-muted-foreground">Uploaded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
              <span className="text-xs text-muted-foreground">Published</span>
            </div>
          </div>
        </motion.div>

        {/* donut chart */}
        <motion.div {...fadeUp} transition={{ delay: 0.45 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Output Type Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  activeShape={false}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.005 285)",
                    border: "1px solid oklch(1 0 0 / 10%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "oklch(0.95 0 0)",
                    boxShadow: "0 8px 32px oklch(0 0 0 / 40%)",
                  }}
                  wrapperStyle={{ outline: "none" }}
                  itemStyle={{ color: "oklch(0.85 0 0)" }}
                  cursor={false}
                  formatter={(value, name) => [`${value.toLocaleString()} (${donutData.find(d => d.name === name)?.pct}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* legend */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                <span className="text-xs text-foreground/70 ml-auto">{d.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* anomaly alerts */}
      {alerts && alerts.alerts.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.55 }}>
          <h3 className="text-sm font-medium text-foreground mb-3">Anomaly Alerts</h3>
          <div className="space-y-2">
            {alerts.alerts.map((alert, i) => (
              <div key={i} className="glass-card flex items-center gap-3 px-4 py-3">
                <AlertTriangle className="size-4 text-chart-3 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{alert.date}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.count} uploads · z-score: {alert.z_score.toFixed(1)}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                  alert.type === "spike"
                    ? "bg-chart-3/20 text-chart-3"
                    : "bg-chart-1/20 text-chart-1"
                }`}>
                  {alert.type === "spike" ? "Spike" : "Drop"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* stats footer when no alerts */}
      {alerts && alerts.alerts.length === 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.55 }} className="glass-card flex items-center gap-3 px-4 py-3">
          <Minus className="size-4 text-chart-2 shrink-0" />
          <p className="text-sm text-muted-foreground">
            No anomalies detected — daily uploads averaging {alerts.stats.mean_daily_uploads} (σ = {alerts.stats.std_dev}) over {alerts.stats.days_analyzed} days
          </p>
        </motion.div>
      )}
    </div>
  );
}

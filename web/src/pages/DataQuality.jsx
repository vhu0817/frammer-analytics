import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Database, Copy, Link2Off, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const tooltipStyle = {
  background: "oklch(0.18 0.005 285)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "oklch(0.95 0 0)",
};

// quality score color based on value
function getScoreColor(score) {
  if (score >= 90) return "var(--chart-2)";  // teal/green
  if (score >= 70) return "var(--chart-4)";  // gold
  return "var(--chart-3)";                   // coral/red
}

function getScoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

export default function DataQuality() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/data-quality/report");
        setReport(res.data);
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load data quality report";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading || !report) return <SkeletonPage />;
  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load data quality report.</p>
        <button onClick={() => { setError(null); setLoading(true); }} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  const scoreColor = getScoreColor(report.quality_score);
  const scoreLabel = getScoreLabel(report.quality_score);

  // completeness chart data
  const completenessData = (report.completeness || []).map((f) => ({
    field: f.field,
    pct: f.pct,
    complete: f.complete,
    total: f.total,
  }));

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitoring data completeness, consistency, and integrity across {report.total_records.toLocaleString()} records
        </p>
      </div>

      {/* score + summary row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* quality score card */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="glass-card p-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg width="100" height="100" viewBox="0 0 100 100">
              {/* background circle */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="8" />
              {/* score arc */}
              <circle
                cx="50" cy="50" r="42"
                fill="none" stroke={scoreColor} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${report.quality_score * 2.64} 264`}
                transform="rotate(-90 50 50)"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>
                {report.quality_score}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{scoreLabel}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Quality Score</p>
        </motion.div>

        {/* total records */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Database className="size-4 text-chart-1" />
            <span className="text-xs text-muted-foreground">Total Records</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{report.total_records.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">fact_videos rows</p>
        </motion.div>

        {/* missing values summary */}
        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-chart-3" />
            <span className="text-xs text-muted-foreground">Missing Values</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {report.missing_values.reduce((sum, m) => sum + m.total, 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            across {report.missing_values.filter(m => m.total > 0).length} fields
          </p>
        </motion.div>

        {/* orphaned FKs */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            {report.orphaned_fks.reduce((s, o) => s + o.orphaned_count, 0) === 0
              ? <CheckCircle2 className="size-4 text-chart-2" />
              : <Link2Off className="size-4 text-chart-3" />
            }
            <span className="text-xs text-muted-foreground">Orphaned FKs</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {report.orphaned_fks.reduce((s, o) => s + o.orphaned_count, 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {report.orphaned_fks.reduce((s, o) => s + o.orphaned_count, 0) === 0
              ? "All foreign keys valid"
              : "Broken references found"
            }
          </p>
        </motion.div>
      </div>

      {/* completeness chart + missing values table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* field completeness bar chart */}
        <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Field Completeness</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completenessData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  dataKey="field"
                  type="category"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name, props) => [
                    `${val}% (${props.payload.complete.toLocaleString()}/${props.payload.total.toLocaleString()})`,
                    "Complete"
                  ]}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={14}>
                  {completenessData.map((entry, i) => (
                    <Cell
                      key={entry.field}
                      fill={entry.pct >= 95 ? "var(--chart-2)" : entry.pct >= 80 ? "var(--chart-4)" : "var(--chart-3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* missing values breakdown */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Missing Values by Field</h3>
          <div className="space-y-3">
            {report.missing_values.map((m) => (
              <div key={m.field} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground font-medium font-mono">{m.field}</span>
                  <span className={cn(
                    "text-xs font-medium",
                    m.total === 0 ? "text-chart-2" : m.pct > 10 ? "text-chart-3" : "text-chart-4"
                  )}>
                    {m.total === 0 ? "✓ Complete" : `${m.total.toLocaleString()} missing (${m.pct}%)`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${100 - m.pct}%`,
                      background: m.total === 0 ? "var(--chart-2)" : m.pct > 10 ? "var(--chart-3)" : "var(--chart-4)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* unknown buckets + duplicate titles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* unknown bucket tracking */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CircleDot className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">"Unknown" Bucket Tracking</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Videos linked to placeholder dimension values (e.g., "Unknown", "Test")
          </p>
          <div className="space-y-3">
            {report.unknown_buckets.map((u) => (
              <div key={u.dimension} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground capitalize">{u.dimension}</span>
                <div className="flex items-center gap-2">
                  {u.count === 0 ? (
                    <span className="flex items-center gap-1 text-xs text-chart-2">
                      <CheckCircle2 className="size-3" /> Clean
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-chart-3">
                      <ShieldAlert className="size-3" /> {u.count.toLocaleString()} ({u.pct}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* duplicate titles */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Copy className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Duplicate Titles</h3>
          </div>
          {report.duplicates.duplicate_titles === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <CheckCircle2 className="size-8 text-chart-2" />
              <p className="text-sm text-muted-foreground">No duplicate titles detected</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {report.duplicates.duplicate_titles} titles appear more than once
              </p>
              <div className="space-y-2">
                {report.duplicates.sample.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs text-foreground truncate max-w-[200px]">{d.title}</span>
                    <span className="text-xs text-chart-3 font-medium">×{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* orphaned FK details */}
      <motion.div {...fadeUp} transition={{ delay: 0.45 }} className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2Off className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Foreign Key Integrity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Dimension</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Orphaned Rows</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.orphaned_fks.map((o) => (
                <tr key={o.dimension} className="border-b border-border/50">
                  <td className="py-2 px-3 text-foreground capitalize">{o.dimension}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{o.orphaned_count}</td>
                  <td className="text-right py-2 px-3">
                    {o.orphaned_count === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-chart-2">
                        <ShieldCheck className="size-3" /> Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-chart-3">
                        <ShieldAlert className="size-3" /> Broken
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

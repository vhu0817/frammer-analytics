import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Funnel, ArrowDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import useFilterStore from "@/stores/filterStore";
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";

const CHART_COLORS = [
  "oklch(0.7 0.18 265)",
  "oklch(0.75 0.16 165)",
  "oklch(0.7 0.2 25)",
  "oklch(0.8 0.16 85)",
  "oklch(0.7 0.18 330)",
  "oklch(0.65 0.15 200)",
  "oklch(0.72 0.14 130)",
  "oklch(0.68 0.18 50)",
  "oklch(0.6 0.12 240)",
  "oklch(0.78 0.14 110)",
  "oklch(0.65 0.2 350)",
  "oklch(0.73 0.12 180)",
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

// colors for each funnel stage
const STAGE_COLORS = {
  Uploaded: "var(--chart-1)",
  Processed: "var(--chart-2)",
  Published: "var(--chart-4)",
};

export default function PublishingFunnel() {
  const [stages, setStages] = useState(null);
  const [conversion, setConversion] = useState(null);
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
        const [stgRes, convRes, typeRes] = await Promise.all([
          api.get("/api/funnel/stages", { params }),
          api.get("/api/funnel/conversion", { params }),
          api.get("/api/funnel/type-mix", { params }),
        ]);
        setStages(stgRes.data);
        setConversion(convRes.data);
        setTypeMix(typeRes.data);
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load funnel data";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [clientId, channelId, platformId]);

  if (loading || !stages) {
    return <SkeletonPage />;
  }
  if (error && !stages) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load funnel data.</p>
        <button onClick={() => { setError(null); setLoading(true); }} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Publishing Funnel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload → Process → Publish conversion pipeline
        </p>
      </div>

      {/* funnel visualization */}
      <FunnelStages stages={stages.stages} />

      {/* bottom row: conversion table + type mix charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* conversion breakdown by client */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Conversion by Client</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={conversion.entries.map((e) => ({
                  name: e.name.length > 14 ? e.name.slice(0, 12) + "…" : e.name,
                  "Processing %": e.processing_rate,
                  "Publish %": e.publish_rate,
                }))}
                margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
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
                  width={40}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => `${v}%`}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", color: "var(--muted-foreground)" }}
                />
                <Bar dataKey="Processing %" fill="var(--chart-2)" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="Publish %" fill="var(--chart-4)" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* input type distribution */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Input Type Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeMix.input_types.map((t) => ({
                    name: t.type,
                    value: t.count,
                    pct: t.pct,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {typeMix.input_types.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    `${value.toLocaleString()} (${typeMix.input_types.find((t) => t.type === name)?.pct}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* legend grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            {typeMix.input_types.map((t, i) => (
              <div key={t.type} className="flex items-center gap-1.5">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground truncate">{t.type}</span>
                <span className="text-xs text-foreground/70 ml-auto">{t.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* output type breakdown — horizontal bars */}
      <motion.div {...fadeUp} transition={{ delay: 0.5 }} className="glass-card p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Output Type Breakdown</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={typeMix.output_types.map((t) => ({
                type: t.type,
                count: t.count,
                pct: t.pct,
              }))}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="type"
                type="category"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name, props) => [
                  `${v.toLocaleString()} (${props.payload.pct}%)`,
                  "Count",
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {typeMix.output_types.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

// the main funnel visualization with animated bars
function FunnelStages({ stages }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stages.map((stage, i) => {
        const widthPct = stage.rate;
        const color = STAGE_COLORS[stage.name] || "var(--chart-1)";
        const isLast = i === stages.length - 1;

        return (
          <motion.div
            key={stage.name}
            {...fadeUp}
            transition={{ delay: i * 0.1 }}
          >
            {/* stage card */}
            <div className="glass-card-hover p-5 relative overflow-hidden">
              {/* background progress fill */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
                  width: `${widthPct}%`,
                }}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stage.name}
                  </p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-md"
                    style={{
                      background: `color-mix(in oklch, ${color} 20%, transparent)`,
                      color: color,
                    }}
                  >
                    {stage.rate}%
                  </span>
                </div>

                <p className="text-3xl font-bold text-foreground">
                  {stage.count.toLocaleString()}
                </p>

                {/* drop-off indicator */}
                {stage.drop_off != null && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowDown className="size-3 text-chart-3" />
                    <span>
                      {stage.drop_off.toLocaleString()} dropped ({stage.drop_off_pct}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* connector arrow between stages */}
            {!isLast && (
              <div className="flex justify-center my-1 sm:hidden">
                <ChevronDown className="size-4 text-muted-foreground/50" />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

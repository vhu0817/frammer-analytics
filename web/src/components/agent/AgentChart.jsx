/**
 * AgentChart — Dynamically renders a Recharts chart from the agent's
 * build_chart tool config. Maps chart_type to the correct Recharts
 * component (BarChart, LineChart, AreaChart, PieChart).
 *
 * This is the bridge between the LLM's JSON output and a visual chart.
 */

import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

/** dark-themed tooltip that matches the dashboard aesthetic */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AgentChart({ config }) {
  if (!config || !config.data?.length) return null;

  const { chart_type, title, data, x_key, y_keys = [], colors = FALLBACK_COLORS } = config;

  const chartColors = colors.length >= y_keys.length
    ? colors
    : [...colors, ...FALLBACK_COLORS].slice(0, y_keys.length);

  return (
    <div className="mt-3 glass-card p-4" id="agent-chart">
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground mb-3">{title}</h4>
      )}

      <ResponsiveContainer width="100%" height={240}>
        {renderChart(chart_type, data, x_key, y_keys, chartColors)}
      </ResponsiveContainer>
    </div>
  );
}

function renderChart(type, data, xKey, yKeys, colors) {
  const axisStyle = { fontSize: 10, fill: "oklch(0.65 0 0)" };
  const gridStyle = { strokeDasharray: "3 3", stroke: "oklch(1 0 0 / 8%)" };

  switch (type) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );

    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={colors[i]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      );

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {yKeys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={colors[i]} fill={colors[i]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      );

    case "pie":
    case "donut":
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={yKeys[0] || "value"}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            innerRadius={type === "donut" ? 50 : 0}
            outerRadius={90}
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            style={{ fontSize: 10 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      );

    case "radar":
      return (
        <RadarChart cx="50%" cy="50%" outerRadius={80} data={data}>
          <PolarGrid stroke="oklch(1 0 0 / 10%)" />
          <PolarAngleAxis dataKey={xKey} tick={axisStyle} />
          <PolarRadiusAxis tick={axisStyle} />
          {yKeys.map((key, i) => (
            <Radar key={key} dataKey={key} stroke={colors[i]} fill={colors[i]} fillOpacity={0.2} />
          ))}
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      );

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}

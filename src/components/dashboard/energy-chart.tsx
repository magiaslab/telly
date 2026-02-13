"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = { time: string; soc: number; full: string };

export function EnergyChart({ data }: { data: { timestamp: Date | null; soc: number }[] }) {
  const chartData: Point[] = data.map((d) => ({
    time: d.timestamp
      ? new Date(d.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
      : "",
    soc: d.soc,
    full: `${d.soc}%`,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
        Nessun dato telemetria. Esegui un sync.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number | undefined) => [value != null ? `${value}%` : "—", "SoC"]}
          labelFormatter={(label) => `Ora: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="soc"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#socGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type SeriesItem = {
  period: string;
  spentEur: number;
  dieselEur: number;
  savedEur: number;
  km?: number;
};

export function SavingsBarChart({ series }: { series: SeriesItem[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
        Nessun dato: servono sync Tesla (km) e sessioni wallbox (costi).
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v) => `${v} €`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          labelFormatter={(label) => `Periodo: ${label}`}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              spentEur: "Ricarica casa",
              dieselEur: "Equiv. Diesel",
              savedEur: "Risparmio",
            };
            const key = name ?? "";
            return [value != null ? `${Number(value).toFixed(2)} €` : "—", labels[key] ?? key];
          }}
        />
        <Legend />
        <Bar dataKey="spentEur" name="Ricarica casa" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="dieselEur" name="Equiv. Diesel" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="savedEur" name="Risparmio" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

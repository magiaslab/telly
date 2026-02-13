"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type SeriesItem = {
  period: string;
  spentEur: number;
  dieselEur: number;
  savedEur: number;
};

export function SavingsBarChart({ series }: { series: SeriesItem[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
        Nessun dato (viaggi/ricariche) per il grafico.
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
          formatter={(value: number | undefined) => [value != null ? `${value.toFixed(2)} €` : "—", ""]}
          labelFormatter={(label) => `Periodo: ${label}`}
        />
        <Legend />
        <Bar dataKey="spentEur" name="Speso (Octopus)" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="dieselEur" name="Equiv. Diesel (1,75 €/L)" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="savedEur" name="Risparmio" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

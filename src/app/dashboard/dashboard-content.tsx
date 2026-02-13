import { getLatestTelemetry, getTelemetriesForChart, getChargingCostThisMonth, getSavingsForBarChart } from "./data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatteryIcon } from "@/components/dashboard/battery-icon";
import { EnergyChart } from "@/components/dashboard/energy-chart";
import { SavingsBarChart } from "@/components/dashboard/savings-barchart";
import { SyncButton } from "@/components/dashboard/sync-button";
import { Gauge, MapPin, Zap } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { VehicleMap } from "@/components/dashboard/vehicle-map";

const DIESEL_EUR_PER_L = 1.75;
const DIESEL_KM_PER_L = 15;
const OCTOPUS_EUR_PER_KWH = 0.15;
/** km per kWh stimato Model Y (es. 6.5 km/kWh) */
const KM_PER_KWH = 6.5;

export async function DashboardContent() {
  const [latest, chartData, cost, savingsChart] = await Promise.all([
    getLatestTelemetry(),
    getTelemetriesForChart(7),
    getChargingCostThisMonth(),
    getSavingsForBarChart(4),
  ]);

  // Speso questo mese (da charging_events)
  const spentThisMonth = cost.totalEur;
  const kwhThisMonth = cost.totalKwh;
  // Equivalente Diesel: stessi km con benzina (km = kwh * km/kWh)
  const kmEquivalent = kwhThisMonth * KM_PER_KWH;
  const dieselLiters = kmEquivalent / DIESEL_KM_PER_L;
  const dieselCostEur = dieselLiters * DIESEL_EUR_PER_L;
  const savedVsDiesel = dieselCostEur - spentThisMonth;

  const hasNoData = !latest && chartData.length === 0 && cost.events.length === 0;

  return (
    <div className="space-y-8">
      {hasNoData && (
        <div className="bg-muted/50 border-border rounded-lg border px-4 py-3 text-sm">
          <strong>Nessun dato in database.</strong> Crea le tabelle e carica i dati mock:{" "}
          <code className="bg-muted rounded px-1.5 py-0.5">npm run db:push</code>
          {" e "}
          <code className="bg-muted rounded px-1.5 py-0.5">npm run seed</code>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pulse</h1>
          <p className="text-muted-foreground">Model Y LR RWD · Telemetria</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton />
          <DashboardHeader />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Batteria</CardTitle>
            <Zap className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <BatteryIcon level={latest?.soc ?? 0} />
            {latest?.isCharging && (
              <Badge variant="secondary" className="mt-2">
                In carica
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contachilometri</CardTitle>
            <Gauge className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {latest?.odometer != null ? latest.odometer.toFixed(1) : "—"} km
            </p>
            <p className="text-muted-foreground text-xs">
              Autonomia stimata: {latest?.range != null ? latest.range.toFixed(0) : "—"} km
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posizione</CardTitle>
            <MapPin className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {latest?.lat != null && latest?.lon != null ? (
              <p className="text-muted-foreground font-mono text-xs">
                {latest.lat.toFixed(5)}, {latest.lon.toFixed(5)}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {latest?.lat != null && latest?.lon != null && (
        <VehicleMap lat={latest.lat} lon={latest.lon} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>SoC nel tempo</CardTitle>
          <CardDescription>Stato di carica (ultimi 7 giorni)</CardDescription>
        </CardHeader>
        <CardContent>
          <EnergyChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Octopus · Costi</CardTitle>
          <CardDescription>
            Speso questo mese vs equivalente Diesel (1,75 €/L, 15 km/L — Kia 1.4 Diesel)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-muted-foreground text-sm">Speso questo mese (ricariche)</p>
              <p className="text-2xl font-bold tabular-nums">
                {cost.totalEur.toFixed(2)} €
              </p>
              <p className="text-muted-foreground text-xs">{cost.totalKwh.toFixed(1)} kWh</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Risparmio vs Diesel (stesso km)</p>
              <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {savedVsDiesel > 0 ? `${savedVsDiesel.toFixed(2)} €` : "0,00 €"}
              </p>
              <p className="text-muted-foreground text-xs">
                Equiv. Diesel: {dieselCostEur.toFixed(2)} € ({kmEquivalent.toFixed(0)} km)
              </p>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-sm">Risparmio per settimana (ultime 4)</p>
            <SavingsBarChart series={savingsChart.series} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

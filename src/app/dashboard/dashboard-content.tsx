import {
  getLatestTelemetry,
  getTelemetriesForChart,
  getChargingCostThisMonth,
  getSavingsForBarChart,
  getTeslaAccountAndVehicles,
} from "./data";
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
import { Car, Gauge, MapPin, Package, User, Zap } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { VehicleMap } from "@/components/dashboard/vehicle-map";
import { VehicleConfiguratorCarousel } from "@/components/dashboard/vehicle-configurator-carousel";

const DIESEL_EUR_PER_L = 1.75;
const DIESEL_KM_PER_L = 15;
const OCTOPUS_EUR_PER_KWH = 0.15;
/** km per kWh stimato Model Y (es. 6.5 km/kWh) */
const KM_PER_KWH = 6.5;

const TESLA_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Autorizzazione Tesla annullata.",
  invalid_state: "Sessione scaduta. Riprova a collegare l’account.",
  missing_code_or_state: "Callback Tesla senza code o state.",
  token_exchange_failed: "Impossibile ottenere il token da Tesla. Riprova.",
  no_refresh_token: "Tesla non ha restituito il refresh token.",
  server_config: "Configurazione server mancante (TESLA_CLIENT_ID/SECRET/REDIRECT_URI).",
};

type DashboardContentProps = { teslaError?: string };

/** Card quando i dati Tesla non sono disponibili: token da env o da collegare dall’app. */
function TeslaReconnectCard({ teslaError }: { teslaError?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati Tesla non disponibili</CardTitle>
        <CardDescription>
          Per profilo, veicoli e ordini Tesla imposta <code className="rounded bg-muted px-1">TESLA_REFRESH_TOKEN</code> nelle variabili d’ambiente, oppure collegherai l’account Tesla dall’app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teslaError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {TESLA_ERROR_MESSAGES[teslaError] ?? `Errore: ${teslaError}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function DashboardContent({ teslaError }: DashboardContentProps) {
  const [latest, chartData, cost, savingsChart, teslaAccount] = await Promise.all([
    getLatestTelemetry(),
    getTelemetriesForChart(7),
    getChargingCostThisMonth(),
    getSavingsForBarChart(4),
    getTeslaAccountAndVehicles(),
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
          <h1 className="text-3xl font-bold tracking-tight">Telly</h1>
          <p className="text-muted-foreground">Model Y LR RWD · Telemetria</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton />
          <DashboardHeader />
        </div>
      </div>

      {teslaAccount ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Tesla</CardTitle>
              <User className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800">
                  Account collegato
                </Badge>
                <Badge variant="outline">
                  Regione: {teslaAccount.region}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Accesso effettuato con il tuo account Tesla. Dati da Fleet API.
              </p>
              <div className="space-y-1 border-t border-border pt-2">
                <p className="font-medium">
                  {teslaAccount.user.full_name || "—"}
                </p>
                {teslaAccount.user.email && (
                  <p className="text-muted-foreground text-sm">{teslaAccount.user.email}</p>
                )}
                {teslaAccount.user.id != null && (
                  <p className="text-muted-foreground font-mono text-xs">
                    ID account: {teslaAccount.user.id}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">I miei veicoli</CardTitle>
              <Car className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {teslaAccount.vehicles.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessun veicolo collegato.</p>
              ) : (
                <ul className="space-y-2">
                  {teslaAccount.vehicles.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {v.display_name || `Veicolo ${v.id}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={v.state === "online" ? "default" : "secondary"}>
                          {v.state ?? "—"}
                        </Badge>
                        <span className="font-mono text-muted-foreground text-xs">
                          {v.vin}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ordini</CardTitle>
              <Package className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {teslaAccount.orders == null ||
              (Array.isArray(teslaAccount.orders) && teslaAccount.orders.length === 0) ? (
                <p className="text-muted-foreground text-sm">
                  Nessun ordine attivo o dati non disponibili.
                </p>
              ) : Array.isArray(teslaAccount.orders) ? (
                <ul className="space-y-2">
                  {teslaAccount.orders.map((order: Record<string, unknown>, i: number) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      {order.order_id != null && (
                        <span className="font-mono text-xs text-muted-foreground">
                          #{String(order.order_id)}
                        </span>
                      )}
                      {order.status != null && (
                        <Badge variant="secondary" className="ml-2">
                          {String(order.status)}
                        </Badge>
                      )}
                      {order.model != null && (
                        <p className="mt-1 font-medium">{String(order.model)}</p>
                      )}
                      {order.vin != null && (
                        <p className="font-mono text-xs text-muted-foreground">
                          VIN: {String(order.vin)}
                        </p>
                      )}
                      {Object.keys(order).length > 0 &&
                        order.order_id == null &&
                        order.status == null &&
                        order.model == null &&
                        order.vin == null && (
                          <pre className="mt-1 overflow-x-auto text-xs">
                            {JSON.stringify(order, null, 2)}
                          </pre>
                        )}
                    </li>
                  ))}
                </ul>
              ) : (
                <pre className="overflow-x-auto rounded border border-border bg-muted/30 p-2 text-xs">
                  {JSON.stringify(teslaAccount.orders, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <TeslaReconnectCard teslaError={teslaError} />
      )}

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Model Y Long Range RWD</CardTitle>
          <CardDescription>
            Stealth Grey (Lunar Grey) · Compositor Design Studio — scorri le viste
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <VehicleConfiguratorCarousel className="w-full" />
        </CardContent>
      </Card>

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

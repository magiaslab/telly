import {
  getLatestTelemetry,
  getTelemetriesForChart,
  getChargingCostThisMonth,
  getMonthlySummary,
  getSavingsForBarChart,
  getTeslaAccountAndVehicles,
  getWallboxData,
  DIESEL_EUR_PER_L,
  DIESEL_KM_PER_L,
  type WallboxData,
} from "./data";
import { getOctopusData, INTELLIGENT_OCTOPUS_URL } from "@/lib/octopus-api";
import { useMock } from "@/lib/use-mock";
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
import { Car, Gauge, Fuel, Leaf, MapPin, Package, Plug, Route, User, Zap } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { VehicleMap } from "@/components/dashboard/vehicle-map";
import { VehicleConfiguratorCarousel } from "@/components/dashboard/vehicle-configurator-carousel";
import { TeslaConnectButton } from "@/components/dashboard/tesla-connect-button";
import { TeslaPasteTokenForm } from "@/components/dashboard/tesla-paste-token-form";
import { WallboxLiveStatus } from "@/components/dashboard/wallbox-live-status";

const DIESEL_LABEL = `Diesel ${DIESEL_EUR_PER_L} €/L · ${DIESEL_KM_PER_L} km/L`;

const WALLBOX_MONTH_SOURCE_LABEL: Record<WallboxData["monthStatsSource"], string> = {
  v2c_global_api: "Totali da API V2C (/stadistic/global/me), come l'app wallbox",
  db: "Somma sessioni salvate nel database (webhook/sync)",
  sessions_partial: "Stima dalle ultime sessioni visibili (max 5 da API)",
  none: "Nessun dato",
};

const TESLA_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Autorizzazione Tesla annullata.",
  invalid_state: "Sessione scaduta. Riprova a collegare l’account.",
  missing_code_or_state: "Callback Tesla senza code o state.",
  token_exchange_failed: "Impossibile ottenere il token da Tesla. Riprova.",
  no_refresh_token: "Tesla non ha restituito il refresh token.",
  server_config: "Configurazione server mancante (TESLA_CLIENT_ID/SECRET/REDIRECT_URI).",
};

type DashboardContentProps = { teslaError?: string; teslaLinked?: boolean };

/** Card quando i dati Tesla non sono disponibili: pulsante Collega o token da env. */
function TeslaReconnectCard({ teslaError }: { teslaError?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati Tesla non disponibili</CardTitle>
        <CardDescription>
          Collega il tuo account Tesla per profilo, veicoli e ordini, oppure imposta <code className="rounded bg-muted px-1">TESLA_REFRESH_TOKEN</code> in env.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teslaError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {TESLA_ERROR_MESSAGES[teslaError] ?? `Errore: ${teslaError}`}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <TeslaConnectButton />
          <span className="text-muted-foreground text-xs">oppure incolla il token sotto</span>
        </div>
        <div className="border-t pt-4">
          <TeslaPasteTokenForm />
        </div>
      </CardContent>
    </Card>
  );
}

export async function DashboardContent({ teslaError, teslaLinked }: DashboardContentProps) {
  const [latest, chartData, cost, monthly, savingsChart, teslaAccount, wallbox, octopus] =
    await Promise.all([
    getLatestTelemetry(),
    getTelemetriesForChart(7),
    getChargingCostThisMonth(),
    getMonthlySummary(),
    getSavingsForBarChart(4),
    getTeslaAccountAndVehicles(),
    getWallboxData(20),
    getOctopusData(),
  ]);

  const dateFmt = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasSavingsChartData = savingsChart.series.some(
    (s) => s.km > 0 || s.spentEur > 0
  );

  const mockEnabled = useMock();
  const hasNoData = !latest && chartData.length === 0 && cost.events.length === 0;

  return (
    <div className="space-y-8">
      {teslaLinked && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          Account Tesla collegato. Profilo e veicoli aggiornati.
        </div>
      )}
      {hasNoData && (
        <div className="bg-muted/50 border-border rounded-lg border px-4 py-3 text-sm">
          {mockEnabled ? (
            <>
              <strong>Nessun dato in database.</strong> Crea le tabelle e carica i dati mock:{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">npm run db:push</code>
              {" e "}
              <code className="bg-muted rounded px-1.5 py-0.5">npm run seed</code>
            </>
          ) : (
            <>
              <strong>Nessuna telemetria per il tuo VIN.</strong> Il database contiene dati
              storici solo del mock (altro VIN). Collega l&apos;account Tesla e premi{" "}
              <strong>Sync</strong> o <strong>Forza sync</strong> per importare batteria, km e
              posizione reali dalla Fleet API. In alternativa incolla il refresh token nel riquadro
              sopra.
            </>
          )}
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

      {wallbox.deviceId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-4 w-4" /> Wallbox V2C
              </CardTitle>
              <CardDescription>
                Energia erogata dalla wallbox Trydan (app V2C) · dispositivo{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">
                  {wallbox.deviceId}
                </code>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <WallboxLiveStatus
              initialStatus={wallbox.status}
              initialConnected={wallbox.connected}
            />

            <div className="flex flex-wrap gap-6 border-t border-border pt-4">
              <div>
                <p className="text-muted-foreground text-sm">Energia questo mese (wallbox)</p>
                <p className="text-2xl font-bold tabular-nums">
                  {wallbox.monthEnergyKwh.toFixed(1)} kWh
                </p>
                <p className="text-muted-foreground text-xs">
                  {wallbox.monthChargeCount > 0
                    ? `${wallbox.monthChargeCount} ricariche`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Costo stimato (wallbox)</p>
                <p className="text-2xl font-bold tabular-nums">
                  {wallbox.monthCostEur.toFixed(2)} €
                </p>
                <p className="text-muted-foreground text-xs">
                  Tariffa configurata in V2C (non bolletta Octopus)
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {WALLBOX_MONTH_SOURCE_LABEL[wallbox.monthStatsSource]}. L&apos;API sessioni restituisce
              al massimo 5 ricariche: per lo storico completo usa webhook + sync.
            </p>

            <div>
              <p className="text-muted-foreground mb-2 text-sm">Ricariche recenti</p>
              {wallbox.sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nessuna ricarica registrata. Avvia una sincronizzazione:{" "}
                  <code className="bg-muted rounded px-1.5 py-0.5">/api/v2c/sync</code>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border text-left">
                        <th className="py-2 pr-4 font-medium">Inizio</th>
                        <th className="py-2 pr-4 font-medium">Fine</th>
                        <th className="py-2 pr-4 text-right font-medium">Energia</th>
                        <th className="py-2 pr-4 text-right font-medium">Costo</th>
                        <th className="py-2 font-medium">Utente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallbox.sessions.map((s) => (
                        <tr key={s.idCharge} className="border-b border-border/50">
                          <td className="py-2 pr-4 tabular-nums">
                            {s.startedAt ? dateFmt.format(s.startedAt) : "—"}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {s.endedAt ? (
                              dateFmt.format(s.endedAt)
                            ) : (
                              <Badge variant="secondary">in corso</Badge>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {s.energyKwh.toFixed(2)} kWh
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {s.costEur.toFixed(2)} €
                          </td>
                          <td className="py-2">{s.rfidName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                <p className="text-muted-foreground mt-2 text-xs">
                  Orari in fuso Europe/Rome. Costo per sessione da API V2C (campo{" "}
                  <code className="bg-muted rounded px-1">cost</code>).
                </p>
            </div>
          </CardContent>
        </Card>
      )}

      {octopus.configured && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600 dark:text-green-400" /> Octopus Energy
              </CardTitle>
              <CardDescription>
                {octopus.tariff
                  ? `${octopus.tariff.productName} · POD ${octopus.tariff.pod}`
                  : "Dati tariffa non disponibili"}
              </CardDescription>
            </div>
            <Badge variant="outline">Account {octopus.accountNumber}</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {octopus.tariff && (
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-muted-foreground text-sm">Materia energia</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {octopus.tariff.unitRateEurPerKwh.toFixed(5)} €/kWh
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {octopus.tariff.productType === "FIXED_SINGLE_RATE"
                      ? "Prezzo fisso monorario"
                      : octopus.tariff.productType}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Quota fissa</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {octopus.tariff.annualStandingChargeEur.toFixed(0)} €/anno
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {octopus.tariff.isSmartMeter ? "Contatore smart" : "Contatore tradizionale"}
                  </p>
                </div>
              </div>
            )}

            {octopus.device && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium">Intelligent Octopus</span>
                    <Badge variant="secondary">{octopus.device.name}</Badge>
                  </div>
                  {octopus.plannedDispatches.length > 0 ? (
                    <Badge className="bg-green-600 hover:bg-green-700">
                      {octopus.plannedDispatches.length} finestre pianificate
                    </Badge>
                  ) : (
                    <Badge variant="outline">In attesa di prossima finestra</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Kraken ottimizza la ricarica nelle ore più convenienti (imposti ora di partenza e
                  % carica nell&apos;app Octopus). Lo sconto del 30% si applica solo ai kWh
                  ottimizzati, sulla componente energia, e compare in bolletta.{" "}
                  <a
                    href={INTELLIGENT_OCTOPUS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Come funziona
                  </a>
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Kraken pilota la <strong>Tesla</strong> (non la wallbox V2C). I kWh wallbox e
                  Intelligent possono differire: sono due canali di ricarica distinti.
                </p>
                <div className="mt-4 flex flex-wrap gap-6">
                  <div>
                    <p className="text-muted-foreground text-sm">kWh ottimizzati (mese, DB)</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {octopus.monthSmartKwh.toFixed(2)} kWh
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {octopus.monthDispatchCount > 0
                        ? `${octopus.monthDispatchCount} finestre · storico ${octopus.storedDispatchCount} in DB`
                        : "Nessuna finestra salvata questo mese"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Componente energia (mese, DB)</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {octopus.monthSmartEnergyCostEur.toFixed(2)} €
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {octopus.tariff
                        ? `${octopus.tariff.unitRateEurPerKwh.toFixed(5)} €/kWh materia energia`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Sconto stimato (30%, mese DB)</p>
                    <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                      −{octopus.monthIntelligentSavingEur.toFixed(2)} €
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Accredito reale in bolletta Octopus (app)
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Ultime finestre API</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {octopus.recentSmartKwh.toFixed(2)} kWh
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Solo finestra breve Kraken (non storico)
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  {octopus.dispatchDataNote}{" "}
                  Sync manuale:{" "}
                  <code className="bg-muted rounded px-1.5 py-0.5">/api/octopus/sync</code>
                </p>
                {octopus.plannedDispatches.length > 0 && (
                  <div className="mt-3 border-t border-green-500/20 pt-3">
                    <p className="text-muted-foreground mb-1 text-xs">Prossime finestre di ricarica</p>
                    <ul className="space-y-1 text-sm">
                      {octopus.plannedDispatches.slice(0, 4).map((p, i) => (
                        <li key={i} className="tabular-nums">
                          {dateFmt.format(new Date(p.start))} → {dateFmt.format(new Date(p.end))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(octopus.storedDispatches.length > 0 ? octopus.storedDispatches : octopus.completedDispatches).length > 0 && (
                  <div className="mt-3 border-t border-green-500/20 pt-3">
                    <p className="text-muted-foreground mb-2 text-xs">
                      {octopus.storedDispatches.length > 0
                        ? "Storico Intelligent salvato (DB)"
                        : "Finestre completate (ultime API)"}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-green-500/20 text-left">
                            <th className="py-1 pr-3 font-medium">Inizio</th>
                            <th className="py-1 pr-3 font-medium">Fine</th>
                            <th className="py-1 text-right font-medium">kWh ottimizzati</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(octopus.storedDispatches.length > 0
                            ? octopus.storedDispatches
                            : octopus.completedDispatches
                          )
                            .slice(0, 8)
                            .map((d, i) => (
                            <tr key={i} className="border-b border-green-500/10">
                              <td className="py-1 pr-3 tabular-nums">
                                {dateFmt.format(new Date(d.start))}
                              </td>
                              <td className="py-1 pr-3 tabular-nums">
                                {dateFmt.format(new Date(d.end))}
                              </td>
                              <td className="py-1 text-right tabular-nums">
                                {Math.abs(d.deltaKwh).toFixed(2)} kWh
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-4 w-4" /> Riepilogo {monthly.monthLabel}
          </CardTitle>
          <CardDescription>
            L&apos;odometro totale dell&apos;auto è diverso dai km percorsi nel mese: i km mensili
            sono la differenza tra due sync Tesla (vedi sotto).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Odometro attuale</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.currentOdometerKm != null
                  ? `${monthly.currentOdometerKm.toFixed(0)} km`
                  : "—"}
              </p>
              <p className="text-muted-foreground text-xs">Totale km sull&apos;auto (Tesla)</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Km percorsi nel mese</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.kmSource === "odometer_delta"
                  ? `${monthly.kmDriven.toFixed(1)} km`
                  : "—"}
              </p>
              <p className="text-muted-foreground text-xs">
                {monthly.odometerStart != null && monthly.odometerEnd != null ? (
                  <>
                    Δ odometro: {monthly.odometerStart.toFixed(0)} → {monthly.odometerEnd.toFixed(0)}{" "}
                    km
                    {monthly.correctedMilesAsKm &&
                      monthly.odometerStartRaw != null &&
                      ` (corretto da ${monthly.odometerStartRaw.toFixed(0)} mi→km)`}
                  </>
                ) : (
                  "Serve almeno 2 sync nel mese"
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Ricarica casa (wallbox)</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.homeChargeEur.toFixed(2)} €
              </p>
              <p className="text-muted-foreground text-xs">
                {monthly.homeChargeKwh.toFixed(1)} kWh · {monthly.homeChargeSessions} sessioni
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Equiv. Diesel ({DIESEL_LABEL})</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.dieselCostEur > 0 ? `${monthly.dieselCostEur.toFixed(2)} €` : "—"}
              </p>
              <p className="text-muted-foreground text-xs">
                Stesso km su Kia 1.4 diesel
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Risparmio vs Diesel</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  monthly.savedVsDieselEur > 0
                    ? "text-green-600 dark:text-green-400"
                    : ""
                }`}
              >
                {monthly.kmDriven > 0
                  ? `${monthly.savedVsDieselEur >= 0 ? "" : "−"}${Math.abs(monthly.savedVsDieselEur).toFixed(2)} €`
                  : "—"}
              </p>
              {monthly.consumptionKwhPer100Km != null && (
                <p className="text-muted-foreground text-xs">
                  ~{monthly.consumptionKwhPer100Km} kWh/100 km (solo casa)
                </p>
              )}
            </div>
          </div>
          {octopus.monthIntelligentSavingEur > 0 && (
            <p className="text-muted-foreground border-t border-border pt-3 text-xs">
              Intelligent Octopus (stima mese DB): −{octopus.monthIntelligentSavingEur.toFixed(2)} €
              sulla materia energia Tesla ottimizzata — accredito reale in bolletta.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-4 w-4" /> Confronto costi
          </CardTitle>
          <CardDescription>{DIESEL_LABEL}. Km reali da odometro, spesa ricarica da wallbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-muted-foreground text-sm">Odometro attuale</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.currentOdometerKm != null
                  ? `${monthly.currentOdometerKm.toFixed(0)} km`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Km percorsi nel mese</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.kmSource === "odometer_delta"
                  ? `${monthly.kmDriven.toFixed(1)} km`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Ricarica casa</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.homeChargeEur.toFixed(2)} €
              </p>
              <p className="text-muted-foreground text-xs">{monthly.homeChargeKwh.toFixed(1)} kWh</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Costo equiv. Diesel</p>
              <p className="text-2xl font-bold tabular-nums">
                {monthly.dieselCostEur > 0 ? `${monthly.dieselCostEur.toFixed(2)} €` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Risparmio netto</p>
              <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {monthly.kmDriven > 0
                  ? `${monthly.savedVsDieselEur.toFixed(2)} €`
                  : "—"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-sm">Ultime 4 settimane</p>
            {hasSavingsChartData ? (
              <SavingsBarChart series={savingsChart.series} />
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-muted-foreground text-sm">
                Esegui più sync Tesla e ricariche wallbox per popolare il grafico settimanale.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

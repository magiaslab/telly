"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Plug, PlugZap, Power, Sun, Wifi, WifiOff } from "lucide-react";

type V2cChargeState = 0 | 1 | 2;

type V2cStatus = {
  chargeState: V2cChargeState;
  power: number;
  intensity: number;
  voltage: number;
  energy: number;
  sunPower: number;
  photovoltaicOn: boolean;
};

type Props = {
  initialStatus: V2cStatus | null;
  initialConnected: boolean;
  /** intervallo polling in ms (default 20s) */
  refreshMs?: number;
};

const CHARGE_STATE_LABEL: Record<V2cChargeState, string> = {
  0: "Inattiva",
  1: "Collegata",
  2: "In carica",
};

function StateBadge({ state }: { state: V2cChargeState }) {
  if (state === 2) {
    return (
      <Badge className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800">
        <PlugZap className="mr-1 h-3.5 w-3.5" />
        {CHARGE_STATE_LABEL[2]}
      </Badge>
    );
  }
  if (state === 1) {
    return (
      <Badge variant="secondary">
        <Plug className="mr-1 h-3.5 w-3.5" />
        {CHARGE_STATE_LABEL[1]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Power className="mr-1 h-3.5 w-3.5" />
      {CHARGE_STATE_LABEL[0]}
    </Badge>
  );
}

export function WallboxLiveStatus({
  initialStatus,
  initialConnected,
  refreshMs = 20000,
}: Props) {
  const [status, setStatus] = useState<V2cStatus | null>(initialStatus);
  const [connected, setConnected] = useState(initialConnected);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/v2c/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (data.state) setStatus(data.state);
        setConnected(Boolean(data.connected));
      } catch {
        // ignora errori transitori di rete
      }
    }
    const id = setInterval(poll, refreshMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refreshMs]);

  const state = (status?.chargeState ?? 0) as V2cChargeState;
  const voltage =
    status && status.voltage >= 100 ? Math.round(status.voltage) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={state} />
        {connected ? (
          <Badge variant="outline" className="text-green-700 dark:text-green-400">
            <Wifi className="mr-1 h-3.5 w-3.5" />
            Connessa
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <WifiOff className="mr-1 h-3.5 w-3.5" />
            Offline
          </Badge>
        )}
        {status?.photovoltaicOn && (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            <Sun className="mr-1 h-3.5 w-3.5" />
            Fotovoltaico
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs">Potenza</p>
          <p className="text-xl font-bold tabular-nums">
            {(status?.power ?? 0).toFixed(2)} <span className="text-sm font-normal">kW</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Corrente</p>
          <p className="text-xl font-bold tabular-nums">
            {Math.round(status?.intensity ?? 0)} <span className="text-sm font-normal">A</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Tensione</p>
          <p className="text-xl font-bold tabular-nums">
            {voltage != null ? (
              <>
                {voltage} <span className="text-sm font-normal">V</span>
              </>
            ) : (
              <span className="text-muted-foreground text-base font-normal">—</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Sessione</p>
          <p className="text-xl font-bold tabular-nums">
            {(status?.energy ?? 0).toFixed(2)} <span className="text-sm font-normal">kWh</span>
          </p>
        </div>
      </div>
    </div>
  );
}

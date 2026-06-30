/**
 * Client per la V2C Thirdparty API (wallbox V2Charge).
 * Docs: https://api.v2charge.com/
 *
 * Autenticazione: header `apikey: <V2C_API_KEY>`.
 * Base URL produzione: https://v2c.cloud/kong/v2c_service
 *
 * Quando V2C_API_KEY non è impostata (o NEXT_PUBLIC_USE_MOCK=true) le funzioni
 * restituiscono dati mock così la dashboard resta utilizzabile in sviluppo.
 */
import { useMock } from "./use-mock";

const V2C_BASE_URL = "https://v2c.cloud/kong/v2c_service";

/** charge_state V2C: 0 = standby/non collegato, 1 = collegato non in carica, 2 = in carica. */
export type V2cChargeState = 0 | 1 | 2;

export type V2cCurrentState = {
  error: string;
  battery: number;
  voltage: number;
  intensity: number;
  seconds: number;
  photovoltaicOn: boolean;
  housePower: number;
  chargeState: V2cChargeState;
  power: number; // kW erogati
  sunPower: number; // kW da fotovoltaico
  phases: number;
  energy: number; // kWh sessione corrente
};

export type V2cStatistic = {
  id: number;
  deviceId: string;
  startChargeDate: string | null;
  endChargeDate: string | null;
  idCharge: string;
  energy: number; // kWh
  cost: number; // €
  coCost: number;
  costFv: number; // € coperti da fotovoltaico
  energyByHour: string | null;
  energyByHourFv: string | null;
  rfidCode: string | null;
  rfidName: string | null;
  message: string | null;
  warning: boolean;
  finished: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type V2cGlobalStats = {
  totalEnergy: number;
  totalCharges: number;
};

export type V2cPairing = {
  id: string;
  name: string;
};

export function hasV2cApiKey(): boolean {
  return Boolean(process.env.V2C_API_KEY);
}

/** True quando dobbiamo usare dati mock invece dell'API reale. */
export function useV2cMock(): boolean {
  return useMock() || !hasV2cApiKey();
}

function v2cHeaders(): HeadersInit {
  return { apikey: process.env.V2C_API_KEY ?? "" };
}

async function v2cFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | undefined> }
): Promise<T> {
  const url = new URL(`${V2C_BASE_URL}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: { ...v2cHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`V2C ${path} failed: ${res.status} ${text}`);
  }
  // Alcuni endpoint rispondono con corpo vuoto su 200.
  const raw = await res.text();
  return (raw ? JSON.parse(raw) : null) as T;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/** GET /pairings/me — elenco wallbox associate all'account. */
export async function getV2cPairings(): Promise<V2cPairing[]> {
  if (useV2cMock()) return [{ id: "MOCK01", name: "Wallbox Telly (mock)" }];
  const data = await v2cFetch<V2cPairing[]>("/pairings/me");
  return Array.isArray(data) ? data : [];
}

/** deviceId da env, oppure autodetect via /pairings/me (primo dispositivo). */
export async function resolveV2cDeviceId(): Promise<string | null> {
  if (process.env.V2C_DEVICE_ID) return process.env.V2C_DEVICE_ID;
  if (useV2cMock()) return "MOCK01";
  try {
    const pairings = await getV2cPairings();
    return pairings[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** POST /device/currentstatecharge — stato in tempo reale della ricarica. */
export async function getV2cCurrentState(
  deviceId: string
): Promise<V2cCurrentState | null> {
  if (useV2cMock()) return mockCurrentState();
  const raw = await v2cFetch<Record<string, unknown>>("/device/currentstatecharge", {
    method: "POST",
    query: { deviceId },
  });
  if (!raw) return null;
  return {
    error: String(raw.error ?? ""),
    battery: num(raw.battery),
    voltage: num(raw.voltage),
    intensity: num(raw.intensity),
    seconds: num(raw.seconds),
    photovoltaicOn: num(raw.photovoltaic_on) === 1,
    housePower: num(raw.house_power),
    chargeState: (num(raw.charge_state) as V2cChargeState) ?? 0,
    power: num(raw.power),
    sunPower: num(raw.sun_power),
    phases: num(raw.phases),
    energy: num(raw.energy),
  };
}

/**
 * GET /device/connected — true se la wallbox è connessa al cloud V2C.
 * L'endpoint risponde 200 con corpo vuoto quando la wallbox è connessa,
 * quindi una risposta senza errori (raw === null) va interpretata come connessa.
 */
export async function getV2cConnected(deviceId: string): Promise<boolean> {
  if (useV2cMock()) return true;
  try {
    const raw = await v2cFetch<unknown>("/device/connected", { query: { deviceId } });
    if (raw == null) return true; // 200 senza corpo = connessa
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const v = o.connected ?? o.online ?? o.status;
      return v == null ? true : Boolean(v);
    }
    return Boolean(raw);
  } catch {
    return false;
  }
}

/** GET /stadistic/device — ultime ricariche del dispositivo (max 5), con filtro date opzionale. */
export async function getV2cDeviceStatistics(
  deviceId: string,
  chargeDateStart?: string,
  chargeDateEnd?: string
): Promise<V2cStatistic[]> {
  if (useV2cMock()) return mockStatistics(deviceId);
  const data = await v2cFetch<unknown[]>("/stadistic/device", {
    query: { deviceId, chargeDateStart, chargeDateEnd },
  });
  return Array.isArray(data) ? (data as V2cStatistic[]) : [];
}

/** GET /stadistic/global/me — statistiche aggregate di tutti i dispositivi. */
export async function getV2cGlobalStats(
  endChargeDateStart?: string,
  endChargeDateEnd?: string
): Promise<V2cGlobalStats> {
  if (useV2cMock()) return { totalEnergy: 312.4, totalCharges: 41 };
  const data = await v2cFetch<V2cGlobalStats[] | V2cGlobalStats>("/stadistic/global/me", {
    query: { endChargeDateStart, endChargeDateEnd },
  });
  const item = Array.isArray(data) ? data[0] : data;
  return {
    totalEnergy: num(item?.totalEnergy),
    totalCharges: num(item?.totalCharges),
  };
}

// ---------------------------------------------------------------------------
// Mock helpers (sviluppo senza API key reale)
// ---------------------------------------------------------------------------

function mockCurrentState(): V2cCurrentState {
  const charging = Math.random() > 0.5;
  return {
    error: "0",
    battery: 0,
    voltage: 230 + Math.random() * 4,
    intensity: charging ? 16 : 0,
    seconds: charging ? Math.floor(Math.random() * 3600) : 0,
    photovoltaicOn: Math.random() > 0.5,
    housePower: 2 + Math.random() * 2,
    chargeState: charging ? 2 : 1,
    power: charging ? 3.6 + Math.random() : 0,
    sunPower: Math.random() * 2,
    phases: 1,
    energy: charging ? Math.random() * 8 : 0,
  };
}

function mockStatistics(deviceId: string): V2cStatistic[] {
  const out: V2cStatistic[] = [];
  for (let i = 0; i < 5; i++) {
    const start = new Date();
    start.setDate(start.getDate() - i * 3);
    start.setHours(1, 0, 0, 0);
    const end = new Date(start);
    end.setHours(5, Math.floor(Math.random() * 59), 0, 0);
    const energy = Math.round((6 + Math.random() * 8) * 100) / 100;
    out.push({
      id: 1000 + i,
      deviceId,
      startChargeDate: start.toISOString().slice(0, 19),
      endChargeDate: end.toISOString().slice(0, 19),
      idCharge: start.toISOString().slice(0, 19).replace("T", " "),
      energy,
      cost: Math.round(energy * 0.15 * 100) / 100,
      coCost: 0,
      costFv: 0,
      energyByHour: null,
      energyByHourFv: null,
      rfidCode: null,
      rfidName: "Telly",
      message: null,
      warning: false,
      finished: true,
      createdAt: start.toISOString(),
      updatedAt: end.toISOString(),
    });
  }
  return out;
}

/** Mappa una statistica/evento V2C in una riga DB wallbox_sessions. */
export function v2cStatToSessionRow(s: V2cStatistic) {
  const parseDate = (v: string | null) => (v ? new Date(v) : null);
  return {
    deviceId: s.deviceId,
    idCharge: s.idCharge,
    startedAt: parseDate(s.startChargeDate),
    endedAt: parseDate(s.endChargeDate),
    energyKwh: num(s.energy),
    costEur: num(s.cost),
    costFvEur: num(s.costFv),
    energyByHour: s.energyByHour ?? null,
    rfidCode: s.rfidCode ?? null,
    rfidName: s.rfidName ?? null,
    finished: Boolean(s.finished),
    updatedAt: new Date(),
  };
}

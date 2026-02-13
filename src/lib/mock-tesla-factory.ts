/**
 * Mock Engine: genera un oggetto JSON conforme allo schema vehicle_data
 * della Tesla Fleet API per sviluppo senza VIN reale.
 * @see https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints
 */

export const MOCK_VIN = "LRW0MYLRRWD202600"; // 17 caratteri
export const MOCK_VEHICLE_NAME = "Telly";

/** Coordinate GPS reali (Toscana) */
export const MOCK_LOCATIONS = {
  sanVincenzo: { lat: 43.1906, lon: 10.5403 },
  venturina: { lat: 43.0285, lon: 10.6083 },
  livornoViaGaribaldi: { lat: 43.5519, lon: 10.3184 },
} as const;

export type MockLocationKey = keyof typeof MOCK_LOCATIONS;

export interface MockVehicleDataOptions {
  /** Stato veicolo (default "online") */
  state?: "online" | "asleep" | "offline" | "waking" | "unavailable";
  /** Batteria 0-100 (default random 20-80) */
  batteryLevel?: number;
  /** In carica (default false) */
  chargingState?: "Charging" | "Disconnected" | "Stopped" | "Complete";
  /** Location key per lat/lon (default "sanVincenzo") */
  location?: MockLocationKey;
  /** Odometro in km (default ~1500) */
  odometer?: number;
  /** kWh aggiunti in sessione corrente (opzionale) */
  chargeEnergyAdded?: number;
}

/**
 * Struttura risposta vehicle_data Tesla Fleet API (solo campi usati/validati).
 * Non inventare campi: attinenza alla doc ufficiale.
 */
export interface MockTeslaVehicleDataResponse {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string;
  state: string;
  charge_state: {
    battery_level: number;
    battery_range: number; // miglia
    charge_limit_soc: number;
    charging_state: string;
    charger_power: number;
    charge_energy_added?: number;
  };
  drive_state: {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number | null;
    power: number | null;
    shift_state: string | null;
    gps_as_of: number;
  };
  vehicle_state: {
    odometer: number;
    tpms_pressure_fl: number;
    tpms_pressure_fr: number;
    tpms_pressure_rl: number;
    tpms_pressure_rr: number;
  };
  climate_state: {
    inside_temp: number | null;
    outside_temp: number | null;
    is_climate_on: boolean;
  };
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Genera un payload vehicle_data mock conforme allo schema Tesla.
 */
export function createMockVehicleData(
  options: MockVehicleDataOptions = {}
): MockTeslaVehicleDataResponse {
  const {
    state = "online",
    batteryLevel = clamp(20, Math.round(20 + Math.random() * 60), 80),
    chargingState = "Disconnected",
    location = "sanVincenzo",
    odometer = 1480 + Math.round(Math.random() * 80),
    chargeEnergyAdded,
  } = options;

  const loc = MOCK_LOCATIONS[location];
  const batteryRangeMiles = (batteryLevel / 100) * 330; // ~330 mi full per LR

  return {
    id: 1,
    vehicle_id: 1,
    vin: MOCK_VIN,
    display_name: MOCK_VEHICLE_NAME,
    state,
    charge_state: {
      battery_level: batteryLevel,
      battery_range: Math.round(batteryRangeMiles * 10) / 10,
      charge_limit_soc: 80,
      charging_state: chargingState,
      charger_power: chargingState === "Charging" ? 4.6 : 0,
      ...(chargeEnergyAdded != null && { charge_energy_added: chargeEnergyAdded }),
    },
    drive_state: {
      latitude: loc.lat,
      longitude: loc.lon,
      heading: 0,
      speed: null,
      power: null,
      shift_state: null,
      gps_as_of: Math.floor(Date.now() / 1000),
    },
    vehicle_state: {
      odometer,
      tpms_pressure_fl: 2.9,
      tpms_pressure_fr: 2.9,
      tpms_pressure_rl: 2.9,
      tpms_pressure_rr: 2.9,
    },
    climate_state: {
      inside_temp: 22,
      outside_temp: 32, // estate San Vincenzo
      is_climate_on: true,
    },
  };
}

/**
 * Formato wrapper API: { response: vehicle_data }
 */
export function createMockVehicleDataApiResponse(
  options?: MockVehicleDataOptions
): { response: MockTeslaVehicleDataResponse } {
  return { response: createMockVehicleData(options) };
}

/**
 * Mappa il mock al formato accettato da getVehicleData/validazione (stesso shape del nostro Zod).
 */
export function mockResponseToValidatedShape(
  res: MockTeslaVehicleDataResponse
): {
  id: number;
  vin: string;
  state: "online" | "asleep" | "offline" | "waking" | "unavailable";
  charge_state: {
    battery_level: number;
    battery_range: number;
    charging_state: string;
    charger_power: number;
  };
  drive_state: {
    latitude: number;
    longitude: number;
    heading: number;
    gps_as_of: number;
  };
  vehicle_state: { odometer: number };
  climate_state: { inside_temp: number | null; outside_temp: number | null };
} {
  return {
    id: res.id,
    vin: res.vin,
    state: res.state as "online" | "asleep" | "offline" | "waking" | "unavailable",
    charge_state: {
      battery_level: res.charge_state.battery_level,
      battery_range: res.charge_state.battery_range,
      charging_state: res.charge_state.charging_state,
      charger_power: res.charge_state.charger_power,
    },
    drive_state: {
      latitude: res.drive_state.latitude,
      longitude: res.drive_state.longitude,
      heading: res.drive_state.heading,
      gps_as_of: res.drive_state.gps_as_of,
    },
    vehicle_state: { odometer: res.vehicle_state.odometer },
    climate_state: {
      inside_temp: res.climate_state.inside_temp,
      outside_temp: res.climate_state.outside_temp,
    },
  };
}

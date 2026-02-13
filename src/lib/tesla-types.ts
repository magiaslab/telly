/**
 * Tesla Fleet API - vehicle_data response (partial, for telemetry mapping).
 * Validated with Zod before persisting to DB.
 */
export interface TeslaVehicleData {
  id?: number;
  vin?: string;
  state?: "online" | "asleep" | "offline" | "waking" | "unavailable";
  charge_state?: {
    battery_level?: number;
    battery_range?: number;
    charging_state?: string;
    charger_power?: number;
  };
  drive_state?: {
    latitude?: number;
    longitude?: number;
    heading?: number;
    speed?: number;
    power?: number;
    shift_state?: string | null;
    gps_as_of?: number;
  };
  vehicle_state?: {
    odometer?: number;
  };
  climate_state?: {
    inside_temp?: number | null;
  };
}

export interface TeslaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface TeslaVehiclesResponse {
  response: Array<{
    id: number;
    vehicle_id: number;
    vin: string;
    display_name?: string;
    state?: string;
    option_codes?: string;
  }>;
  count: number;
}

/** GET /api/1/users/me — profilo utente (senza VIN) */
export interface TeslaUserMeResponse {
  response: {
    id: number;
    email?: string;
    full_name?: string;
    profile_image_url?: string;
  };
}

/** GET /api/1/region — regione account (senza VIN); per base URL Fleet API */
export interface TeslaRegionResponse {
  response: { region: "NA" | "EU" | "CN" };
}

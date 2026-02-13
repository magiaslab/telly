import { z } from "zod";

/**
 * Zod schema per validare il payload vehicle_data da Tesla Fleet API
 * prima di mapparlo su Neon (evita dati corrotti/malformati).
 */
export const teslaChargeStateSchema = z.object({
  battery_level: z.number().min(0).max(100).optional(),
  battery_range: z.number().optional(),
  charging_state: z.string().optional(),
  charger_power: z.number().optional(),
});

export const teslaDriveStateSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional().nullable(),
  power: z.number().optional().nullable(),
  shift_state: z.string().nullable().optional(),
  gps_as_of: z.number().optional(),
});

export const teslaVehicleStateSchema = z.object({
  odometer: z.number().optional(),
});

export const teslaClimateStateSchema = z.object({
  inside_temp: z.number().nullable().optional(),
});

export const teslaVehicleDataSchema = z.object({
  id: z.number().optional(),
  vin: z.string().length(17).optional(),
  state: z.enum(["online", "asleep", "offline", "waking", "unavailable"]).optional(),
  charge_state: teslaChargeStateSchema.optional(),
  drive_state: teslaDriveStateSchema.optional(),
  vehicle_state: teslaVehicleStateSchema.optional(),
  climate_state: teslaClimateStateSchema.optional(),
});

export type TeslaVehicleDataValidated = z.infer<typeof teslaVehicleDataSchema>;

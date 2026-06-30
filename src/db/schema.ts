import {
  pgTable,
  serial,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  doublePrecision,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export { users, accounts, sessions, verificationTokens } from "./auth-schema";

export const telemetries = pgTable("telemetries", {
  id: serial("id").primaryKey(),
  vin: varchar("vin", { length: 17 }).notNull(),
  soc: integer("soc").notNull(), // state of charge %
  odometer: real("odometer").notNull(),
  range: real("range").notNull(), // km
  isCharging: boolean("is_charging").notNull().default(false),
  powerUsage: real("power_usage"), // kW
  tempInside: real("temp_inside"), // °C
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const chargingEvents = pgTable("charging_events", {
  id: serial("id").primaryKey(),
  vin: varchar("vin", { length: 17 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  kWhAdded: real("kwh_added").notNull().default(0),
  costEur: real("cost_eur").notNull().default(0), // Octopus 0.15€/kWh
});

/** Viaggi (per risparmio vs Diesel e BarChart) */
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  vin: varchar("vin", { length: 17 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  startLat: doublePrecision("start_lat"),
  startLon: doublePrecision("start_lon"),
  endLat: doublePrecision("end_lat"),
  endLon: doublePrecision("end_lon"),
  km: real("km").notNull(),
  kWhConsumed: real("kwh_consumed").notNull(), // ~150 Wh/km
});

/** Ricariche reali della wallbox V2C (statistiche + webhook). idCharge è l'identificatore univoco V2C della sessione. */
export const wallboxSessions = pgTable(
  "wallbox_sessions",
  {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 64 }).notNull(),
    idCharge: varchar("id_charge", { length: 64 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    energyKwh: real("energy_kwh").notNull().default(0),
    costEur: real("cost_eur").notNull().default(0),
    costFvEur: real("cost_fv_eur").notNull().default(0), // costo coperto da fotovoltaico
    energyByHour: text("energy_by_hour"), // es. "0.9|3.5|3.6|1.6"
    rfidCode: varchar("rfid_code", { length: 64 }),
    rfidName: varchar("rfid_name", { length: 128 }),
    finished: boolean("finished").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallbox_device_charge_uniq").on(t.deviceId, t.idCharge)]
);

export type Telemetry = typeof telemetries.$inferSelect;
export type NewTelemetry = typeof telemetries.$inferInsert;
export type ChargingEvent = typeof chargingEvents.$inferSelect;
export type NewChargingEvent = typeof chargingEvents.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type WallboxSession = typeof wallboxSessions.$inferSelect;
export type NewWallboxSession = typeof wallboxSessions.$inferInsert;

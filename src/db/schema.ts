import {
  pgTable,
  serial,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  doublePrecision,
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

export type Telemetry = typeof telemetries.$inferSelect;
export type NewTelemetry = typeof telemetries.$inferInsert;
export type ChargingEvent = typeof chargingEvents.$inferSelect;
export type NewChargingEvent = typeof chargingEvents.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

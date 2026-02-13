import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { telemetries, chargingEvents, trips } from "./schema";

export const selectTelemetrySchema = createSelectSchema(telemetries);
export const insertTelemetrySchema = createInsertSchema(telemetries);

export const selectChargingEventSchema = createSelectSchema(chargingEvents);
export const insertChargingEventSchema = createInsertSchema(chargingEvents);

export const selectTripSchema = createSelectSchema(trips);
export const insertTripSchema = createInsertSchema(trips);

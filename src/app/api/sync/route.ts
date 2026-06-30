import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import {
  getTeslaAccessToken,
  getVehicleData,
  mapVehicleDataToTelemetry,
  resolveFleetBaseUrl,
  wakeVehicle,
} from "@/lib/tesla-api";
import { getTeslaRefreshToken } from "@/lib/tesla-refresh-token";
import { db, telemetries, chargingEvents } from "@/db";
import { insertTelemetrySchema } from "@/db/schema.zod";
import { useMock, getEffectiveVin } from "@/lib/use-mock";
import {
  createMockVehicleData,
  mockResponseToValidatedShape,
  type MockLocationKey,
} from "@/lib/mock-tesla-factory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MOCK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "true";
    const useMockData = useMock();
    const vin = getEffectiveVin();

    if (!vin) {
      return Response.json(
        { error: "Missing TESLA_VIN (o NEXT_PUBLIC_USE_MOCK=true per il mock)" },
        { status: 400 }
      );
    }

    let data: Awaited<ReturnType<typeof getVehicleData>>;

    if (useMockData) {
      await delay(MOCK_DELAY_MS);
      const locations: MockLocationKey[] = ["sanVincenzo", "venturina", "livornoViaGaribaldi"];
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const mockRes = createMockVehicleData({
        state: "online",
        batteryLevel: 20 + Math.round(Math.random() * 60),
        chargingState: Math.random() > 0.7 ? "Charging" : "Disconnected",
        location: loc,
        odometer: 1480 + Math.round(Math.random() * 80),
      });
      data = mockResponseToValidatedShape(mockRes);
    } else {
      const refreshToken = await getTeslaRefreshToken(request);
      if (!refreshToken) {
        return Response.json(
          { error: "Accedi con Tesla da /login per sincronizzare." },
          { status: 401 }
        );
      }

      let accessToken: string;
      try {
        accessToken = await getTeslaAccessToken(refreshToken);
      } catch (e) {
        return Response.json(
          { error: "Tesla token refresh failed", details: String(e) },
          { status: 401 }
        );
      }

      const fleetBase = await resolveFleetBaseUrl(accessToken);

      if (force) {
        await wakeVehicle(accessToken, vin, fleetBase);
        await delay(3000);
      }

      try {
        data = await getVehicleData(accessToken, vin, fleetBase);
      } catch (e) {
        return Response.json(
          {
            error: "Tesla vehicle_data failed",
            details: String(e),
            fleetBase,
          },
          { status: 502 }
        );
      }

      if (!data) {
        return Response.json(
          {
            error: "vehicle_data non disponibile (auto in standby o timeout)",
            fleetBase,
            hint: force
              ? "Riprova tra qualche secondo: il wake può richiedere tempo."
              : "Usa «Forza sync» per svegliare l'auto.",
          },
          { status: 502 }
        );
      }
    }

    const state = data.state ?? "unknown";
    if (state !== "online" && !force) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "asleep",
        state,
        message: "Vehicle not online. Use ?force=true to wake and fetch.",
      });
    }

    const mapped = mapVehicleDataToTelemetry(data);

    const row = {
      vin,
      soc: mapped.soc,
      odometer: mapped.odometerKm,
      range: mapped.rangeKm,
      isCharging: mapped.isCharging,
      powerUsage: mapped.powerUsage ?? undefined,
      tempInside: mapped.tempInside ?? undefined,
      lat: mapped.lat ?? undefined,
      lon: mapped.lon ?? undefined,
    };

    const validated = insertTelemetrySchema.safeParse(row);
    if (!validated.success) {
      return Response.json(
        { error: "Validation failed", issues: validated.error.flatten() },
        { status: 400 }
      );
    }

    await db.insert(telemetries).values(validated.data);

    if (mapped.isCharging && mapped.powerUsage != null && mapped.powerUsage > 0) {
      const existing = await db
        .select()
        .from(chargingEvents)
        .where(eq(chargingEvents.vin, vin))
        .orderBy(desc(chargingEvents.startedAt))
        .limit(1);
      const open = existing.find((e) => !e.endedAt);
      if (!open) {
        await db.insert(chargingEvents).values({
          vin,
          startedAt: new Date(),
          kWhAdded: 0,
          costEur: 0,
        });
      }
    }

    return Response.json({
      ok: true,
      state,
      telemetry: row,
    });
  } catch (e) {
    return Response.json(
      { error: "Sync failed", details: String(e) },
      { status: 500 }
    );
  }
}

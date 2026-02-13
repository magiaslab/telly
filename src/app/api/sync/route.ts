import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { getTeslaAccessToken, getVehicleData } from "@/lib/tesla-api";
import { db, telemetries, chargingEvents } from "@/db";
import { insertTelemetrySchema } from "@/db/schema.zod";
import { useMock, getEffectiveVin } from "@/lib/use-mock";
import {
  createMockVehicleData,
  mockResponseToValidatedShape,
  type MockLocationKey,
} from "@/lib/mock-tesla-factory";

const MOCK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "true";
  const useMockData = useMock();
  const vin = getEffectiveVin();

  if (!vin) {
    return Response.json(
      { error: "Missing TESLA_VIN (or NEXT_PUBLIC_USE_MOCK=true per usare il mock)" },
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
    const cookieStore = await cookies();
    const refreshToken =
      cookieStore.get("tesla_refresh_token")?.value ?? process.env.TESLA_REFRESH_TOKEN;
    if (!refreshToken) {
      return Response.json(
        { error: "Missing Tesla refresh token (cookie tesla_refresh_token or env TESLA_REFRESH_TOKEN)" },
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
    data = await getVehicleData(accessToken, vin);
    if (!data) {
      return Response.json(
        { error: "Failed to fetch or parse vehicle_data (vehicle may be asleep or timeout)" },
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

  const charge = data.charge_state;
  const drive = data.drive_state;
  const vehicle = data.vehicle_state;
  const climate = data.climate_state;

  const soc = charge?.battery_level ?? 0;
  const odometer = vehicle?.odometer ?? 0;
  // Tesla restituisce battery_range in miglia; convertiamo in km
  const rangeMiles = charge?.battery_range ?? 0;
  const range = rangeMiles * 1.60934;
  const isCharging = (charge?.charging_state ?? "") === "Charging";
  const powerUsage = charge?.charger_power ?? (drive?.power != null ? drive.power : null);
  const tempInside = climate?.inside_temp ?? null;
  const lat = drive?.latitude ?? null;
  const lon = drive?.longitude ?? null;

  const row = {
    vin,
    soc,
    odometer,
    range,
    isCharging,
    powerUsage: powerUsage ?? undefined,
    tempInside: tempInside ?? undefined,
    lat: lat ?? undefined,
    lon: lon ?? undefined,
  };

  const validated = insertTelemetrySchema.safeParse(row);
  if (!validated.success) {
    return Response.json(
      { error: "Validation failed", issues: validated.error.flatten() },
      { status: 400 }
    );
  }

  await db.insert(telemetries).values(validated.data);

  // Charging events: se in carica e non c'è evento aperto, creane uno
  if (isCharging && powerUsage != null && powerUsage > 0) {
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
}

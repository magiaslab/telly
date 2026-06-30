import {
  getV2cConnected,
  getV2cCurrentState,
  resolveV2cDeviceId,
} from "@/lib/v2c-api";

export const dynamic = "force-dynamic";

/** Stato in tempo reale della wallbox (charge state, potenza, intensità) + connettività. */
export async function GET() {
  const deviceId = await resolveV2cDeviceId();
  if (!deviceId) {
    return Response.json(
      { error: "Nessun deviceId V2C: imposta V2C_API_KEY (e opzionalmente V2C_DEVICE_ID)." },
      { status: 400 }
    );
  }

  try {
    const [state, connected] = await Promise.all([
      getV2cCurrentState(deviceId),
      getV2cConnected(deviceId),
    ]);
    return Response.json({ ok: true, deviceId, connected, state });
  } catch (e) {
    return Response.json(
      { error: "V2C status failed", details: String(e) },
      { status: 502 }
    );
  }
}

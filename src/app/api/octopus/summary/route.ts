import { getOctopusData, isOctopusConfigured } from "@/lib/octopus-api";

export const dynamic = "force-dynamic";

/** Riepilogo Octopus Energy: tariffa, dispositivo Intelligent, dispatch e risparmio stimato. */
export async function GET() {
  if (!isOctopusConfigured()) {
    return Response.json(
      { error: "Octopus non configurato: imposta OCTOPUS_EMAIL/OCTOPUS_PASSWORD/OCTOPUS_ACCOUNT_NUMBER." },
      { status: 400 }
    );
  }
  try {
    const data = await getOctopusData();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    return Response.json(
      { error: "Octopus summary failed", details: String(e) },
      { status: 502 }
    );
  }
}

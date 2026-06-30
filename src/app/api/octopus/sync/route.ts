import { syncOctopusCompletedDispatches, isOctopusConfigured } from "@/lib/octopus-api";

export const dynamic = "force-dynamic";

/**
 * Sincronizza le ultime finestre Intelligent Octopus (completedDispatches) in DB.
 * Ogni chiamata fa upsert incrementale: lo storico cresce nel tempo anche se l'API
 * espone solo le ricariche recenti.
 * Ideale da schedulare (cron Vercel) 1–2 volte al giorno oltre all'auto-sync in dashboard.
 */
export async function GET() {
  if (!isOctopusConfigured()) {
    return Response.json(
      {
        error:
          "Octopus non configurato: imposta OCTOPUS_EMAIL/OCTOPUS_PASSWORD/OCTOPUS_ACCOUNT_NUMBER.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await syncOctopusCompletedDispatches();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      { error: "Octopus sync failed", details: String(e) },
      { status: 502 }
    );
  }
}

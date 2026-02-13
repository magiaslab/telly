"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync(force: boolean) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sync${force ? "?force=true" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? `Errore ${res.status}`);
        return;
      }
      if (data.skipped) {
        setMessage("Auto in standby. Usa «Forza sync» per svegliarla.");
      } else {
        setMessage("Sync completato.");
        window.location.reload();
      }
    } catch (e) {
      setMessage("Errore di rete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSync(false)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Sync
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSync(true)}
          disabled={loading}
        >
          Forza sync
        </Button>
      </div>
      {message && (
        <p className="text-muted-foreground text-xs">{message}</p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

/**
 * Form per incollare il refresh token Tesla (alternativa quando OAuth dà Access Denied).
 * Salva il token in un cookie via API.
 */
export function TeslaPasteTokenForm() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const value = token.trim();
    if (!value) {
      setMessage({ type: "err", text: "Incolla il refresh token." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tesla/set-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: value }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? `Errore ${res.status}` });
        return;
      }
      setMessage({ type: "ok", text: "Token salvato. Ricarico i dati…" });
      setToken("");
      window.location.reload();
    } catch {
      setMessage({ type: "err", text: "Errore di rete." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Se vedi &quot;Access Denied&quot; su auth.tesla.com, ottieni il refresh token da un altro contesto (es. script locale o altra rete) e incollalo qui.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="tesla-token">Refresh token Tesla</Label>
        <Input
          id="tesla-token"
          type="password"
          placeholder="Incolla il token…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          className="font-mono text-sm"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={loading}>
        <KeyRound className="mr-2 h-4 w-4" />
        {loading ? "Salvataggio…" : "Salva token"}
      </Button>
      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-green-600 dark:text-green-400 text-sm"
              : "text-destructive text-sm"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

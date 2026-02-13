import { MOCK_VIN } from "./mock-tesla-factory";

/**
 * Toggle Mock Engine: quando true l'app usa dati mock invece della Tesla Fleet API.
 * Imposta NEXT_PUBLIC_USE_MOCK=true in .env per sviluppo senza VIN reale.
 */
export function useMock(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

/** VIN da usare per fetch/seed: reale o mock. */
export function getEffectiveVin(): string {
  if (process.env.TESLA_VIN) return process.env.TESLA_VIN;
  if (useMock()) return MOCK_VIN;
  return "";
}

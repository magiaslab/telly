"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Compositor Tesla: usato dalla pagina "Manage" dell'account Tesla per le immagini veicolo.
 * Non è documentato nella Fleet API (developer.tesla.com/docs/fleet-api); formato noto da fonti non ufficiali.
 * Può non rispondere o bloccare richieste da domini esterni. Usare usePlaceholderOnly o fallback onError.
 */
const COMPOSITOR_BASE = "https://static-assets.tesla.com/v1/compositor/";

/** Angoli di visuale supportati dal compositor Tesla (Model Y) */
export type TeslaViewAngle = "front" | "side" | "quarter";

const VIEW_CODES: Record<TeslaViewAngle, string> = {
  front: "STUD_FRONT",
  side: "S",
  quarter: "STUD_3QTR",
};

/** Option codes comuni per Model Y Long Range RWD (es. Telly) */
export const MODEL_Y_LR_RWD_OPTIONS = [
  "MDLY",   // Model Y
  "MTY13",  // Model Y Long Range Standard Range RWD (o MTY06/MTY07 per LR AWD)
  "DV2W",   // Rear-Wheel Drive
  "PPSW",   // Pearl White Multi-Coat (cambia con colore auto)
  "W38B",   // 19" Aero Wheels
  "INPB0",  // All Black Interior with Wood (Model Y)
  "APBS",   // Autopilot
  "BC3B",   // Black Brake Calipers
  "REEU",   // Region Europe (o RENA per NA)
].join(",");

export type TeslaVehicleImageProps = {
  /** Angolo: frontale, laterale, tre quarti */
  view?: TeslaViewAngle;
  /** Option codes comma-separated (default: Model Y LR RWD) */
  options?: string;
  /** Larghezza immagine in pixel (default 1440) */
  width?: number;
  /** Altezza immagine in pixel (opzionale) */
  height?: number;
  /** ClassName per il wrapper */
  className?: string;
  /** ClassName per l'img */
  imgClassName?: string;
  /** Alt text */
  alt?: string;
  /** Priorità di caricamento (priority = true per LCP) */
  priority?: boolean;
  /** Forza solo placeholder (simulazione, nessuna chiamata al compositor) */
  usePlaceholderOnly?: boolean;
};

function buildCompositorUrl(params: {
  view: TeslaViewAngle;
  options: string;
  width: number;
  height?: number;
}): string {
  const viewCode = VIEW_CODES[params.view];
  const search = new URLSearchParams();
  search.set("model", "my");
  search.set("view", viewCode);
  search.set("size", "1");
  search.set("size", String(params.width));
  if (params.height != null) {
    search.append("size", String(params.height));
  }
  search.set("options", params.options);
  return `${COMPOSITOR_BASE}?${search.toString()}`;
}

/** Placeholder SVG: Model Y stilizzato (silhouette tre quarti) */
function ModelYPlaceholder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full object-contain", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="car-shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="50%" stopColor="#3f3f46" />
          <stop offset="100%" stopColor="#27272a" />
        </linearGradient>
      </defs>
      {/* body */}
      <path
        d="M60 140 L80 120 L120 100 L200 90 L320 95 L360 110 L380 140 L375 175 L360 195 L320 205 L80 205 L50 180 Z"
        fill="url(#car-shine)"
        stroke="#52525b"
        strokeWidth="2"
      />
      {/* roof / cabin */}
      <path
        d="M120 100 L140 75 L260 70 L320 85 L340 105 L200 105 L140 105 Z"
        fill="#3f3f46"
        stroke="#52525b"
        strokeWidth="1.5"
      />
      {/* wheel */}
      <circle cx="120" cy="200" r="22" fill="#18181b" stroke="#52525b" strokeWidth="2" />
      <circle cx="120" cy="200" r="14" fill="#27272a" />
      <circle cx="280" cy="200" r="22" fill="#18181b" stroke="#52525b" strokeWidth="2" />
      <circle cx="280" cy="200" r="14" fill="#27272a" />
      {/* accent */}
      <path d="M140 85 L260 80" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}

export function TeslaVehicleImage({
  view = "quarter",
  options = MODEL_Y_LR_RWD_OPTIONS,
  width = 1440,
  height,
  className,
  imgClassName,
  alt = "Tesla Model Y",
  priority = false,
  usePlaceholderOnly = false,
}: TeslaVehicleImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = useMemo(
    () =>
      buildCompositorUrl({
        view,
        options,
        width,
        height,
      }),
    [view, options, width, height]
  );

  const showPlaceholder = usePlaceholderOnly || error;

  if (showPlaceholder) {
    return (
      <span
        className={cn("block overflow-hidden", className)}
        style={{ aspectRatio: height ? undefined : "16/10" }}
      >
        <div className="flex h-full w-full items-center justify-center bg-muted/30 transition-opacity duration-500 opacity-100">
          <ModelYPlaceholder className={cn("max-h-full", imgClassName)} />
        </div>
      </span>
    );
  }

  return (
    <span
      className={cn("block overflow-hidden", className)}
      style={{ aspectRatio: height ? undefined : "16/10" }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "h-full w-full object-contain transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
      />
    </span>
  );
}

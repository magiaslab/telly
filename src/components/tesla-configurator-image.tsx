"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Configurator Tesla Design Studio 2.
 * Nota: richiedendo l'URL da domini esterni il server restituisce 412 Precondition Failed
 * (probabile controllo Referer). Usare fallbackSrc o immagini locali in production.
 */
const CONFIGURATOR_BASE = "https://static-assets.tesla.com/configurator/compositor";

/** Option codes Design Studio 2 (con $): MTY52 Long Range RWD, PN01 Stealth Grey, WY19P 19", IPB11 interior */
export const MODEL_Y_LR_STEALTH_OPTIONS = "$MTY52,$PN01,$WY19P,$IPB11";

/** Viste supportate dal configurator */
export type ConfiguratorView = "FRONT34" | "SIDE" | "REAR34" | "STUD_3QTR";

const DEFAULT_VIEW: ConfiguratorView = "FRONT34";

export type TeslaConfiguratorImageProps = {
  /** Opzioni comma-separate con $ (es. $MTY52,$PN01,$WY19P,$IPB11) */
  options?: string;
  /** Vista: FRONT34, SIDE, REAR34, STUD_3QTR */
  view?: ConfiguratorView;
  /** Larghezza in pixel (default 1920) */
  size?: number;
  /** ClassName wrapper */
  className?: string;
  /** ClassName img */
  imgClassName?: string;
  alt?: string;
  priority?: boolean;
  /** Se true, mostra solo placeholder (nessuna richiesta) */
  usePlaceholderOnly?: boolean;
  /** URL immagine di fallback se il compositor fallisce */
  fallbackSrc?: string;
};

function buildConfiguratorUrl(params: {
  options: string;
  view: ConfiguratorView;
  size: number;
}): string {
  const search = new URLSearchParams({
    context: "design_studio_2",
    options: params.options,
    view: params.view,
    model: "my",
    size: String(params.size),
    bkba_opt: "2",
    crop: "0,0,0,0",
    overlay: "0",
  });
  return `${CONFIGURATOR_BASE}?${search.toString()}`;
}

/** Placeholder minimo quando immagine non disponibile */
function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted/30 text-muted-foreground text-sm",
        className
      )}
    >
      Model Y
    </div>
  );
}

export function TeslaConfiguratorImage({
  options = MODEL_Y_LR_STEALTH_OPTIONS,
  view = DEFAULT_VIEW,
  size = 1920,
  className,
  imgClassName,
  alt = "Tesla Model Y",
  priority = false,
  usePlaceholderOnly = false,
  fallbackSrc,
}: TeslaConfiguratorImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = useMemo(
    () => buildConfiguratorUrl({ options, view, size }),
    [options, view, size]
  );

  const showFallback = error && fallbackSrc;
  const showPlaceholder = usePlaceholderOnly || (error && !fallbackSrc);

  if (showPlaceholder) {
    return (
      <span className={cn("block overflow-hidden", className)} style={{ aspectRatio: "16/10" }}>
        <Placeholder className="h-full w-full" />
      </span>
    );
  }

  const imageSrc = showFallback ? fallbackSrc : src;

  return (
    <span className={cn("block overflow-hidden", className)} style={{ aspectRatio: "16/10" }}>
      <img
        src={imageSrc}
        alt={alt}
        width={size}
        height={Math.round((size * 10) / 16)}
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

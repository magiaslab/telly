"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type VehicleImageRealProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

/** Immagine veicolo reale con fade-in al caricamento */
export function VehicleImageReal({
  src,
  alt,
  width = 1280,
  height = 853,
  className,
  imgClassName,
  priority = false,
}: VehicleImageRealProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span
      className={cn("block overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "h-full w-full object-contain transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
        onLoad={() => setLoaded(true)}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 800px"
      />
    </span>
  );
}

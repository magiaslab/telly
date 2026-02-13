"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/** Path delle immagini compositor in public/vehicle (da 1 a 6) */
const COMPOSITOR_IMAGES = [
  "/vehicle/compositor (1).jpeg",
  "/vehicle/compositor (2).jpeg",
  "/vehicle/compositor (3).jpeg",
  "/vehicle/compositor (4).jpeg",
  "/vehicle/compositor (5).jpeg",
  "/vehicle/compositor (6).jpeg",
];

export function VehicleConfiguratorCarousel({ className }: { className?: string }) {
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  return (
    <Carousel
      opts={{ align: "center", loop: true }}
      className={cn("w-full", className)}
    >
      <CarouselContent className="ml-0">
        {COMPOSITOR_IMAGES.map((src, index) => (
          <CarouselItem key={index} className="pl-0 basis-full">
            <div className="relative w-full overflow-hidden bg-muted/20" style={{ aspectRatio: "16/10" }}>
              <Image
                src={src}
                alt={`Tesla Model Y — vista ${index + 1}`}
                fill
                className={cn(
                  "object-contain transition-opacity duration-300",
                  loaded[index] ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setLoaded((p) => ({ ...p, [index]: true }))}
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2 md:left-4" />
      <CarouselNext className="right-2 md:right-4" />
    </Carousel>
  );
}

"use client";

import { Map, MapControls, MapMarker, MarkerContent, MarkerPopup } from "@/components/ui/map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VehicleMapProps = {
  /** Latitudine (WGS84) */
  lat: number;
  /** Longitudine (WGS84) */
  lon: number;
  /** Altezza contenitore mappa (default 280px) */
  height?: string;
};

/**
 * Mappa MapLibre (mapcn) con marker sulla posizione del veicolo.
 * Center e marker usano [longitude, latitude] come da convenzione MapLibre.
 */
export function VehicleMap({ lat, lon, height = "280px" }: VehicleMapProps) {
  const center: [number, number] = [lon, lat];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Posizione veicolo</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div style={{ height }} className="w-full">
          <Map center={center} zoom={12}>
            <MapControls showZoom />
            <MapMarker longitude={lon} latitude={lat}>
              <MarkerContent>
                <div className="relative h-5 w-5 rounded-full border-2 border-white bg-primary shadow-md" />
              </MarkerContent>
              <MarkerPopup>
                <p className="font-mono text-xs text-muted-foreground">
                  {lat.toFixed(5)}, {lon.toFixed(5)}
                </p>
              </MarkerPopup>
            </MapMarker>
          </Map>
        </div>
      </CardContent>
    </Card>
  );
}

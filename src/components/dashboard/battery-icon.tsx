import { cn } from "@/lib/utils";

export function BatteryIcon({
  level,
  className,
  showLabel = true,
}: {
  level: number;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, level));
  const fillHeight = `${pct}%`;
  const isLow = pct < 20;
  const isCharging = false; // può essere passato come prop se serve

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative h-10 w-14 rounded border-2 border-current bg-muted/50"
        aria-hidden
      >
        <div
          className="absolute bottom-0 left-1 right-1 rounded-b-sm transition-all duration-500"
          style={{
            height: fillHeight,
            backgroundColor: isLow ? "var(--destructive)" : "var(--chart-1)",
          }}
        />
        {/* terminale batteria */}
        <div className="absolute -right-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r border border-current bg-muted" />
      </div>
      {showLabel && (
        <span className="text-2xl font-semibold tabular-nums">{Math.round(pct)}%</span>
      )}
    </div>
  );
}

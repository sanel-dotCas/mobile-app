import { Link } from "wouter";
import { useListYardLocations, getListYardLocationsQueryKey } from "@workspace/api-client-react";
import { MapPin, ChevronRight } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  DEALERSHIP_LOT: "Dealership Lot",
  YARD: "Yard",
  PARKING_AREA: "Parking Area",
  PORT: "Port",
};

const TYPE_COLORS: Record<string, string> = {
  DEALERSHIP_LOT: "text-[hsl(221,83%,53%)] bg-[hsl(221,83%,53%,0.1)]",
  YARD: "text-emerald-500 bg-emerald-500/10",
  PARKING_AREA: "text-amber-500 bg-amber-500/10",
  PORT: "text-purple-500 bg-purple-500/10",
};

export default function LocationsPage() {
  const { data: locations, isLoading } = useListYardLocations({
    query: { queryKey: getListYardLocationsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Yard Locations</h1>
        <p className="text-muted-foreground text-sm">{locations?.length ?? 0} locations configured</p>
      </div>

      <div className="grid gap-3">
        {(locations ?? []).map((loc) => {
          const utilPct = loc.totalCapacity > 0
            ? Math.round((loc.occupied / loc.totalCapacity) * 100)
            : 0;

          return (
            <Link
              key={loc.id}
              href={`/locations/${loc.id}`}
              data-testid={`card-location-${loc.id}`}
              className="block bg-card border border-card-border rounded-lg p-4 hover:border-[hsl(221,83%,53%)] transition-colors group"
            >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground truncate">{loc.name}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${TYPE_COLORS[loc.type] ?? "text-muted-foreground bg-muted"}`}>
                        {TYPE_LABELS[loc.type] ?? loc.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{loc.city}</p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">{loc.occupied}</span> / {loc.totalCapacity} occupied
                      </span>
                      <span className="text-muted-foreground">
                        <span className="text-amber-500 font-medium">{loc.readyPDI}</span> PDI pending
                      </span>
                      <span className="text-muted-foreground">
                        <span className="text-emerald-500 font-medium">{loc.readySale}</span> ready for sale
                      </span>
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">{loc.arrived}</span> arrived
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-lg font-bold text-foreground">{utilPct}%</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[hsl(221,83%,53%)] transition-colors" />
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="mt-3 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${utilPct}%`,
                      backgroundColor:
                        utilPct > 85 ? "hsl(0,84%,60%)" :
                        utilPct > 60 ? "hsl(43,74%,66%)" :
                        "hsl(221,83%,53%)",
                    }}
                  />
                </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

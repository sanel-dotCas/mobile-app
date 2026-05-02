import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  useGetYardLocation,
  getGetYardLocationQueryKey,
  useGetLocationMovementFeed,
  getGetLocationMovementFeedQueryKey,
  useUpdateYardSpot,
  getListYardLocationsQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Activity, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SpotStatus = "available" | "occupied" | "reserved" | "disabled";

const STATUS_STYLES: Record<SpotStatus, string> = {
  available: "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 hover:border-emerald-500",
  occupied: "bg-[hsl(221,83%,53%)]/15 border-[hsl(221,83%,53%)]/50 text-[hsl(221,83%,53%)] hover:border-[hsl(221,83%,53%)]",
  reserved: "bg-amber-500/15 border-amber-500/40 text-amber-600 hover:border-amber-500",
  disabled: "bg-muted border-border text-muted-foreground cursor-not-allowed",
};

const STATUS_DOT: Record<SpotStatus, string> = {
  available: "bg-emerald-500",
  occupied: "bg-[hsl(221,83%,53%)]",
  reserved: "bg-amber-500",
  disabled: "bg-muted-foreground",
};

type ZoneType = { id: number; name: string; type: string; spots: SpotType[] };
type SpotType = {
  id: number; code: string; status: SpotStatus; vehicleId: number | null;
  vehicle: VehicleType | null; reservedUntil: string | null; notes: string | null;
  spotType: string | null; timeInSpot: string | null;
};
type VehicleType = {
  id: number; vin: string; stockNumber: string; make: string; model: string;
  year: number; color: string | null; mileage: number | null; status: string;
  locationName: string | null; spotCode: string | null;
};

function SpotCard({
  spot,
  selected,
  onClick,
}: {
  spot: SpotType;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`spot-${spot.code}`}
      onClick={onClick}
      disabled={spot.status === "disabled"}
      className={`relative border rounded p-1.5 text-left transition-all text-[10px] font-mono font-semibold ${
        STATUS_STYLES[spot.status]
      } ${selected ? "ring-2 ring-[hsl(221,83%,53%)] ring-offset-1" : ""}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[spot.status]}`} />
        <span className="truncate">{spot.code}</span>
      </div>
      {spot.vehicle && (
        <span className="text-[9px] text-muted-foreground truncate block leading-tight">
          {spot.vehicle.make} {spot.vehicle.model}
        </span>
      )}
      {spot.timeInSpot && (
        <span className="text-[8px] text-muted-foreground block leading-tight">{spot.timeInSpot}</span>
      )}
    </button>
  );
}

function SpotDetail({
  spot,
  onClose,
  onAction,
  isPending,
}: {
  spot: SpotType;
  onClose: () => void;
  onAction: (action: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="w-72 shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Spot {spot.code}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-4 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${STATUS_DOT[spot.status]}`} />
          <span className="text-sm capitalize text-foreground font-medium">{spot.status}</span>
          {spot.timeInSpot && (
            <span className="text-xs text-muted-foreground ml-auto">{spot.timeInSpot}</span>
          )}
        </div>

        {/* Vehicle info */}
        {spot.vehicle ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vehicle</p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                {spot.vehicle.year} {spot.vehicle.make} {spot.vehicle.model}
              </p>
              <p className="text-xs text-muted-foreground font-mono">VIN: {spot.vehicle.vin}</p>
              <p className="text-xs text-muted-foreground">Stock: {spot.vehicle.stockNumber}</p>
              {spot.vehicle.color && (
                <p className="text-xs text-muted-foreground">Color: {spot.vehicle.color}</p>
              )}
              <div className="pt-1">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  spot.vehicle.status === "available" ? "bg-emerald-500/15 text-emerald-600" :
                  spot.vehicle.status === "pdi_pending" ? "bg-amber-500/15 text-amber-600" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {spot.vehicle.status?.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No vehicle assigned</p>
        )}

        {spot.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-foreground">{spot.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</p>
          {spot.status === "occupied" && (
            <button
              data-testid="button-release-spot"
              onClick={() => onAction("release")}
              disabled={isPending}
              className="w-full py-2 px-3 text-sm rounded border border-border text-foreground hover:border-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,53%)] transition-colors disabled:opacity-50"
            >
              Release Spot
            </button>
          )}
          {spot.status === "available" && (
            <button
              data-testid="button-reserve-spot"
              onClick={() => onAction("reserve")}
              disabled={isPending}
              className="w-full py-2 px-3 text-sm rounded border border-border text-foreground hover:border-amber-500 hover:text-amber-600 transition-colors disabled:opacity-50"
            >
              Reserve Spot
            </button>
          )}
          {(spot.status === "occupied" || spot.status === "reserved") && (
            <button
              data-testid="button-mark-pdi"
              onClick={() => onAction("pdi")}
              disabled={isPending}
              className="w-full py-2 px-3 text-sm rounded bg-[hsl(221,83%,53%)] text-white hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50"
            >
              Mark PDI Ready
            </button>
          )}
          {spot.status === "reserved" && (
            <button
              data-testid="button-unreserve-spot"
              onClick={() => onAction("unreserve")}
              disabled={isPending}
              className="w-full py-2 px-3 text-sm rounded border border-border text-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
            >
              Cancel Reservation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ALL_TAB = "All";
const ZONE_TABS = [ALL_TAB, "Available", "Occupied", "Reserved"];

export default function LocationDetailPage() {
  const params = useParams<{ locationId: string }>();
  const locationId = Number(params.locationId);
  const [, setLocation] = useLocation();
  const [selectedSpot, setSelectedSpot] = useState<SpotType | null>(null);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: location, isLoading } = useGetYardLocation(locationId, {
    query: {
      enabled: !!locationId,
      queryKey: getGetYardLocationQueryKey(locationId),
    },
  });

  const { data: movements } = useGetLocationMovementFeed(locationId, {
    query: {
      enabled: !!locationId,
      queryKey: getGetLocationMovementFeedQueryKey(locationId),
    },
  });

  const updateSpot = useUpdateYardSpot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetYardLocationQueryKey(locationId) });
        queryClient.invalidateQueries({ queryKey: getGetLocationMovementFeedQueryKey(locationId) });
        queryClient.invalidateQueries({ queryKey: getListYardLocationsQueryKey() });
        setSelectedSpot(null);
        toast({ title: "Spot updated" });
      },
      onError: () => {
        toast({ title: "Update failed", variant: "destructive" });
      },
    },
  });

  const handleAction = (action: string) => {
    if (!selectedSpot) return;
    if (action === "release") {
      updateSpot.mutate({ spotId: selectedSpot.id, data: { status: "available", vehicleId: null } });
    } else if (action === "reserve") {
      updateSpot.mutate({ spotId: selectedSpot.id, data: { status: "reserved" } });
    } else if (action === "unreserve") {
      updateSpot.mutate({ spotId: selectedSpot.id, data: { status: "available" } });
    } else if (action === "pdi") {
      updateSpot.mutate({ spotId: selectedSpot.id, data: { notes: "PDI Ready — pending inspection queue" } });
    }
  };

  const filterSpots = (spots: SpotType[]) => {
    if (activeTab === ALL_TAB) return spots;
    return spots.filter((s) => s.status === activeTab.toLowerCase());
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!location) {
    return <div className="p-6 text-muted-foreground">Location not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => setLocation("/locations")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{location.name}</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">{location.city}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><span className="text-foreground font-medium">{location.occupied}</span> / {location.totalCapacity} occupied</span>
          <span><span className="text-amber-500 font-medium">{location.readyPDI}</span> PDI pending</span>
          <span><span className="text-emerald-500 font-medium">{location.readySale}</span> ready for sale</span>
        </div>
      </div>

      {/* Zone tabs */}
      <div className="px-6 pt-3 pb-0 border-b border-border shrink-0">
        <div className="flex gap-1">
          {ZONE_TABS.map((tab) => (
            <button
              key={tab}
              data-testid={`tab-${tab.toLowerCase()}`}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${
                activeTab === tab
                  ? "text-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)]"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Spot grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {(location.zones ?? []).map((zone: ZoneType) => {
            const filtered = filterSpots(zone.spots as SpotType[]);
            if (filtered.length === 0 && activeTab !== ALL_TAB) return null;
            return (
              <div key={zone.id} data-testid={`zone-${zone.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{zone.name}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {zone.spots.filter((s: SpotType) => s.status === "available").length} available / {zone.spots.length} total
                  </span>
                </div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
                  {filtered.map((spot: SpotType) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      selected={selectedSpot?.id === spot.id}
                      onClick={() =>
                        setSelectedSpot(selectedSpot?.id === spot.id ? null : spot)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            {(Object.entries(STATUS_DOT) as [SpotStatus, string][]).map(([status, dot]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spot detail panel */}
        {selectedSpot && (
          <SpotDetail
            spot={selectedSpot}
            onClose={() => setSelectedSpot(null)}
            onAction={handleAction}
            isPending={updateSpot.isPending}
          />
        )}

        {/* Movement feed (only when no spot selected) */}
        {!selectedSpot && (
          <div className="w-64 shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Activity</h3>
            </div>
            <div className="divide-y divide-border" data-testid="location-movement-feed">
              {(movements ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No activity</p>
              ) : (
                (movements ?? []).map((m) => (
                  <div key={m.id} className="px-3 py-2.5">
                    <p className="text-xs text-foreground leading-snug">{m.action}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.actor} · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

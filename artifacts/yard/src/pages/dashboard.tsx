import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  useGetYardDashboardStats,
  getGetYardDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { Car, MapPin, ClipboardCheck, TrendingUp, ArrowRight, Activity, Search } from "lucide-react";
import { Link } from "wouter";

type Vehicle = {
  id: number; make: string; model: string; year: number;
  stockNumber: string; vin: string; status: string;
  locationName: string | null; spotCode: string | null;
};

type DashboardStats = {
  totalCapacity: number; totalOccupied: number; readyForPDI: number;
  readyForSale: number; expectedInbound: number; arrivingToday: number;
  totalLocations: number;
  recentMovements: { id: number; action: string; actor: string; createdAt: string; locationName: string }[];
};

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-600",
  in_transit: "bg-amber-500/15 text-amber-600",
  pdi_pending: "bg-[hsl(221,83%,53%)]/15 text-[hsl(221,83%,53%)]",
  sold: "bg-muted text-muted-foreground",
};

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; accent?: string;
}) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`} className="bg-card border border-card-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${accent ?? "text-foreground"}`}>{value}</p>
          {sub && <p className="text-muted-foreground text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function VehicleSearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data, isFetching } = useQuery<{ vehicles: Vehicle[]; total: number }>({
    queryKey: ["vehicle-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { vehicles: [], total: 0 };
      const qs = new URLSearchParams({ q: debouncedQuery, limit: "8" });
      const r = await fetch(`/api/yard/vehicles?${qs}`, { credentials: "include" });
      return r.json();
    },
    enabled: debouncedQuery.trim().length > 1,
  });

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout((handleChange as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleChange as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebouncedQuery(val);
    }, 300);
  };

  const showResults = debouncedQuery.trim().length > 1;
  const vehicles = data?.vehicles ?? [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          data-testid="input-global-search"
          type="search"
          placeholder="Search vehicles across all branches — VIN, stock #, make, model..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)] shadow-sm"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[hsl(221,83%,53%)] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card border border-card-border rounded-lg shadow-lg overflow-hidden">
          {vehicles.length === 0 && !isFetching ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No vehicles found for "{debouncedQuery}"
            </div>
          ) : (
            <>
              {vehicles.map((v) => (
                <Link
                  key={v.id}
                  href="/inventory"
                  onClick={() => { setQuery(""); setDebouncedQuery(""); }}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {v.stockNumber} · {v.vin}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.locationName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {v.locationName}
                        {v.spotCode && <span className="font-mono">· {v.spotCode}</span>}
                      </div>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[v.status] ?? "bg-muted text-muted-foreground"}`}>
                      {v.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
              {(data?.total ?? 0) > 8 && (
                <Link href="/inventory" onClick={() => { setQuery(""); setDebouncedQuery(""); }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-[hsl(221,83%,53%)] hover:bg-muted/30 transition-colors border-t border-border">
                  View all {data?.total} results in Inventory <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetYardDashboardStats({
    query: { queryKey: getGetYardDashboardStatsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const typedStats = stats as DashboardStats | undefined;
  const utilizationPct = typedStats
    ? Math.round((typedStats.totalOccupied / Math.max(typedStats.totalCapacity, 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Multi-branch search bar */}
      <VehicleSearchBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Operations Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time yard overview · {typedStats?.totalLocations ?? 0} locations</p>
        </div>
        <Link href="/locations" className="flex items-center gap-1.5 text-sm text-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,45%)] transition-colors">
          View locations <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Capacity"
          value={typedStats?.totalCapacity ?? 0}
          sub={`${typedStats?.totalLocations ?? 0} locations`}
          icon={MapPin}
        />
        <StatCard
          label="Vehicles In Yard"
          value={typedStats?.totalOccupied ?? 0}
          sub={`${utilizationPct}% utilization`}
          icon={Car}
          accent="text-[hsl(221,83%,53%)]"
        />
        <StatCard
          label="Ready for PDI"
          value={typedStats?.readyForPDI ?? 0}
          sub="Pending inspection"
          icon={ClipboardCheck}
          accent={typedStats?.readyForPDI ? "text-amber-500" : undefined}
        />
        <StatCard
          label="In Transit"
          value={typedStats?.expectedInbound ?? 0}
          sub={`${typedStats?.arrivingToday ?? 0} arriving today`}
          icon={TrendingUp}
          accent={typedStats?.expectedInbound ? "text-emerald-500" : undefined}
        />
      </div>

      {/* Capacity bar */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Yard Utilization</p>
          <span className="text-sm text-muted-foreground">{typedStats?.totalOccupied ?? 0} / {typedStats?.totalCapacity ?? 0} spots</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[hsl(221,83%,53%)] rounded-full transition-all duration-500"
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-muted-foreground">0%</span>
          <span className="text-xs text-muted-foreground">{utilizationPct}%</span>
          <span className="text-xs text-muted-foreground">100%</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Link href="/locations" data-testid="link-locations" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors">
          <MapPin className="w-5 h-5 text-[hsl(221,83%,53%)]" />
          <div>
            <p className="text-sm font-medium text-foreground">Manage Locations</p>
            <p className="text-xs text-muted-foreground">View spot grids</p>
          </div>
        </Link>
        <Link href="/inventory" data-testid="link-inventory" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors">
          <Car className="w-5 h-5 text-[hsl(221,83%,53%)]" />
          <div>
            <p className="text-sm font-medium text-foreground">Vehicle Inventory</p>
            <p className="text-xs text-muted-foreground">{typedStats ? typedStats.totalOccupied + typedStats.expectedInbound : 0} vehicles tracked</p>
          </div>
        </Link>
        <Link href="/inspections" data-testid="link-inspections" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors">
          <ClipboardCheck className="w-5 h-5 text-[hsl(221,83%,53%)]" />
          <div>
            <p className="text-sm font-medium text-foreground">PDI Inspections</p>
            <p className="text-xs text-muted-foreground">{typedStats?.readyForPDI ?? 0} pending</p>
          </div>
        </Link>
        <Link href="/transfers" data-testid="link-transfers" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors">
          <TrendingUp className="w-5 h-5 text-[hsl(221,83%,53%)]" />
          <div>
            <p className="text-sm font-medium text-foreground">Transfers</p>
            <p className="text-xs text-muted-foreground">Yard → Showroom</p>
          </div>
        </Link>
      </div>

      {/* Movement feed */}
      <div className="bg-card border border-card-border rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
          <span className="ml-auto text-xs text-muted-foreground">All Locations</span>
        </div>
        <div className="divide-y divide-border" data-testid="movement-feed">
          {(typedStats?.recentMovements ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recent activity</p>
          ) : (
            (typedStats?.recentMovements ?? []).map((m) => (
              <div key={m.id} data-testid={`movement-item-${m.id}`} className="px-4 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(221,83%,53%)] mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  {m.locationName && (
                    <p className="text-[10px] font-semibold text-[hsl(221,83%,53%)] uppercase tracking-wide mb-0.5">{m.locationName}</p>
                  )}
                  <p className="text-sm text-foreground truncate">{m.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.actor} · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

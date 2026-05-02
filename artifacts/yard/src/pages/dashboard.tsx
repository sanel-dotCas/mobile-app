import { formatDistanceToNow } from "date-fns";
import {
  useGetYardDashboardStats,
  getGetYardDashboardStatsQueryKey,
  useGetLocationMovementFeed,
  getGetLocationMovementFeedQueryKey,
} from "@workspace/api-client-react";
import { Car, MapPin, ClipboardCheck, TrendingUp, ArrowRight, Activity } from "lucide-react";
import { Link } from "wouter";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
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

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetYardDashboardStats({
    query: { queryKey: getGetYardDashboardStatsQueryKey() },
  });

  const { data: movements } = useGetLocationMovementFeed(1, {
    query: { queryKey: getGetLocationMovementFeedQueryKey(1), enabled: true },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const utilizationPct = stats
    ? Math.round((stats.totalOccupied / Math.max(stats.totalCapacity, 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Operations Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time yard overview</p>
        </div>
        <Link href="/locations" className="flex items-center gap-1.5 text-sm text-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,45%)] transition-colors">
          View locations <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Capacity"
          value={stats?.totalCapacity ?? 0}
          sub={`${stats?.totalLocations ?? 0} locations`}
          icon={MapPin}
        />
        <StatCard
          label="Vehicles In Yard"
          value={stats?.totalOccupied ?? 0}
          sub={`${utilizationPct}% utilization`}
          icon={Car}
          accent="text-[hsl(221,83%,53%)]"
        />
        <StatCard
          label="Ready for PDI"
          value={stats?.readyForPDI ?? 0}
          sub="Pending inspection"
          icon={ClipboardCheck}
          accent={stats?.readyForPDI ? "text-amber-500" : undefined}
        />
        <StatCard
          label="In Transit"
          value={stats?.expectedInbound ?? 0}
          sub={`${stats?.arrivingToday ?? 0} arriving today`}
          icon={TrendingUp}
          accent={stats?.expectedInbound ? "text-emerald-500" : undefined}
        />
      </div>

      {/* Capacity bar */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Yard Utilization</p>
          <span className="text-sm text-muted-foreground">{stats?.totalOccupied ?? 0} / {stats?.totalCapacity ?? 0} spots</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/locations" data-testid="link-locations" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors group">
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
            <p className="text-xs text-muted-foreground">{stats ? stats.totalOccupied + stats.expectedInbound : 0} vehicles tracked</p>
          </div>
        </Link>
        <Link href="/inspections" data-testid="link-inspections" className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3 hover:border-[hsl(221,83%,53%)] transition-colors">
          <ClipboardCheck className="w-5 h-5 text-[hsl(221,83%,53%)]" />
          <div>
            <p className="text-sm font-medium text-foreground">PDI Inspections</p>
            <p className="text-xs text-muted-foreground">{stats?.readyForPDI ?? 0} pending</p>
          </div>
        </Link>
      </div>

      {/* Movement feed */}
      <div className="bg-card border border-card-border rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
          <span className="ml-auto text-xs text-muted-foreground">Al Khor</span>
        </div>
        <div className="divide-y divide-border" data-testid="movement-feed">
          {(movements ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recent activity</p>
          ) : (
            (movements ?? []).map((m) => (
              <div key={m.id} data-testid={`movement-item-${m.id}`} className="px-4 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(221,83%,53%)] mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
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

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Car, ClipboardList, Briefcase, Wrench, Users, MapPin, Package, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  vehicles: { total: number; byStatus: Record<string, number> };
  inspections: { total: number; byStatus: Record<string, number> };
  jobs: { total: number; byStatus: Record<string, number> };
  technicians: number;
  users: number;
  locations: number;
  servicePackages: number;
}

interface Movement {
  id: number;
  vehicleId: number;
  type: string;
  fromLocationId: number | null;
  toLocationId: number | null;
  createdAt: string;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  sold: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  maintenance: "bg-orange-100 text-orange-800",
  "in-progress": "bg-blue-100 text-blue-800",
  queued: "bg-amber-100 text-amber-800",
  finished: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

function StatCard({
  label,
  value,
  icon,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="bg-card border border-card-border rounded-xl p-5 shadow-xs"
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color ?? "bg-primary/10 text-primary")}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBreakdown({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{label} by Status</p>
      <div className="space-y-2">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between">
            <span
              className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700")}
            >
              {status.replace(/-/g, " ")}
            </span>
            <span className="text-sm font-semibold text-foreground" data-testid={`status-${label.toLowerCase()}-${status}`}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats", { headers }).then((r) => r.json()),
  });

  const { data: activityData } = useQuery<{ activity: Movement[] }>({
    queryKey: ["admin-activity"],
    queryFn: () => fetch("/api/admin/activity", { headers }).then((r) => r.json()),
  });

  const activity = activityData?.activity ?? [];

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Vehicles" value={stats?.vehicles.total ?? 0} icon={<Car size={16} />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Inspections" value={stats?.inspections.total ?? 0} icon={<ClipboardList size={16} />} color="bg-purple-50 text-purple-600" />
        <StatCard label="Jobs" value={stats?.jobs.total ?? 0} icon={<Briefcase size={16} />} color="bg-amber-50 text-amber-600" />
        <StatCard label="Technicians" value={stats?.technicians ?? 0} icon={<Wrench size={16} />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="System Users" value={stats?.users ?? 0} icon={<Users size={16} />} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Locations" value={stats?.locations ?? 0} icon={<MapPin size={16} />} color="bg-rose-50 text-rose-600" />
        <StatCard label="Service Packages" value={stats?.servicePackages ?? 0} icon={<Package size={16} />} color="bg-cyan-50 text-cyan-600" />
        <StatCard
          label="Active Inspections"
          value={stats?.inspections.byStatus?.["in-progress"] ?? 0}
          icon={<Activity size={16} />}
          color="bg-orange-50 text-orange-600"
          sub="currently in progress"
        />
      </div>

      {/* Status breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats && <StatusBreakdown label="Vehicles" data={stats.vehicles.byStatus} />}
        {stats && <StatusBreakdown label="Inspections" data={stats.inspections.byStatus} />}
        {stats && <StatusBreakdown label="Jobs" data={stats.jobs.byStatus} />}
      </div>

      {/* Activity feed */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
        <p className="text-sm font-semibold text-foreground mb-4">Recent Activity</p>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 15).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`row-activity-${m.id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-foreground capitalize">{m.type?.replace(/-/g, " ") ?? "Movement"}</span>
                  <span className="text-xs text-muted-foreground">Vehicle #{m.vehicleId}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

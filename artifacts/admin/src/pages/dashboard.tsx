import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Car, 
  ClipboardCheck, 
  Briefcase, 
  Wrench, 
  Users, 
  MapPin,
  ArrowUpRight,
  TrendingUp,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: number;
  icon: any;
  subtext?: string;
  breakdown?: Record<string, number>;
  colors?: Record<string, string>;
}

const StatCard = ({ title, value, icon: Icon, breakdown, colors }: StatCardProps) => (
  <Card className="overflow-hidden border-slate-200 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</CardTitle>
      <div className="p-2 bg-slate-50 rounded-lg">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      {breakdown && (
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(breakdown).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
              <div className={cn("w-2 h-2 rounded-full", colors?.[status] || "bg-slate-400")} />
              <span className="text-[10px] font-semibold text-slate-600 uppercase">
                {status.replace('_', ' ')}: {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api("/admin/stats"),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => api("/admin/activity"),
  });

  const vehicleColors = {
    available: "bg-green-500",
    in_transit: "bg-blue-500",
    pdi_pending: "bg-amber-500",
    sold: "bg-slate-400",
  };

  const inspectionColors = {
    finished: "bg-green-500",
    "in-progress": "bg-amber-500",
    queued: "bg-blue-500",
  };

  const jobColors = {
    active: "bg-blue-500",
    pending: "bg-amber-500",
    completed: "bg-green-500",
    cancelled: "bg-slate-400",
  };

  if (statsLoading || activityLoading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500">Real-time system health and activity</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 gap-1 bg-white">
          <Clock className="w-3 h-3 text-slate-500" />
          Last updated: {format(new Date(), "HH:mm")}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          title="Total Vehicles" 
          value={stats.vehicles.total} 
          icon={Car} 
          breakdown={stats.vehicles.byStatus}
          colors={vehicleColors}
        />
        <StatCard 
          title="Active Inspections" 
          value={stats.inspections.total} 
          icon={ClipboardCheck} 
          breakdown={stats.inspections.byStatus}
          colors={inspectionColors}
        />
        <StatCard 
          title="Total Jobs" 
          value={stats.jobs.total} 
          icon={Briefcase} 
          breakdown={stats.jobs.byStatus}
          colors={jobColors}
        />
        <StatCard title="Technicians" value={stats.technicians} icon={Wrench} />
        <StatCard title="System Users" value={stats.users} icon={Users} />
        <StatCard title="Locations" value={stats.locations} icon={MapPin} />
      </div>

      {/* Activity Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Recent System Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              View All <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Vehicle / Subject</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User / Source</TableHead>
                <TableHead className="text-right">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.activity.map((item: any, i: number) => (
                <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-medium text-slate-500 whitespace-nowrap">
                    {format(new Date(item.timestamp), "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                         <Car className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-900">{item.vehicleName || item.vin || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-white capitalize">
                      {item.action?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 font-medium">{item.user || 'System'}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {item.location || 'HQ'}
                  </TableCell>
                </TableRow>
              ))}
              {activity.activity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    No recent activity found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

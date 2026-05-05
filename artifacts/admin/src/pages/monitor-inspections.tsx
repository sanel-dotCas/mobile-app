import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  ClipboardCheck, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  MapPin,
  Calendar,
  User,
  Activity
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MonitorInspectionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [locationId, setLocationId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monitor", "inspections", page, status, locationId],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (status !== "all") params.append("status", status);
      if (locationId) params.append("locationId", locationId);
      return api(`/admin/monitor/inspections?${params.toString()}`);
    },
  });

  const statusColors = {
    finished: "bg-green-100 text-green-700 border-green-200",
    "in-progress": "bg-amber-100 text-amber-700 border-amber-200",
    queued: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inspection Monitor</h1>
          <p className="text-slate-500">Real-time status of all yard inspections</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Filter className="w-3 h-3" /> Status
          </label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Location ID
          </label>
          <Input 
            placeholder="e.g. 1" 
            className="w-[120px]" 
            value={locationId}
            onChange={(e) => { setLocationId(e.target.value); setPage(1); }}
          />
        </div>
        <Button variant="outline" onClick={() => { setStatus("all"); setLocationId(""); setPage(1); }} className="text-slate-500">
          Reset
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Inspection ID</TableHead>
              <TableHead>Vehicle Ref</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : data?.inspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center text-slate-500 italic">
                  No inspections found.
                </TableCell>
              </TableRow>
            ) : data?.inspections.map((ins: any) => (
              <TableRow key={ins.id} className="hover:bg-slate-50/50">
                <TableCell className="font-mono font-bold text-slate-900">
                  #{ins.id.toString().padStart(6, '0')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-blue-600">V-{ins.vehicleId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 capitalize font-medium">
                    {ins.type?.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize font-bold tracking-tight px-2.5 py-0.5", statusColors[ins.status as keyof typeof statusColors])}>
                    {ins.status?.replace('-', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{ins.assignedToName || 'Unassigned'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {ins.locationName || `ID: ${ins.locationId}`}
                  </div>
                </TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(ins.createdAt), "MMM d, HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination same as vehicles */}
        {data && data.total > PAGE_SIZE && (
           <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
             <span className="text-sm text-slate-500 font-medium">
               Total <span className="text-slate-900">{data.total}</span> records
             </span>
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                 Previous
               </Button>
               <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                 Next
               </Button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}

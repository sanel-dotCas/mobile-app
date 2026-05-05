import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Car, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  MapPin,
  Calendar
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

export default function MonitorVehiclesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [locationId, setLocationId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monitor", "vehicles", page, status, locationId],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (status !== "all") params.append("status", status);
      if (locationId) params.append("locationId", locationId);
      return api(`/admin/monitor/vehicles?${params.toString()}`);
    },
  });

  const statusColors = {
    available: "bg-green-100 text-green-700 border-green-200",
    in_transit: "bg-blue-100 text-blue-700 border-blue-200",
    pdi_pending: "bg-amber-100 text-amber-700 border-amber-200",
    sold: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicle Monitor</h1>
          <p className="text-slate-500">Live inventory tracking across all yards</p>
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
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="pdi_pending">PDI Pending</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
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
          Reset Filters
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>VIN / Plate</TableHead>
              <TableHead>Vehicle Details</TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Tracked Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : data?.vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center text-slate-500 italic">
                  No vehicles found matching criteria.
                </TableCell>
              </TableRow>
            ) : data?.vehicles.map((v: any) => (
              <TableRow key={v.id} className="hover:bg-slate-50/50">
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-mono font-bold text-slate-900">{v.vin}</div>
                    {v.licensePlate && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-[10px]">
                        {v.licensePlate}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{v.make} {v.model}</div>
                      <div className="text-xs text-slate-500 font-medium">{v.year} • {v.color || 'N/A'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize font-bold tracking-tight px-3 py-1", statusColors[v.status as keyof typeof statusColors])}>
                    {v.status?.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {v.locationName || `Yard ID: ${v.locationId}`}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(v.createdAt), "MMM d, yyyy")}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">
              Showing <span className="text-slate-900">{(page - 1) * PAGE_SIZE + 1}</span> to <span className="text-slate-900">{Math.min(page * PAGE_SIZE, data.total)}</span> of <span className="text-slate-900">{data.total}</span> vehicles
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pageNum = page - 2 + i;
                  }
                  if (pageNum > totalPages) return null;
                  return (
                    <Button 
                      key={pageNum} 
                      variant={page === pageNum ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className={cn("h-8 w-8 p-0", page === pageNum && "bg-blue-600 hover:bg-blue-700")}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

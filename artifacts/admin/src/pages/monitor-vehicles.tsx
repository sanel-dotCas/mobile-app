import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: number;
  vin: string;
  make: string;
  model: string;
  year: number;
  status: string;
  stockNumber: string;
  locationId: number | null;
  color: string | null;
  mileage: number | null;
  createdAt: string;
}

interface VehicleResponse {
  vehicles: Vehicle[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  sold: "bg-blue-100 text-blue-800",
  in_transit: "bg-cyan-100 text-cyan-800",
  pdi_pending: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  maintenance: "bg-orange-100 text-orange-800",
  reserved: "bg-purple-100 text-purple-800",
};

const PAGE_SIZE = 20;

export default function MonitorVehiclesPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<VehicleResponse>({
    queryKey: ["admin-monitor-vehicles", page],
    queryFn: () => fetch(`/api/admin/monitor/vehicles?page=${page}&limit=${PAGE_SIZE}`, { headers }).then((r) => r.json()),
  });

  const vehicles = data?.vehicles ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-monitor-vehicles">Vehicle Inventory Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{total} vehicles total</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No vehicles found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Stock #</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Color</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Mileage</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Added</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-vehicle-${v.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{v.year} {v.make} {v.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{v.vin || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.stockNumber || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.color || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{v.mileage != null ? `${v.mileage.toLocaleString()} km` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[v.status] ?? "bg-gray-100 text-gray-700")}>
                        {v.status?.replace(/_/g, " ").replace(/-/g, " ") ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(v.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1} data-testid="button-prev-page"><ChevronLeft size={14} /></Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} data-testid="button-next-page"><ChevronRight size={14} /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Inspection {
  id: number;
  vehicleId: number;
  type: string;
  status: string;
  technicianId: string | null;
  result: string | null;
  createdAt: string;
}

interface InspectionResponse {
  inspections: Inspection[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-amber-100 text-amber-800",
  "in-progress": "bg-blue-100 text-blue-800",
  finished: "bg-emerald-100 text-emerald-800",
};

const RESULT_COLORS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  fail: "bg-red-100 text-red-800",
};

const PAGE_SIZE = 20;
const STATUS_FILTERS = ["all", "queued", "in-progress", "finished"];

export default function MonitorInspectionsPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery<InspectionResponse>({
    queryKey: ["admin-monitor-inspections", page, status],
    queryFn: () => fetch(`/api/admin/monitor/inspections?page=${page}&limit=${PAGE_SIZE}&status=${status}`, { headers }).then((r) => r.json()),
  });

  const inspections = data?.inspections ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-monitor-inspections">Inspections Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{total} inspections</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
              status === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-muted"
            )}
            data-testid={`filter-status-${s}`}
          >
            {s === "all" ? "All" : s.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : inspections.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No inspections found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Result</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((insp) => (
                  <tr key={insp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-inspection-${insp.id}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{insp.id}</td>
                    <td className="px-4 py-3 text-foreground">Vehicle #{insp.vehicleId}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{insp.type?.replace(/-/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[insp.status] ?? "bg-gray-100 text-gray-700")}>
                        {insp.status?.replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {insp.result ? (
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", RESULT_COLORS[insp.result] ?? "bg-gray-100 text-gray-700")}>
                          {insp.result}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(insp.createdAt).toLocaleDateString()}</td>
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

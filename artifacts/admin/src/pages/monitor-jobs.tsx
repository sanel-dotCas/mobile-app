import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  estimateNumber: string;
  licensePlate: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  status: string;
  progress: number;
  assignedTechnicianId: string | null;
  serviceAdvisor: string;
  appointmentDate: string;
  createdAt: string;
}

interface JobResponse {
  jobs: Job[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  "in-progress": "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  on_hold: "bg-gray-100 text-gray-700",
};

const PAGE_SIZE = 20;

export default function MonitorJobsPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<JobResponse>({
    queryKey: ["admin-monitor-jobs", page],
    queryFn: () => fetch(`/api/admin/monitor/jobs?page=${page}&limit=${PAGE_SIZE}`, { headers }).then((r) => r.json()),
  });

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-monitor-jobs">Workshop Jobs Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{total} jobs total</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No jobs found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estimate #</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Progress</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Advisor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-job-${j.id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{j.estimateNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-foreground">{[j.vehicleYear, j.vehicleMake, j.vehicleModel].filter(Boolean).join(" ") || "—"}</span>
                        <p className="text-xs text-muted-foreground">{j.licensePlate}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[j.status] ?? "bg-gray-100 text-gray-700")}>
                        {j.status?.replace(/_/g, " ").replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${j.progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{j.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{j.serviceAdvisor || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{j.appointmentDate}</td>
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

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Briefcase, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Car,
  Calendar,
  User,
  Clock,
  CheckCircle2
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
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MonitorJobsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monitor", "jobs", page],
    queryFn: () => api(`/admin/monitor/jobs?page=${page}&limit=${PAGE_SIZE}`),
  });

  const statusColors = {
    active: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jobs Monitor</h1>
          <p className="text-slate-500">Workshop job progress and technician assignments</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Estimate / Plate</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Technician / Advisor</TableHead>
              <TableHead>Appointment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : data?.jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center text-slate-500 italic">
                  No active workshop jobs.
                </TableCell>
              </TableRow>
            ) : data?.jobs.map((job: any) => (
              <TableRow key={job.id} className="hover:bg-slate-50/50">
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">#{job.estimateNumber}</div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono text-[10px]">
                      {job.licensePlate || 'NO PLATE'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-semibold text-slate-800">{job.vehicleName}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{job.vin?.slice(-6)}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize font-bold tracking-tight px-3 py-1", statusColors[job.status as keyof typeof statusColors])}>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell className="w-[180px]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                      <span>Progress</span>
                      <span className={job.progress === 100 ? "text-green-600" : "text-blue-600"}>
                        {job.progress}%
                      </span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {job.technicianName || 'Pending Assignment'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight pl-5">
                      Adv: {job.serviceAdvisor || 'N/A'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-slate-600 text-sm">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {format(new Date(job.appointmentDate), "MMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(job.appointmentDate), "HH:mm")}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {data && data.total > PAGE_SIZE && (
           <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
             <span className="text-sm text-slate-500 font-medium">
                Showing jobs {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, data.total)}
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

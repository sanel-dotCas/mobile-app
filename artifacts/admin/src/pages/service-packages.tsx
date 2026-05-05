import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Package, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Search,
  Loader2,
  Info
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
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ServicePackagesPage() {
  const [search, setSearch] = useState("");

  const { data: packages, isLoading } = useQuery({
    queryKey: ["admin", "service-packages"],
    queryFn: () => api("/admin/service-packages"),
  });

  const filtered = packages?.filter((p: any) => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Packages</h1>
          <p className="text-slate-500">Standardized service and inspection templates</p>
        </div>
      </div>

      <Alert className="bg-slate-50 border-slate-200">
        <Info className="h-4 w-4 text-slate-500" />
        <AlertTitle className="font-semibold text-slate-900">Read Only</AlertTitle>
        <AlertDescription className="text-slate-600">
          Service packages are managed through the Service Definition module. Contact headquarters for new package templates.
        </AlertDescription>
      </Alert>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Filter packages..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No service packages found.
                </TableCell>
              </TableRow>
            ) : filtered?.map((pkg: any) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center border",
                      pkg.color ? `bg-${pkg.color}-50 border-${pkg.color}-100 text-${pkg.color}-600` : "bg-slate-50 border-slate-100 text-slate-600"
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-slate-900">{pkg.name}</div>
                  </div>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="text-sm text-slate-600 line-clamp-2">{pkg.description || 'No description provided.'}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Layers className="w-4 h-4 text-slate-400" />
                    {pkg.lineCount || 0}
                  </div>
                </TableCell>
                <TableCell>
                  {pkg.isActive ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1">
                      <XCircle className="w-3 h-3" /> Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-slate-500 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(pkg.createdAt || Date.now()), "MMM d, yyyy")}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

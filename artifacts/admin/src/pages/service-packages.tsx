import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/hooks/use-auth";
import {
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  Calendar,
  Search,
  Loader2,
  Upload,
  Plus,
  Network,
  Tag,
  Cpu,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ServicePackagesPage() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: packages, isLoading } = useQuery({
    queryKey: ["admin", "service-packages"],
    queryFn: () => api("/admin/service-packages"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api(`/admin/service-packages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Package deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "service-packages"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteTarget(null);
    },
  });

  const filtered = packages?.filter(
    (p: any) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.vehicleModel?.toLowerCase().includes(search.toLowerCase()) ||
      p.bundleCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Packages</h1>
          <p className="text-slate-500">Standardized service and inspection templates</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/master/service-packages/import")}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Kits
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/master/service-packages/deploy")}
          >
            <Network className="w-4 h-4 mr-2" />
            Deploy
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate("/master/service-packages/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Package
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search packages, models, bundle codes..."
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
              <TableHead>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  Vehicle Model
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Interval
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  Bundle Code
                </div>
              </TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                  No service packages found.
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((pkg: any) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0"
                        style={{ backgroundColor: `${pkg.color}18`, borderColor: `${pkg.color}30` }}
                      >
                        <Package className="w-4 h-4" style={{ color: pkg.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{pkg.name}</div>
                        {pkg.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">{pkg.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.vehicleModel ? (
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-mono text-xs">
                        {pkg.vehicleModel}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {pkg.serviceInterval ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {pkg.bundleCode ? (
                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono border border-blue-100">
                        {pkg.bundleCode}
                      </code>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        onClick={() => navigate(`/master/service-packages/${pkg.id}/edit`)}
                        title="Edit package"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => setDeleteTarget({ id: pkg.id, name: pkg.name })}
                        title="Delete package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service package?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> and all its line items will be permanently deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

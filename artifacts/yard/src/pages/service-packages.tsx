import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Package, AlertCircle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ServicePackageLine = {
  id: number;
  packageId: number;
  lineType: "labor" | "part" | "material";
  laborCategory: string | null;
  description: string;
  hours: string | null;
  quantity: string | null;
  unitPrice: string;
  displayOrder: number;
};

type ServicePackage = {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lines: ServicePackageLine[];
};

type PackagesResponse = { packages: ServicePackage[] };

type UploadResult = { imported: number; updated: number; errors: string[] };

const LINE_TYPE_STYLES: Record<string, string> = {
  labor:    "bg-blue-500/10 text-blue-600",
  part:     "bg-purple-500/10 text-purple-600",
  material: "bg-amber-500/10 text-amber-700",
};

export default function ServicePackagesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const { data, isLoading } = useQuery<PackagesResponse>({
    queryKey: ["service-packages"],
    queryFn: async () => {
      const r = await fetch("/api/service-packages", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch packages");
      return r.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/service-packages/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Upload failed");
      return json as UploadResult;
    },
    onSuccess: (result) => {
      setUploadResult(result);
      qc.invalidateQueries({ queryKey: ["service-packages"] });
      toast({
        title: result.errors.length === 0 ? "Upload successful" : "Upload completed with warnings",
        description: `${result.imported} imported, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} error(s)` : ""}`,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    },
  });

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      toast({ title: "Invalid file", description: "Please upload an .xlsx file", variant: "destructive" });
      return;
    }
    setUploadResult(null);
    uploadMutation.mutate(file);
    e.target.value = "";
  }

  function handleDownloadTemplate() {
    const a = document.createElement("a");
    a.href = "/api/service-packages/template";
    a.download = "service-packages-template.xlsx";
    a.click();
  }

  const packages = data?.packages ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Service Packages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage bundled estimate packages. Upload an Excel file to import or update packages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-[hsl(221,83%,53%)] text-white hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-60"
          >
            {uploadMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploadMutation.isPending ? "Uploading…" : "Upload Excel"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Upload result panel */}
      {uploadResult && (
        <div className={`rounded-lg border p-4 ${uploadResult.errors.length === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center gap-2 mb-2">
            {uploadResult.errors.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <p className="text-sm font-medium text-foreground">
              Import complete — {uploadResult.imported} new package{uploadResult.imported !== 1 ? "s" : ""}, {uploadResult.updated} updated
            </p>
          </div>
          {uploadResult.errors.length > 0 && (
            <ul className="space-y-1 ml-6">
              {uploadResult.errors.map((e, i) => (
                <li key={i} className="text-xs text-amber-800">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Package list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            Active Packages
            <span className="ml-2 text-xs text-muted-foreground font-normal">({packages.length})</span>
          </p>
          <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium w-[55%]">
            <span>Lines</span>
            <span>Last Updated</span>
            <span className="col-span-2" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No packages found. Upload an Excel file or reload.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {packages.map((pkg) => {
              const expanded = expandedIds.has(pkg.id);
              return (
                <li key={pkg.id}>
                  <button
                    onClick={() => toggleExpand(pkg.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded shrink-0"
                      style={{ backgroundColor: pkg.color + "22" }}
                    >
                      <Package className="w-3.5 h-3.5" style={{ color: pkg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground truncate">{pkg.description}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-4 items-center w-[55%] text-xs text-muted-foreground shrink-0">
                      <span>{pkg.lines.length} line{pkg.lines.length !== 1 ? "s" : ""}</span>
                      <span>{new Date(pkg.updatedAt).toLocaleDateString()}</span>
                      <span className="col-span-1" />
                      <span className="flex justify-end pr-1">
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="bg-muted/30 border-t border-border px-4 pb-3 pt-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left font-medium py-1 w-20">Type</th>
                            <th className="text-left font-medium py-1 w-24">Category</th>
                            <th className="text-left font-medium py-1">Description</th>
                            <th className="text-right font-medium py-1 w-16">Hrs/Qty</th>
                            <th className="text-right font-medium py-1 w-20">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {pkg.lines.map((line) => (
                            <tr key={line.id} className="text-foreground">
                              <td className="py-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${LINE_TYPE_STYLES[line.lineType] ?? ""}`}>
                                  {line.lineType}
                                </span>
                              </td>
                              <td className="py-1.5 text-muted-foreground">{line.laborCategory ?? "—"}</td>
                              <td className="py-1.5">{line.description}</td>
                              <td className="py-1.5 text-right">
                                {line.hours ? `${line.hours}h` : line.quantity ? `×${line.quantity}` : "—"}
                              </td>
                              <td className="py-1.5 text-right">${Number(line.unitPrice).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        Download the template to see the correct column structure. Re-uploading a package by the same name will update it (upsert) — existing line items are replaced.
      </p>
    </div>
  );
}

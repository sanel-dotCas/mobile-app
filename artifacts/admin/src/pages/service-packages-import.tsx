import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import {
  Upload,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TierPreview {
  interval: string;
  bundleCode: string;
  partCount: number;
}

interface ModelBlock {
  modelCode: string;
  tiers: TierPreview[];
}

interface PreviewResponse {
  preview: ModelBlock[];
  packageCount: number;
  errors: string[];
}

export default function ServicePackagesImportPage() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem("igmma_admin_session");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${import.meta.env.BASE_URL}api/service-packages/import-menu-kits?commit=false`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      // Expand all models by default
      setExpandedModels(new Set(data.preview.map((b) => b.modelCode)));
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to parse file");
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem("igmma_admin_session");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${import.meta.env.BASE_URL}api/service-packages/import-menu-kits?commit=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error ?? "Import failed");
      }
      return res.json() as Promise<PreviewResponse & { created: number; updated: number }>;
    },
    onSuccess: (data) => {
      toast.success(`Import complete — ${data.created} created, ${data.updated} updated`);
      navigate("/master/service-packages");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Import failed");
    },
  });

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    previewMutation.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function toggleModel(modelCode: string) {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelCode)) next.delete(modelCode);
      else next.add(modelCode);
      return next;
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/service-packages")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Menu Kits</h1>
          <p className="text-slate-500">Upload a brand/model Excel file to create service packages</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="flex flex-col items-center gap-3">
          {previewMutation.isPending ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-10 h-10 text-slate-400" />
          )}
          <div>
            <p className="font-semibold text-slate-700">
              {selectedFile ? selectedFile.name : "Drop your Excel file here"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Supports .xlsx, .xls, .csv — brand/model dealership format
            </p>
          </div>
          {!selectedFile && (
            <Button variant="outline" size="sm" className="mt-2">
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
          )}
        </div>
      </div>

      {/* Errors banner */}
      {previewData && previewData.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">{previewData.errors.length} parse error(s):</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {previewData.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview accordion */}
      {previewData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-slate-800">
                Preview — {previewData.packageCount} packages across {previewData.preview.length} vehicle models
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedModels(new Set(previewData.preview.map((b) => b.modelCode)))}
              >
                Expand all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedModels(new Set())}
              >
                Collapse all
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {previewData.preview.map((block) => (
              <div key={block.modelCode}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => toggleModel(block.modelCode)}
                >
                  <div className="flex items-center gap-3">
                    {expandedModels.has(block.modelCode)
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-slate-800">{block.modelCode}</span>
                  </div>
                  <Badge variant="outline" className="text-slate-500">
                    {block.tiers.length} tier{block.tiers.length !== 1 ? "s" : ""}
                  </Badge>
                </button>
                {expandedModels.has(block.modelCode) && (
                  <div className="px-4 pb-3 bg-slate-50/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                          <th className="text-left py-2 font-semibold">Bundle Code</th>
                          <th className="text-left py-2 font-semibold">Interval</th>
                          <th className="text-right py-2 font-semibold">Parts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {block.tiers.map((tier) => (
                          <tr key={tier.bundleCode} className="hover:bg-white">
                            <td className="py-2">
                              <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">
                                {tier.bundleCode}
                              </code>
                            </td>
                            <td className="py-2 text-slate-700">{tier.interval}</td>
                            <td className="py-2 text-right">
                              <Badge className="bg-blue-50 text-blue-700 border-blue-100">
                                {tier.partCount} part{tier.partCount !== 1 ? "s" : ""}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate("/master/service-packages")}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedFile && commitMutation.mutate(selectedFile)}
              disabled={commitMutation.isPending || previewData.packageCount === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {commitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Import ({previewData.packageCount} packages)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

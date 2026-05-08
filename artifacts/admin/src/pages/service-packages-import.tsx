import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
  GripVertical,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface RawPreviewResponse {
  rows: string[][];
  colCount: number;
}

type MappingField = "modelKeywordCol" | "modelCodeCol" | "descriptionCol" | "partNumberCol" | "tierStartCol";

interface KitColumnMapping {
  modelKeywordCol: number;
  modelCodeCol: number;
  descriptionCol: number;
  partNumberCol: number;
  tierStartCol: number;
}

type ImportStep = "upload" | "mapping" | "preview";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAPPING: KitColumnMapping = {
  modelKeywordCol: 0,
  modelCodeCol: 1,
  descriptionCol: 0,
  partNumberCol: 1,
  tierStartCol: 2,
};

const MAPPING_FIELDS: { field: MappingField; label: string; hint: string; color: string; dotColor: string }[] = [
  {
    field: "modelKeywordCol",
    label: "Model Keyword",
    hint: 'Column containing the word "Model" that starts each block',
    color: "bg-orange-50 border-orange-300 text-orange-800",
    dotColor: "bg-orange-400",
  },
  {
    field: "modelCodeCol",
    label: "Model Code",
    hint: "Column with the vehicle model name/code (same row as keyword)",
    color: "bg-blue-50 border-blue-300 text-blue-800",
    dotColor: "bg-blue-500",
  },
  {
    field: "descriptionCol",
    label: "Part Description",
    hint: "Column with part name in data rows",
    color: "bg-green-50 border-green-300 text-green-800",
    dotColor: "bg-green-500",
  },
  {
    field: "partNumberCol",
    label: "Part Number",
    hint: "Column with part number / SKU in data rows",
    color: "bg-purple-50 border-purple-300 text-purple-800",
    dotColor: "bg-purple-500",
  },
  {
    field: "tierStartCol",
    label: "Tier Columns Start",
    hint: "First column of tier qty data — all columns from here onward are treated as tiers",
    color: "bg-slate-100 border-slate-300 text-slate-700",
    dotColor: "bg-slate-500",
  },
];

const LS_MAPPING_KEY = "igmma_kit_col_mapping";

// ── Helpers ───────────────────────────────────────────────────────────────────

function colIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function fieldForCol(mapping: KitColumnMapping, col: number): MappingField | null {
  for (const { field } of MAPPING_FIELDS) {
    if (mapping[field] === col) return field;
  }
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ServicePackagesImportPage() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<ImportStep>("upload");

  // Upload state
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Raw preview (for column mapping step)
  const [rawPreview, setRawPreview] = useState<RawPreviewResponse | null>(null);

  // Column mapping
  const [mapping, setMapping] = useState<KitColumnMapping>({ ...DEFAULT_MAPPING });
  const [saveMapping, setSaveMapping] = useState(false);

  // Drag state for column mapping
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverField, setDragOverField] = useState<MappingField | null>(null);

  // Preview (parsed data)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  // Load saved mapping from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MAPPING_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<KitColumnMapping>;
        setMapping({
          modelKeywordCol: parsed.modelKeywordCol ?? DEFAULT_MAPPING.modelKeywordCol,
          modelCodeCol: parsed.modelCodeCol ?? DEFAULT_MAPPING.modelCodeCol,
          descriptionCol: parsed.descriptionCol ?? DEFAULT_MAPPING.descriptionCol,
          partNumberCol: parsed.partNumberCol ?? DEFAULT_MAPPING.partNumberCol,
          tierStartCol: parsed.tierStartCol ?? DEFAULT_MAPPING.tierStartCol,
        });
        setSaveMapping(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  // ── Raw preview mutation ───────────────────────────────────────────────────

  const rawPreviewMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem("igmma_admin_session");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/service-packages/import-menu-kits?mode=raw-preview`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json() as Promise<RawPreviewResponse>;
    },
    onSuccess: (data) => {
      setRawPreview(data);
      setStep("mapping");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to read file");
    },
  });

  // ── Parse preview mutation (with mapping) ─────────────────────────────────

  const previewMutation = useMutation({
    mutationFn: async ({ file, m }: { file: File; m: KitColumnMapping }) => {
      const token = localStorage.getItem("igmma_admin_session");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(m));
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/service-packages/import-menu-kits?commit=false`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setExpandedModels(new Set(data.preview.map((b) => b.modelCode)));
      setStep("preview");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to parse file");
    },
  });

  // ── Commit mutation (with mapping) ────────────────────────────────────────

  const commitMutation = useMutation({
    mutationFn: async ({ file, m }: { file: File; m: KitColumnMapping }) => {
      const token = localStorage.getItem("igmma_admin_session");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(m));
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/service-packages/import-menu-kits?commit=true`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
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

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }
    setSelectedFile(file);
    setRawPreview(null);
    setPreviewData(null);
    rawPreviewMutation.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Mapping step helpers ───────────────────────────────────────────────────

  function handleColDragStart(col: number) {
    setDragCol(col);
  }

  function handleFieldDragOver(e: React.DragEvent, field: MappingField) {
    e.preventDefault();
    setDragOverField(field);
  }

  function handleFieldDrop(e: React.DragEvent, field: MappingField) {
    e.preventDefault();
    if (dragCol !== null) {
      setMapping((prev) => ({ ...prev, [field]: dragCol }));
    }
    setDragCol(null);
    setDragOverField(null);
  }

  function handleFieldDragLeave() {
    setDragOverField(null);
  }

  function handleMappingContinue() {
    if (saveMapping) {
      localStorage.setItem(LS_MAPPING_KEY, JSON.stringify(mapping));
    } else {
      localStorage.removeItem(LS_MAPPING_KEY);
    }
    if (selectedFile) {
      previewMutation.mutate({ file: selectedFile, m: mapping });
    }
  }

  function handleResetMapping() {
    setMapping({ ...DEFAULT_MAPPING });
  }

  // ── Preview accordion ──────────────────────────────────────────────────────

  function toggleModel(modelCode: string) {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelCode)) next.delete(modelCode);
      else next.add(modelCode);
      return next;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const fieldMeta = Object.fromEntries(MAPPING_FIELDS.map((f) => [f.field, f])) as Record<
    MappingField,
    (typeof MAPPING_FIELDS)[number]
  >;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (step === "mapping") { setStep("upload"); setRawPreview(null); }
            else if (step === "preview") { setStep("mapping"); }
            else navigate("/master/service-packages");
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Menu Kits</h1>
          <p className="text-slate-500">Upload a brand/model Excel file to create service packages</p>
        </div>
        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-2">
          {(["upload", "mapping", "preview"] as ImportStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-slate-200" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                  step === s
                    ? "bg-blue-600 border-blue-600 text-white"
                    : i < ["upload", "mapping", "preview"].indexOf(step)
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-400"
                )}
              >
                <span>{i + 1}</span>
                <span className="capitalize">{s === "mapping" ? "Map Columns" : s === "preview" ? "Preview" : "Upload"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
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
            {rawPreviewMutation.isPending ? (
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
            {!rawPreviewMutation.isPending && (
              <Button variant="outline" size="sm" className="mt-2">
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === "mapping" && rawPreview && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>Assign each column a role</strong> — drag the column letter chips below into the matching role slot.
            Tier columns are all columns from the "Tier Columns Start" column onward.
          </div>

          {/* Role slots */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {MAPPING_FIELDS.map(({ field, label, hint, color }) => {
              const assignedCol = mapping[field];
              const isOver = dragOverField === field;
              return (
                <div
                  key={field}
                  className={cn(
                    "rounded-xl border-2 p-3 min-h-[88px] flex flex-col gap-1.5 transition-all",
                    color,
                    isOver && "ring-2 ring-blue-400 ring-offset-1 scale-[1.02]",
                    dragCol !== null && "cursor-copy"
                  )}
                  onDragOver={(e) => handleFieldDragOver(e, field)}
                  onDragLeave={handleFieldDragLeave}
                  onDrop={(e) => handleFieldDrop(e, field)}
                >
                  <p className="text-xs font-semibold leading-tight">{label}</p>
                  <p className="text-xs opacity-70 leading-snug flex-1">{hint}</p>
                  {assignedCol !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/70 border border-current/20 text-xs font-mono font-bold">
                        {colIndexToLetter(assignedCol)}
                      </span>
                      {rawPreview.rows[0]?.[assignedCol] && (
                        <span className="text-xs opacity-60 truncate max-w-[80px]">
                          {rawPreview.rows[0][assignedCol]}
                        </span>
                      )}
                      <button
                        className="ml-auto text-current/50 hover:text-current/80 text-xs"
                        onClick={() => setMapping((p) => ({ ...p, [field]: DEFAULT_MAPPING[field] }))}
                        title="Reset to default"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Raw spreadsheet preview with draggable column headers */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {selectedFile?.name} — drag column headers into role slots above
              </span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-100 border-b border-r border-slate-200 px-2 py-1.5 text-slate-400 font-normal w-8 text-right">
                      #
                    </th>
                    {Array.from({ length: rawPreview.colCount }, (_, i) => {
                      const assignedField = fieldForCol(mapping, i);
                      const meta = assignedField ? fieldMeta[assignedField] : null;
                      return (
                        <th
                          key={i}
                          draggable
                          onDragStart={() => handleColDragStart(i)}
                          onDragEnd={() => setDragCol(null)}
                          className={cn(
                            "border-b border-r border-slate-200 px-2 py-1.5 font-mono font-bold cursor-grab active:cursor-grabbing select-none whitespace-nowrap",
                            meta ? meta.color : "bg-slate-100 text-slate-600",
                            dragCol === i && "opacity-50"
                          )}
                          title="Drag to assign a role"
                        >
                          <div className="flex items-center gap-1">
                            {meta && (
                              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", meta.dotColor)} />
                            )}
                            <span>{colIndexToLetter(i)}</span>
                            {meta && (
                              <span className="font-normal text-[10px] opacity-70 hidden xl:inline ml-0.5">
                                {meta.label}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rawPreview.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="sticky left-0 bg-inherit border-r border-slate-100 px-2 py-1 text-slate-300 text-right w-8">
                        {ri + 1}
                      </td>
                      {Array.from({ length: rawPreview.colCount }, (_, ci) => {
                        const assignedField = fieldForCol(mapping, ci);
                        const meta = assignedField ? fieldMeta[assignedField] : null;
                        const isTierCol = ci >= mapping.tierStartCol;
                        return (
                          <td
                            key={ci}
                            className={cn(
                              "border-r border-slate-100 px-2 py-1 max-w-[160px] truncate",
                              meta
                                ? `${meta.color} font-medium`
                                : isTierCol
                                ? "bg-slate-50/80 text-slate-500"
                                : "text-slate-700"
                            )}
                          >
                            {row[ci] ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {MAPPING_FIELDS.map(({ field, label, color, dotColor }) => (
              <div
                key={field}
                className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border", color)}
              >
                <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                <span>
                  {label}: <strong className="font-mono">{colIndexToLetter(mapping[field])}</strong>
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-slate-50 border-slate-200 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span>
                Tier columns: <strong className="font-mono">{colIndexToLetter(mapping.tierStartCol)}→</strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
              <input
                type="checkbox"
                checked={saveMapping}
                onChange={(e) => setSaveMapping(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Save className="w-3.5 h-3.5 text-slate-400" />
              Save this mapping for future imports
            </label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetMapping}
                className="text-slate-500"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset to defaults
              </Button>
              <Button
                onClick={handleMappingContinue}
                disabled={previewMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {previewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Preview Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && previewData && (
        <div className="space-y-4">
          {/* Errors banner */}
          {previewData.errors.length > 0 && (
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

          {/* Mapping summary badge */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">Column mapping used:</span>
            {MAPPING_FIELDS.map(({ field, label, color, dotColor }) => (
              <span key={field} className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
                {label}: <strong className="font-mono ml-0.5">{colIndexToLetter(mapping[field])}</strong>
              </span>
            ))}
          </div>

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
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back to column mapping
            </Button>
            <Button
              onClick={() => selectedFile && commitMutation.mutate({ file: selectedFile, m: mapping })}
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

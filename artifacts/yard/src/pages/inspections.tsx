import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useListYardInspections,
  getListYardInspectionsQueryKey,
  useCreateYardInspection,
  useUpdateYardInspection,
  useListYardVehicles,
  getListYardVehiclesQueryKey,
  useListYardLocations,
  getListYardLocationsQueryKey,
  useGenerateYardInspections,
  useAutoAssignYardInspections,
} from "@workspace/api-client-react";
import { Plus, X, ClipboardCheck, UserCheck, Gauge, CalendarClock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InspStatus = "all" | "queued" | "in-progress" | "finished";

const STATUS_CHIPS: { value: InspStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "in-progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
];

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-600",
  "in-progress": "bg-[hsl(221,83%,53%)]/15 text-[hsl(221,83%,53%)]",
  finished: "bg-emerald-500/15 text-emerald-600",
};

export const TYPE_LABELS: Record<string, string> = {
  "pre-inspection": "Pre-Inspection",
  secondary: "Secondary",
  "final-quality": "Final Quality",
  "new-arrival": "New Arrival PDI",
  "used-arrival": "Used Arrival PDI",
  "periodic-fluid": "Periodic — Fluid Check",
  "periodic-damage": "Periodic — Damage Scan",
  "start-and-run": "Start & Run Cycle",
};

const URGENCY_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-700",
  "due-soon": "bg-amber-100 text-amber-700",
  ok: "bg-emerald-100 text-emerald-700",
};
const URGENCY_LABELS: Record<string, string> = {
  overdue: "Overdue",
  "due-soon": "Due Soon",
  ok: "On Schedule",
};

function parseChecklistResult(notes: string | null, bodyDamage: string | null) {
  let passed = 0, failed = 0, na = 0;
  const failedItems: string[] = [];

  if (notes) {
    const pm = notes.match(/(\d+)\s+passed/i);
    const fm = notes.match(/(\d+)\s+failed/i);
    const nm = notes.match(/(\d+)\s+N\/A/i);
    if (pm) passed = parseInt(pm[1]);
    if (fm) failed = parseInt(fm[1]);
    if (nm) na = parseInt(nm[1]);
  }

  if (bodyDamage && bodyDamage.includes("Failed items:")) {
    const after = bodyDamage.split("Failed items:")[1] ?? "";
    const lines = after.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
    failedItems.push(...lines);
  }

  return { passed, failed, na, failedItems };
}

type Inspection = {
  id: number; inspectionNumber: string; vehicleId: number; stockVin: string;
  vehicleName: string; vehicleYear?: number | null; stockNumber?: string | null;
  type: string; status: string; locationName: string | null;
  notes: string | null; bodyDamage: string | null; fuelPercentage: number | null;
  vehicleMileage: number | null;
  createdAt: string; completedAt: string | null; assignedTo: string | null;
};

type Recommendation = {
  vehicleId: number;
  vehicleName: string;
  stockNumber: string;
  urgency: "overdue" | "due-soon" | "ok";
  daysRemaining: number;
  daysSinceArrival: number;
  lastInspectedAt: string | null;
  nextDueDate: string;
};

function UpdateMileageModal({
  inspectionId,
  currentMileage,
  vehicleName,
  stockNumber,
  onClose,
  onConfirm,
}: {
  inspectionId: number;
  currentMileage: number | null;
  vehicleName: string;
  stockNumber?: string | null;
  onClose: () => void;
  onConfirm: (inspectionId: number, mileage: number) => void;
}) {
  const [value, setValue] = useState(currentMileage != null ? String(currentMileage) : "");

  const handleConfirm = () => {
    const num = Number(value);
    if (Number.isInteger(num) && num >= 0) {
      onConfirm(inspectionId, num);
    }
    onClose();
  };

  const subtitle = vehicleName + (stockNumber ? ` — Stock #${stockNumber}` : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-card border border-card-border rounded-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Update Mileage In</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Corrected Mileage (km)
          </label>
          <input
            type="number"
            min="0"
            autoFocus
            data-testid="input-mileage-correction"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            placeholder="Enter corrected mileage..."
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="button-confirm-mileage"
            onClick={handleConfirm}
            disabled={!value || !Number.isInteger(Number(value)) || Number(value) < 0}
            className="flex-1 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePDIModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { data: vehicleData } = useListYardVehicles({}, {
    query: { queryKey: getListYardVehiclesQueryKey({}) },
  });
  const { data: locations } = useListYardLocations({ query: { queryKey: getListYardLocationsQueryKey() } });
  const { data: usersData } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["yard-users"],
    queryFn: async () => {
      const r = await fetch("/api/yard/users", { credentials: "include" });
      return r.json();
    },
  });

  const [form, setForm] = useState({
    vehicleId: "", type: "pre-inspection", locationId: "",
    notes: "", bodyDamage: "", fuelPercentage: "100", assignedTo: "",
  });

  const create = useCreateYardInspection({
    mutation: {
      onSuccess: () => { toast({ title: "Inspection created" }); onSuccess(); },
      onError: () => toast({ title: "Failed to create inspection", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId) return;
    create.mutate({
      data: {
        vehicleId: Number(form.vehicleId),
        type: form.type as "pre-inspection" | "secondary" | "final-quality" | "new-arrival" | "used-arrival" | "periodic-fluid" | "periodic-damage" | "start-and-run",
        locationId: form.locationId ? Number(form.locationId) : undefined,
        notes: form.notes || undefined,
        bodyDamage: form.bodyDamage || undefined,
        fuelPercentage: form.fuelPercentage ? Number(form.fuelPercentage) : undefined,
        assignedTo: form.assignedTo || undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-card border border-card-border rounded-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Create PDI Inspection</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle *</label>
            <select
              required
              data-testid="select-inspection-vehicle"
              value={form.vehicleId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="">Select vehicle...</option>
              {(vehicleData?.vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} — {v.stockNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Inspection Type</label>
            <select
              data-testid="select-inspection-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <optgroup label="Standard">
                <option value="pre-inspection">Pre-Inspection</option>
                <option value="secondary">Secondary</option>
                <option value="final-quality">Final Quality</option>
              </optgroup>
              <optgroup label="Arrival">
                <option value="new-arrival">New Arrival PDI</option>
                <option value="used-arrival">Used Arrival PDI</option>
              </optgroup>
              <optgroup label="Periodic">
                <option value="periodic-fluid">Periodic — Fluid Check</option>
                <option value="periodic-damage">Periodic — Damage Scan</option>
                <option value="start-and-run">Start & Run Cycle</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assign Technician</label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="">— Unassigned —</option>
              {(usersData ?? []).map((u) => (
                <option key={u.id} value={u.name}>{u.name} ({u.role.replace("_", " ")})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <select
              value={form.locationId}
              onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="">— Auto —</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fuel %</label>
            <input
              type="number" min="0" max="100"
              value={form.fuelPercentage}
              onChange={(e) => setForm((f) => ({ ...f, fuelPercentage: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Body Damage</label>
            <input
              type="text"
              value={form.bodyDamage}
              onChange={(e) => setForm((f) => ({ ...f, bodyDamage: e.target.value }))}
              placeholder="e.g. Minor scratch on rear bumper"
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea
              data-testid="textarea-inspection-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)] resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              data-testid="button-submit-inspection"
              disabled={create.isPending || !form.vehicleId}
              className="flex-1 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50"
            >
              {create.isPending ? "Creating..." : "Create Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INTERVAL_PRESETS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

const PERIODIC_TYPES = [
  { value: "periodic-fluid", label: "Fluid Check" },
  { value: "periodic-damage", label: "Damage Scan" },
  { value: "start-and-run", label: "Start & Run Cycle" },
] as const;

function ScheduleInspectionsPanel({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [intervalDays, setIntervalDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [inspType, setInspType] = useState<"periodic-fluid" | "periodic-damage" | "start-and-run">("periodic-fluid");

  const effectiveInterval = isCustom ? Number(customDays) || 0 : intervalDays;

  const { data: recsData, isLoading: recsLoading } = useQuery<{
    recommendations: Recommendation[];
    summary: { overdue: number; dueSoon: number; ok: number; total: number };
  }>({
    queryKey: ["inspection-recommendations"],
    queryFn: async () => {
      const r = await fetch("/api/yard/inspection-recommendations");
      return r.json();
    },
    enabled: open,
  });

  const { data: availTechData } = useQuery<{ techs: { name: string; status: string }[]; count: number }>({
    queryKey: ["available-techs"],
    queryFn: async () => {
      const r = await fetch("/api/yard/inspections/available-techs");
      return r.json();
    },
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const generateMutation = useGenerateYardInspections({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: `${data.created} inspection${data.created !== 1 ? "s" : ""} created`,
          description: data.assigned > 0
            ? `${data.assigned} auto-assigned${data.skipped > 0 ? `, ${data.skipped} skipped (already active)` : ""}`
            : data.skipped > 0
            ? `${data.skipped} vehicle${data.skipped !== 1 ? "s" : ""} skipped (already have active inspections)`
            : undefined,
        });
        onSuccess();
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to generate inspections", variant: "destructive" }),
    },
  });

  const previewRecs = (recsData?.recommendations ?? []).filter(
    (r) => r.daysRemaining <= effectiveInterval || r.urgency === "overdue"
  );

  const handleGenerate = () => {
    if (effectiveInterval < 1) {
      toast({ title: "Please enter a valid interval", variant: "destructive" });
      return;
    }
    generateMutation.mutate({
      data: { intervalDays: effectiveInterval, autoAssign, inspectionType: inspType },
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-lg">
      <button
        data-testid="schedule-inspections-toggle"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[hsl(221,83%,53%)]" />
          <span className="text-sm font-semibold text-foreground">Schedule Inspections</span>
          {recsData && (
            <span className="text-xs text-muted-foreground">
              ({recsData.summary.overdue} overdue, {recsData.summary.dueSoon} due soon)
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Interval picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Inspection Interval</label>
            <div className="flex flex-wrap gap-2">
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setIntervalDays(p.value); setIsCustom(false); }}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    !isCustom && intervalDays === p.value
                      ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                      : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  isCustom
                    ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                    : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)]"
                }`}
              >
                Custom
              </button>
              {isCustom && (
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Days..."
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-24 px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
                />
              )}
            </div>
          </div>

          {/* Inspection type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Inspection Type</label>
            <div className="flex flex-wrap gap-2">
              {PERIODIC_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setInspType(t.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    inspType === t.value
                      ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                      : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-assign toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoAssign((a) => !a)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  autoAssign ? "bg-[hsl(221,83%,53%)]" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    autoAssign ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-foreground font-medium">
                Auto-Assign to technicians
              </span>
            </div>
            {autoAssign && availTechData && (
              <div className="ml-13 pl-[52px]">
                {availTechData.count === 0 ? (
                  <p className="text-xs text-red-600 font-medium">
                    No technicians available — all are on break or absent. Inspections will be created unassigned.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-emerald-600">{availTechData.count} tech{availTechData.count !== 1 ? "s" : ""} available</span>
                      {" "}— round-robin distribution
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {availTechData.techs.map((t) => (
                        <span
                          key={t.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {t.name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vehicle preview table */}
          {effectiveInterval > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Vehicles that would be included ({previewRecs.length})
              </p>
              {recsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : previewRecs.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No vehicles are overdue or due within {effectiveInterval} days
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Vehicle</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Last Inspected</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Days in Yard</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Urgency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRecs.slice(0, 20).map((r) => (
                        <tr key={r.vehicleId} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{r.vehicleName}</div>
                            <div className="text-muted-foreground">{r.stockNumber}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                            {r.lastInspectedAt
                              ? new Date(r.lastInspectedAt).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                            {r.daysSinceArrival}d
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${URGENCY_STYLES[r.urgency]}`}>
                              {r.urgency === "overdue"
                                ? `${Math.abs(r.daysRemaining)}d overdue`
                                : r.urgency === "due-soon"
                                ? `Due in ${r.daysRemaining}d`
                                : URGENCY_LABELS[r.urgency]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewRecs.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-2 border-t border-border">
                      +{previewRecs.length - 20} more vehicles
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="button-generate-inspections"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || previewRecs.length === 0 || effectiveInterval < 1}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {generateMutation.isPending
                ? "Generating..."
                : `Generate ${previewRecs.length > 0 ? `(${previewRecs.length})` : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InspectionsPage() {
  const [statusFilter, setStatusFilter] = useState<InspStatus>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [mileageModal, setMileageModal] = useState<{ inspectionId: number; currentMileage: number | null; vehicleName: string; stockNumber?: string | null } | null>(null);
  const [mileageOverrides, setMileageOverrides] = useState<Record<number, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usersData } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["yard-users"],
    queryFn: async () => {
      const r = await fetch("/api/yard/users", { credentials: "include" });
      return r.json();
    },
  });

  const params = { status: statusFilter === "all" ? undefined : statusFilter, page, limit: 15 };
  const { data, isLoading } = useListYardInspections(params, {
    query: { queryKey: getListYardInspectionsQueryKey(params) },
  });

  const updateInspection = useUpdateYardInspection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Inspection updated" });
        queryClient.invalidateQueries({ queryKey: getListYardInspectionsQueryKey() });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const autoAssignMutation = useAutoAssignYardInspections({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `${data.assigned} inspection${data.assigned !== 1 ? "s" : ""} assigned` });
        queryClient.invalidateQueries({ queryKey: getListYardInspectionsQueryKey() });
      },
      onError: () => toast({ title: "Auto-assign failed", variant: "destructive" }),
    },
  });

  const markFinished = (id: number) => {
    updateInspection.mutate({ inspectionId: id, data: { status: "finished" } });
  };

  const markInProgress = (id: number) => {
    updateInspection.mutate({ inspectionId: id, data: { status: "in-progress" } });
  };

  const assignTech = (id: number, name: string) => {
    updateInspection.mutate({ inspectionId: id, data: { assignedTo: name } });
  };

  const handleMileageConfirm = (inspectionId: number, mileage: number) => {
    setMileageOverrides((prev) => ({ ...prev, [inspectionId]: mileage }));
    toast({ title: "Mileage updated" });
  };

  const getDisplayMileage = (insp: Inspection): number | null => {
    if (mileageOverrides[insp.id] !== undefined) return mileageOverrides[insp.id];
    return insp.vehicleMileage;
  };

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListYardInspectionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["inspection-recommendations"] });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">PDI & Inspections</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} inspections</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => autoAssignMutation.mutate({ data: {} })}
            disabled={autoAssignMutation.isPending}
            title="Auto-assign all unassigned queued inspections"
            className="flex items-center gap-1.5 px-3 py-2 border border-border text-sm font-medium rounded hover:border-[hsl(221,83%,53%)] text-foreground transition-colors disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            Auto-Assign
          </button>
          <button
            data-testid="button-create-inspection"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors"
          >
            <Plus className="w-4 h-4" /> Create PDI
          </button>
        </div>
      </div>

      {/* Schedule Inspections panel */}
      <ScheduleInspectionsPanel onSuccess={handleScheduleSuccess} />

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map(({ value, label }) => (
          <button
            key={value}
            data-testid={`filter-insp-${value}`}
            onClick={() => { setStatusFilter(value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === value
                ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,53%)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inspections list */}
      <div className="bg-card border border-card-border rounded-lg divide-y divide-border" data-testid="inspections-list">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <div className="h-4 bg-muted animate-pulse rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
            </div>
          ))
        ) : (data?.inspections ?? []).length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No inspections found</p>
          </div>
        ) : (
          (data?.inspections as Inspection[]).map((insp) => (
            <div
              key={insp.id}
              data-testid={`inspection-row-${insp.id}`}
              className="px-4 py-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">#{insp.inspectionNumber}</span>
                  <span className="text-sm font-semibold text-foreground">{insp.vehicleName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[insp.status] ?? "bg-muted text-muted-foreground"}`}>
                    {insp.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[insp.type] ?? insp.type}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{insp.stockVin}</p>
                {insp.locationName && (
                  <p className="text-xs text-muted-foreground">{insp.locationName}</p>
                )}

                {/* Technician assignment */}
                <div className="flex items-center gap-2 mt-2">
                  <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {insp.assignedTo ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[hsl(221,83%,53%)]/15 flex items-center justify-center text-[9px] font-bold text-[hsl(221,83%,53%)]">
                        {insp.assignedTo.charAt(0)}
                      </div>
                      <span className="text-xs text-foreground">{insp.assignedTo}</span>
                      <select
                        className="text-[10px] text-muted-foreground bg-transparent border-0 cursor-pointer focus:outline-none"
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) assignTech(insp.id, e.target.value); }}
                      >
                        <option value="">(reassign)</option>
                        {(usersData ?? []).map((u) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <select
                      className="text-xs px-2 py-0.5 bg-muted border border-border rounded text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) assignTech(insp.id, e.target.value); }}
                      data-testid={`assign-tech-${insp.id}`}
                    >
                      <option value="">Assign technician...</option>
                      {(usersData ?? []).map((u) => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {insp.status === "finished" && (insp.notes || insp.bodyDamage) ? (() => {
                  const { passed, failed, na, failedItems } = parseChecklistResult(insp.notes, insp.bodyDamage);
                  const total = passed + failed + na;
                  return (
                    <div className="mt-2 space-y-1.5">
                      {total > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                            ✓ {passed} passed
                          </span>
                          {failed > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-red-500/15 text-red-700">
                              ✗ {failed} failed
                            </span>
                          )}
                          {na > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              — {na} N/A
                            </span>
                          )}
                        </div>
                      )}
                      {failedItems.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-[11px] font-semibold text-red-700 mb-1">Failed items:</p>
                          <ul className="space-y-0.5">
                            {failedItems.map((item, idx) => (
                              <li key={idx} className="text-[11px] text-red-600 flex items-start gap-1">
                                <span className="mt-px shrink-0">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <>
                    {insp.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{insp.notes}</p>
                    )}
                    {insp.bodyDamage && (
                      <p className="text-xs text-amber-600 mt-1">Notes: {insp.bodyDamage}</p>
                    )}
                  </>
                )}
                {/* Mileage row */}
                <div className="flex items-center gap-2 mt-2">
                  <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">
                    {getDisplayMileage(insp) != null
                      ? `${getDisplayMileage(insp)!.toLocaleString()} km`
                      : <span className="text-muted-foreground italic">No mileage recorded</span>
                    }
                    {mileageOverrides[insp.id] !== undefined && (
                      <span className="ml-1 text-[10px] text-[hsl(221,83%,53%)]">(corrected)</span>
                    )}
                  </span>
                  <button
                    data-testid={`button-take-action-mileage-${insp.id}`}
                    onClick={() => setMileageModal({ inspectionId: insp.id, currentMileage: getDisplayMileage(insp), vehicleName: insp.vehicleName, stockNumber: insp.stockNumber })}
                    className="ml-auto text-[10px] px-2 py-0.5 border border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] rounded hover:bg-[hsl(221,83%,53%)] hover:text-white transition-colors shrink-0"
                  >
                    Take Action
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {insp.fuelPercentage != null && (
                    <span>Fuel: {insp.fuelPercentage}%</span>
                  )}
                  <span>{new Date(insp.createdAt).toLocaleDateString()}</span>
                  {insp.completedAt && (
                    <span className="text-emerald-600">Completed {new Date(insp.completedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {insp.status === "queued" && (
                  <button
                    data-testid={`button-start-insp-${insp.id}`}
                    onClick={() => markInProgress(insp.id)}
                    disabled={updateInspection.isPending}
                    className="px-3 py-1 text-xs border border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] rounded hover:bg-[hsl(221,83%,53%)] hover:text-white transition-colors disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
                {insp.status === "in-progress" && (
                  <button
                    data-testid={`button-finish-insp-${insp.id}`}
                    onClick={() => markFinished(insp.id)}
                    disabled={updateInspection.isPending}
                    className="px-3 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    Mark Done
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {data?.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs border border-border rounded text-foreground disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
              className="px-3 py-1.5 text-xs border border-border rounded text-foreground disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePDIModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: getListYardInspectionsQueryKey() });
          }}
        />
      )}

      {mileageModal && (
        <UpdateMileageModal
          inspectionId={mileageModal.inspectionId}
          currentMileage={mileageModal.currentMileage}
          vehicleName={mileageModal.vehicleName}
          stockNumber={mileageModal.stockNumber}
          onClose={() => setMileageModal(null)}
          onConfirm={handleMileageConfirm}
        />
      )}
    </div>
  );
}

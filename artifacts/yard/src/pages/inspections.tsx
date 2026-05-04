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
} from "@workspace/api-client-react";
import { Plus, X, ClipboardCheck, UserCheck, Gauge } from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  "pre-inspection": "Pre-Inspection",
  secondary: "Secondary",
  "final-quality": "Final Quality",
};

type Inspection = {
  id: number; inspectionNumber: string; vehicleId: number; stockVin: string;
  vehicleName: string; vehicleYear?: number | null; stockNumber?: string | null;
  type: string; status: string; locationName: string | null;
  notes: string | null; bodyDamage: string | null; fuelPercentage: number | null;
  vehicleMileage: number | null;
  createdAt: string; completedAt: string | null; assignedTo: string | null;
};

function UpdateMileageModal({
  inspectionId,
  currentMileage,
  vehicleName,
  vehicleYear,
  stockNumber,
  onClose,
  onConfirm,
}: {
  inspectionId: number;
  currentMileage: number | null;
  vehicleName: string;
  vehicleYear?: number | null;
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

  const subtitle = [
    vehicleYear ? String(vehicleYear) : null,
    vehicleName,
  ].filter(Boolean).join(" ") + (stockNumber ? ` — Stock #${stockNumber}` : "");

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
        type: form.type as "pre-inspection" | "secondary" | "final-quality",
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
              <option value="pre-inspection">Pre-Inspection</option>
              <option value="secondary">Secondary</option>
              <option value="final-quality">Final Quality</option>
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

export default function InspectionsPage() {
  const [statusFilter, setStatusFilter] = useState<InspStatus>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [mileageModal, setMileageModal] = useState<{ inspectionId: number; currentMileage: number | null; vehicleName: string; vehicleYear?: number | null; stockNumber?: string | null } | null>(null);
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">PDI & Inspections</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} inspections</p>
        </div>
        <button
          data-testid="button-create-inspection"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors"
        >
          <Plus className="w-4 h-4" /> Create PDI
        </button>
      </div>

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
                    >
                      <option value="">Assign technician...</option>
                      {(usersData ?? []).map((u) => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {insp.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{insp.notes}</p>
                )}
                {insp.bodyDamage && (
                  <p className="text-xs text-amber-600 mt-1">Damage: {insp.bodyDamage}</p>
                )}
                {/* Mileage row */}
                <div className="flex items-center gap-2 mt-2">
                  <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">
                    {getDisplayMileage(insp) != null
                      ? <>
                          {insp.vehicleYear && <span className="text-muted-foreground mr-1">{insp.vehicleYear}</span>}
                          {`${getDisplayMileage(insp)!.toLocaleString()} km`}
                        </>
                      : <span className="text-muted-foreground italic">No mileage recorded</span>
                    }
                    {mileageOverrides[insp.id] !== undefined && (
                      <span className="ml-1 text-[10px] text-[hsl(221,83%,53%)]">(corrected)</span>
                    )}
                  </span>
                  <button
                    data-testid={`button-take-action-mileage-${insp.id}`}
                    onClick={() => setMileageModal({ inspectionId: insp.id, currentMileage: getDisplayMileage(insp), vehicleName: insp.vehicleName, vehicleYear: insp.vehicleYear, stockNumber: insp.stockNumber })}
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
          vehicleYear={mileageModal.vehicleYear}
          stockNumber={mileageModal.stockNumber}
          onClose={() => setMileageModal(null)}
          onConfirm={handleMileageConfirm}
        />
      )}
    </div>
  );
}

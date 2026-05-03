import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  useListYardLocations,
  getListYardLocationsQueryKey,
  useListYardInspections,
  getListYardInspectionsQueryKey,
  useCreateYardInspection,
  useUpdateYardInspection,
  useListYardVehicles,
  getListYardVehiclesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Search, CheckSquare, Square, MoreVertical,
  Plus, X, Activity, ClipboardCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const TYPE_LABELS: Record<string, string> = {
  DEALERSHIP_LOT: "Dealership Lot",
  YARD: "Yard",
  PARKING_AREA: "Parking Area",
  PORT: "Port",
};

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-600",
  "in-progress": "bg-[hsl(221,83%,53%)]/15 text-[hsl(221,83%,53%)]",
  finished: "bg-emerald-500/15 text-emerald-600",
};

const TYPE_LABELS_SHORT: Record<string, string> = {
  DEALERSHIP_LOT: "DEALERSHIP LOT",
  YARD: "YARD",
  PARKING_AREA: "PARKING AREA",
  PORT: "PORT",
};

type Location = {
  id: number; name: string; type: string; city: string;
  totalCapacity: number; occupied: number; arrived: number;
  inYard: number; readyPDI: number; readySale: number;
};

type Inspection = {
  id: number; inspectionNumber: string; vehicleId: number; stockVin: string;
  vehicleName: string; type: string; status: string; locationName: string | null;
  notes: string | null; createdAt: string; completedAt: string | null;
  assignedTo: string | null;
};

async function fetchMovements(locationId: number | null) {
  const url = locationId
    ? `/api/yard/locations/${locationId}/movement?limit=30`
    : `/api/yard/dashboard/stats`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch movements");
  const data = await res.json();
  if (!locationId) return (data.recentMovements ?? []) as Movement[];
  return data as Movement[];
}

type Movement = {
  id: number; action: string; actor: string; createdAt: string;
  locationName?: string; vehicleName?: string | null;
};

function CreatePDIModal({
  locationId,
  onClose,
  onSuccess,
}: {
  locationId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { data: vehicleData } = useListYardVehicles({}, {
    query: { queryKey: getListYardVehiclesQueryKey({}) },
  });
  const { data: usersData } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["yard-users"],
    queryFn: async () => {
      const r = await fetch("/api/yard/users", { credentials: "include" });
      return r.json();
    },
  });

  const [form, setForm] = useState({
    vehicleId: "", type: "pre-inspection",
    locationId: locationId ? String(locationId) : "",
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
            <select required value={form.vehicleId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
              <option value="">Select vehicle...</option>
              {(vehicleData?.vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} — {v.stockNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Inspection Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
              <option value="pre-inspection">Pre-Inspection</option>
              <option value="secondary">Secondary</option>
              <option value="final-quality">Final Quality</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assign Technician</label>
            <select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
              <option value="">— Unassigned —</option>
              {(usersData ?? []).map((u) => (
                <option key={u.id} value={u.name}>{u.name} ({u.role.replace("_", " ")})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fuel %</label>
            <input type="number" min="0" max="100" value={form.fuelPercentage}
              onChange={(e) => setForm((f) => ({ ...f, fuelPercentage: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Body Damage</label>
            <input type="text" value={form.bodyDamage}
              onChange={(e) => setForm((f) => ({ ...f, bodyDamage: e.target.value }))}
              placeholder="e.g. Minor scratch on rear bumper"
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)] resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={create.isPending || !form.vehicleId}
              className="flex-1 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50">
              {create.isPending ? "Creating..." : "Create Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OverviewPanel({ locations, selectedIds }: { locations: Location[]; selectedIds: Set<number> }) {
  const active = selectedIds.size === 0
    ? locations
    : locations.filter((l) => selectedIds.has(l.id));

  const totalCap = active.reduce((s, l) => s + l.totalCapacity, 0);
  const totalOcc = active.reduce((s, l) => s + l.occupied, 0);
  const readyPDI = active.reduce((s, l) => s + l.readyPDI, 0);
  const readySale = active.reduce((s, l) => s + l.readySale, 0);
  const arrived = active.reduce((s, l) => s + l.arrived, 0);

  const singleId = active.length === 1 ? active[0]?.id ?? null : null;

  const { data: movements, isLoading } = useQuery<Movement[]>({
    queryKey: ["yard-movements", singleId],
    queryFn: () => fetchMovements(singleId),
    refetchInterval: 30_000,
  });

  const utilPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Capacity</p>
          <p className="text-2xl font-bold text-foreground">{totalOcc}</p>
          <p className="text-xs text-muted-foreground">/ {totalCap} spots</p>
          <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-[hsl(221,83%,53%)] rounded-full" style={{ width: `${utilPct}%` }} />
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Ready for Actions</p>
          <p className="text-2xl font-bold text-amber-500">{readyPDI}</p>
          <p className="text-xs text-muted-foreground">PDI</p>
          <p className="text-sm font-medium text-emerald-500 mt-1">{readySale}</p>
          <p className="text-xs text-muted-foreground">Ready Sale</p>
        </div>
        <div className="bg-[hsl(221,83%,53%)] rounded-lg p-4 text-white">
          <p className="text-xs text-white/70 mb-1">Total Arrived</p>
          <p className="text-2xl font-bold">{arrived}</p>
          <p className="text-xs text-white/70 mt-1">+{readySale} ready for sale</p>
        </div>
      </div>

      {/* Movement feed */}
      <div className="bg-card border border-card-border rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Movement Feed</h3>
        </div>
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4 mb-1.5" />
                <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
              </div>
            ))
          ) : (movements ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No recent activity</p>
          ) : (
            (movements ?? []).map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(221,83%,53%)] mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  {m.locationName && (
                    <p className="text-[10px] font-semibold text-[hsl(221,83%,53%)] uppercase tracking-wide mb-0.5">
                      {m.locationName}
                    </p>
                  )}
                  <p className="text-sm text-foreground leading-snug">{m.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.actor} · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InspectionsPanel({ locationId }: { locationId: number | null }) {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { locationId: locationId ?? undefined, page, limit: 15 };
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

  const { data: usersData } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["yard-users"],
    queryFn: async () => {
      const r = await fetch("/api/yard/users", { credentials: "include" });
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Vehicle inventory (PDI) inspections for this location.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create PDI
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Inspection #</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Stock / VIN</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Assigned</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Created</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Queue</th>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                  </td>
                </tr>
              ))
            ) : (data?.inspections ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <ClipboardCheck className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No inspections found</p>
                </td>
              </tr>
            ) : (
              (data?.inspections as Inspection[]).map((insp) => (
                <tr key={insp.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{insp.inspectionNumber}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{insp.stockVin}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{insp.vehicleName}</p>
                    {insp.notes && <p className="text-xs text-muted-foreground truncate max-w-xs">{insp.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {insp.assignedTo ? (
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-[hsl(221,83%,53%)]/20 flex items-center justify-center text-[9px] font-bold text-[hsl(221,83%,53%)]">
                          {insp.assignedTo.charAt(0)}
                        </div>
                        <span>{insp.assignedTo}</span>
                      </div>
                    ) : (
                      <select
                        className="text-xs px-1.5 py-0.5 bg-muted border border-border rounded text-foreground focus:outline-none"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            updateInspection.mutate({ inspectionId: insp.id, data: { assignedTo: e.target.value } });
                          }
                        }}
                      >
                        <option value="">Assign tech...</option>
                        {(usersData ?? []).map((u) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(insp.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${STATUS_STYLES[insp.status] ?? "bg-muted text-muted-foreground"}`}>
                      {insp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {insp.status === "queued" && (
                        <button
                          onClick={() => updateInspection.mutate({ inspectionId: insp.id, data: { status: "in-progress" } })}
                          disabled={updateInspection.isPending}
                          className="px-2 py-1 text-xs border border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] rounded hover:bg-[hsl(221,83%,53%)] hover:text-white transition-colors disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {insp.status === "in-progress" && (
                        <button
                          onClick={() => updateInspection.mutate({ inspectionId: insp.id, data: { status: "finished" } })}
                          disabled={updateInspection.isPending}
                          className="px-2 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {data?.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-xs border border-border rounded disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
              className="px-3 py-1.5 text-xs border border-border rounded disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">Next</button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePDIModal
          locationId={locationId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: getListYardInspectionsQueryKey() });
          }}
        />
      )}
    </div>
  );
}

export default function LocationsPage() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"overview" | "inspections">("overview");

  const { data: locations, isLoading } = useListYardLocations({
    query: { queryKey: getListYardLocationsQueryKey() },
  });

  const filtered = useMemo(() => {
    if (!locations) return [];
    if (!search.trim()) return locations as Location[];
    const q = search.toLowerCase();
    return (locations as Location[]).filter(
      (l) => l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q)
    );
  }, [locations, search]);

  const allSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const noneSelected = selectedIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeLocations = useMemo(() => {
    if (!locations) return [];
    if (noneSelected) return locations as Location[];
    return (locations as Location[]).filter((l) => selectedIds.has(l.id));
  }, [locations, selectedIds, noneSelected]);

  const singleSelected = selectedIds.size === 1 ? [...selectedIds][0] : null;

  const headerLabel = noneSelected
    ? `${filtered.length} locations selected`
    : selectedIds.size === 1
    ? (locations as Location[] | undefined)?.find((l) => l.id === singleSelected)?.name ?? "Location"
    : `${selectedIds.size} locations selected`;

  const headerSub = noneSelected
    ? "Combined"
    : selectedIds.size === 1
    ? TYPE_LABELS[(locations as Location[] | undefined)?.find((l) => l.id === singleSelected)?.type ?? ""] ?? ""
    : "Combined";

  const locationNamesPreview = useMemo(() => {
    if (!locations) return "";
    const active = noneSelected ? (locations as Location[]) : (locations as Location[]).filter((l) => selectedIds.has(l.id));
    const names = active.slice(0, 2).map((l) => l.name);
    const extra = active.length > 2 ? `+${active.length - 2} more` : null;
    return [names.join(" · "), extra].filter(Boolean).join(" · ");
  }, [locations, selectedIds, noneSelected]);

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-72 shrink-0 border-r border-border p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border bg-sidebar overflow-hidden">
        {/* Search */}
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search within locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            />
          </div>
        </div>

        {/* All Locations toggle */}
        <button
          onClick={toggleAll}
          className={`flex items-center gap-2 px-3 py-2.5 border-b border-border text-sm font-medium transition-colors shrink-0 ${
            allSelected || noneSelected ? "text-[hsl(221,83%,53%)]" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {allSelected || noneSelected ? (
            <CheckSquare className="w-4 h-4 text-[hsl(221,83%,53%)]" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground" />
          )}
          All Locations
        </button>

        {/* Location list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.map((loc) => {
            const isSelected = selectedIds.has(loc.id);
            const utilPct = loc.totalCapacity > 0
              ? Math.round((loc.occupied / loc.totalCapacity) * 100)
              : 0;

            return (
              <div
                key={loc.id}
                className={`px-3 py-3 cursor-pointer transition-colors ${
                  isSelected ? "bg-[hsl(221,83%,53%)]/8 border-l-2 border-[hsl(221,83%,53%)]" : "hover:bg-muted/30 border-l-2 border-transparent"
                }`}
                onClick={() => toggleOne(loc.id)}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[hsl(221,83%,53%)] shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide truncate">{loc.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                      {TYPE_LABELS_SHORT[loc.type] ?? loc.type}
                    </span>
                    <MoreVertical className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-2">
                  <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">{loc.city}</span>
                </div>

                {/* Capacity bar */}
                <div className="mb-1.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Capacity</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${utilPct}%`,
                          backgroundColor: utilPct > 85 ? "hsl(0,84%,60%)" : utilPct > 60 ? "hsl(43,74%,66%)" : "hsl(221,83%,53%)",
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                      {loc.occupied} / {loc.totalCapacity}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: "ARRIVED", value: loc.arrived },
                    { label: "IN YARD", value: loc.inYard },
                    { label: "READY PDI", value: loc.readyPDI, color: "text-amber-500" },
                    { label: "READY SALE", value: loc.readySale, color: "text-emerald-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-xs font-bold ${color ?? "text-foreground"}`}>{value}</p>
                      <p className="text-[8px] text-muted-foreground leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Right header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{headerLabel}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">{headerSub}</span>
                {locationNamesPreview && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{locationNamesPreview}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            {[
              { key: "overview", label: "OVERVIEW" },
              { key: "inspections", label: "INSPECTIONS & CHECKS" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as "overview" | "inspections")}
                className={`pb-2 text-xs font-semibold tracking-wide border-b-2 transition-colors ${
                  activeTab === key
                    ? "text-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <OverviewPanel locations={activeLocations} selectedIds={selectedIds} />
          )}
          {activeTab === "inspections" && (
            <InspectionsPanel locationId={singleSelected} />
          )}
        </div>
      </div>
    </div>
  );
}

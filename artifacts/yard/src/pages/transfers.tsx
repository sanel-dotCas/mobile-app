import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListYardLocations, getListYardLocationsQueryKey } from "@workspace/api-client-react";
import { ArrowRight, Plus, X, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type Transfer = {
  id: number; transferNumber: string; vehicleId: number;
  vehicleName: string; vehicleVin: string | null; vehicleStockNumber: string | null;
  fromLocationId: number; fromLocationName: string;
  toLocationId: number; toLocationName: string;
  status: string; requestedBy: string; approvedBy: string | null;
  notes: string | null; createdAt: string; completedAt: string | null;
};

type TransfersResponse = {
  transfers: Transfer[]; total: number; page: number; totalPages: number;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  approved: "bg-[hsl(221,83%,53%)]/15 text-[hsl(221,83%,53%)]",
  in_transit: "bg-purple-500/15 text-purple-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
};

type StatusFilter = "all" | "pending" | "approved" | "in_transit" | "completed" | "cancelled";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
];

type YardVehicle = { id: number; make: string; model: string; year: number; stockNumber: string; vin: string; locationId: number | null; locationName: string | null };

function CreateTransferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: locations } = useListYardLocations({ query: { queryKey: getListYardLocationsQueryKey() } });
  const { data: vehiclesData } = useQuery<{ vehicles: YardVehicle[] }>({
    queryKey: ["yard-vehicles-all"],
    queryFn: async () => {
      const r = await fetch("/api/yard/vehicles?limit=100", { credentials: "include" });
      return r.json();
    },
  });

  const [form, setForm] = useState({
    vehicleId: "", fromLocationId: "", toLocationId: "", notes: "",
  });

  const vehicles = vehiclesData?.vehicles ?? [];

  const selectedVehicle = vehicles.find((v) => String(v.id) === form.vehicleId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/yard/transfers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: Number(form.vehicleId),
          fromLocationId: Number(form.fromLocationId),
          toLocationId: Number(form.toLocationId),
          requestedBy: user?.name ?? "Manager",
          notes: form.notes || undefined,
        }),
      });
      if (!r.ok) throw new Error("Failed to create transfer");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Transfer request created" }); onSuccess(); },
    onError: () => toast({ title: "Failed to create transfer", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.fromLocationId || !form.toLocationId) return;
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-card border border-card-border rounded-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">New Transfer Request</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle *</label>
            <select required value={form.vehicleId}
              onChange={(e) => {
                const v = vehicles.find((x) => String(x.id) === e.target.value);
                setForm((f) => ({
                  ...f,
                  vehicleId: e.target.value,
                  fromLocationId: v?.locationId ? String(v.locationId) : f.fromLocationId,
                }));
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
              <option value="">Select vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} — {v.stockNumber}
                  {v.locationName ? ` (${v.locationName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedVehicle && (
            <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
              VIN: <span className="font-mono text-foreground">{selectedVehicle.vin}</span>
              {selectedVehicle.locationName && (
                <> · Currently at <span className="text-foreground">{selectedVehicle.locationName}</span></>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">From *</label>
              <select required value={form.fromLocationId}
                onChange={(e) => setForm((f) => ({ ...f, fromLocationId: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
                <option value="">Select...</option>
                {(locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">To (Showroom) *</label>
              <select required value={form.toLocationId}
                onChange={(e) => setForm((f) => ({ ...f, toLocationId: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]">
                <option value="">Select...</option>
                {(locations ?? [])
                  .filter((l) => String(l.id) !== form.fromLocationId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Reason for transfer, special instructions..."
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)] resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || !form.vehicleId || !form.fromLocationId || !form.toLocationId}
              className="flex-1 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50">
              {createMutation.isPending ? "Creating..." : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isManager = user?.role === "yard_manager" || user?.role === "admin";

  const params = { status: statusFilter === "all" ? undefined : statusFilter, page, limit: 15 };

  const { data, isLoading } = useQuery<TransfersResponse>({
    queryKey: ["yard-transfers", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      qs.set("page", String(params.page));
      qs.set("limit", String(params.limit));
      const r = await fetch(`/api/yard/transfers?${qs}`, { credentials: "include" });
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, approvedBy }: { id: number; status: string; approvedBy?: string }) => {
      const r = await fetch(`/api/yard/transfers/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvedBy }),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Transfer updated" });
      queryClient.invalidateQueries({ queryKey: ["yard-transfers"] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transfer Requests</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} total · Yard to showroom movements</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors"
          >
            <Plus className="w-4 h-4" /> New Transfer
          </button>
        )}
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map(({ value, label }) => (
          <button key={value} onClick={() => { setStatusFilter(value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === value
                ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,53%)]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Transfer #</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Route</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Requested By</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              {isManager && <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                </tr>
              ))
            ) : (data?.transfers ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No transfers found</p>
                  {isManager && (
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 px-4 py-1.5 text-xs bg-[hsl(221,83%,53%)] text-white rounded hover:bg-[hsl(221,83%,45%)] transition-colors">
                      Create first transfer
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              (data?.transfers ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.transferNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{t.vehicleName}</p>
                    {t.vehicleStockNumber && (
                      <p className="text-xs text-muted-foreground font-mono">{t.vehicleStockNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-foreground font-medium">{t.fromLocationName}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[hsl(221,83%,53%)] font-medium">{t.toLocationName}</span>
                    </div>
                    {t.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{t.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{t.requestedBy}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[t.status] ?? "bg-muted text-muted-foreground"}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === "pending" && (
                          <button
                            onClick={() => updateMutation.mutate({ id: t.id, status: "approved", approvedBy: user?.name ?? "Manager" })}
                            disabled={updateMutation.isPending}
                            className="px-2 py-1 text-xs border border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] rounded hover:bg-[hsl(221,83%,53%)] hover:text-white transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {t.status === "approved" && (
                          <button
                            onClick={() => updateMutation.mutate({ id: t.id, status: "in_transit" })}
                            disabled={updateMutation.isPending}
                            className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50"
                          >
                            Start Transit
                          </button>
                        )}
                        {t.status === "in_transit" && (
                          <button
                            onClick={() => updateMutation.mutate({ id: t.id, status: "completed" })}
                            disabled={updateMutation.isPending}
                            className="px-2 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            Complete
                          </button>
                        )}
                        {(t.status === "pending" || t.status === "approved") && (
                          <button
                            onClick={() => updateMutation.mutate({ id: t.id, status: "cancelled" })}
                            disabled={updateMutation.isPending}
                            className="px-2 py-1 text-xs border border-border text-muted-foreground rounded hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} of {data?.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-border rounded disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
                className="px-3 py-1.5 text-xs border border-border rounded disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTransferModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["yard-transfers"] });
          }}
        />
      )}
    </div>
  );
}

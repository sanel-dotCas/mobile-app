import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useListYardVehicles,
  getListYardVehiclesQueryKey,
  useListYardLocations,
  getListYardLocationsQueryKey,
  useCreateYardVehicle,
  useUpdateYardVehicle,
} from "@workspace/api-client-react";
import { Search, Plus, ChevronDown, ChevronUp, X, Lock, MapPin, ArrowRightCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type VehicleStatus = "all" | "available" | "in_transit" | "pdi_pending" | "sold";

const STATUS_CHIPS: { value: VehicleStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "in_transit", label: "In Transit" },
  { value: "pdi_pending", label: "PDI Pending" },
  { value: "sold", label: "Sold" },
];

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-600",
  in_transit: "bg-amber-500/15 text-amber-600",
  pdi_pending: "bg-[hsl(221,83%,53%)]/15 text-[hsl(221,83%,53%)]",
  sold: "bg-muted text-muted-foreground",
};

type Vehicle = {
  id: number; vin: string; stockNumber: string; make: string; model: string;
  year: number; color: string | null; mileage: number | null; condition: string | null;
  status: string; locationId: number | null; locationName: string | null;
  spotId: number | null; spotCode: string | null; zoneName: string | null;
  price: number | null; arrivedAt: string | null;
};

function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { data: locations } = useListYardLocations({ query: { queryKey: getListYardLocationsQueryKey() } });
  const [form, setForm] = useState({
    vin: "", stockNumber: "", make: "", model: "", year: new Date().getFullYear().toString(),
    color: "", mileage: "", condition: "new", status: "available", locationId: "",
  });

  const createVehicle = useCreateYardVehicle({
    mutation: {
      onSuccess: () => { toast({ title: "Vehicle added" }); onSuccess(); },
      onError: () => toast({ title: "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vin || !form.stockNumber || !form.make || !form.model) return;
    createVehicle.mutate({
      data: {
        vin: form.vin, stockNumber: form.stockNumber, make: form.make,
        model: form.model, year: Number(form.year), color: form.color || undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        condition: (form.condition as "new" | "used") || undefined,
        status: form.status as "available" | "in_transit" | "pdi_pending" | "sold",
        locationId: form.locationId ? Number(form.locationId) : undefined,
      },
    });
  };

  const field = (key: keyof typeof form, label: string, type = "text", required = false) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-card border border-card-border rounded-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Add Vehicle</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("vin", "VIN", "text", true)}
            {field("stockNumber", "Stock #", "text", true)}
            {field("make", "Make", "text", true)}
            {field("model", "Model", "text", true)}
            {field("year", "Year", "number")}
            {field("color", "Color")}
            {field("mileage", "Mileage (km)", "number")}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="available">Available</option>
              <option value="in_transit">In Transit</option>
              <option value="pdi_pending">PDI Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <select
              value={form.locationId}
              onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="">— None —</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              data-testid="button-submit-vehicle"
              disabled={createVehicle.isPending}
              className="flex-1 py-2 bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,45%)] text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {createVehicle.isPending ? "Adding..." : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Spot = { id: number; code: string; zoneId: number; zoneName: string | null; isOccupied: boolean };

function AssignToYardModal({
  vehicle,
  onClose,
  onSuccess,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: locations } = useListYardLocations({ query: { queryKey: getListYardLocationsQueryKey() } });

  const [selectedLocationId, setSelectedLocationId] = useState(
    vehicle.locationId ? String(vehicle.locationId) : ""
  );
  const [selectedSpotId, setSelectedSpotId] = useState(
    vehicle.spotId ? String(vehicle.spotId) : ""
  );

  const { data: spotsData } = useQuery<{ spots: Spot[] }>({
    queryKey: ["yard-spots-for-location", selectedLocationId],
    queryFn: async () => {
      if (!selectedLocationId) return { spots: [] };
      const r = await fetch(`/api/yard/spots?locationId=${selectedLocationId}&limit=200`, {
        credentials: "include",
      });
      return r.json();
    },
    enabled: Boolean(selectedLocationId),
  });

  const availableSpots = (spotsData?.spots ?? []).filter(
    (s) => !s.isOccupied || String(s.id) === String(vehicle.spotId)
  );

  const update = useUpdateYardVehicle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Vehicle assigned to yard" });
        queryClient.invalidateQueries({ queryKey: getListYardVehiclesQueryKey() });
        onSuccess();
      },
      onError: () => toast({ title: "Assignment failed", variant: "destructive" }),
    },
  });

  const handleSave = () => {
    if (!selectedLocationId) return;
    update.mutate({
      vehicleId: vehicle.id,
      data: {
        locationId: Number(selectedLocationId),
        spotId: selectedSpotId ? Number(selectedSpotId) : undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-card border border-card-border rounded-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Assign to Yard / Lot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.stockNumber}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Yard / Location *</label>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setSelectedSpotId("");
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
            >
              <option value="">Select location...</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {selectedLocationId && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Parking Spot{" "}
                <span className="text-muted-foreground font-normal">(optional — {availableSpots.length} available)</span>
              </label>
              <select
                value={selectedSpotId}
                onChange={(e) => setSelectedSpotId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
              >
                <option value="">— No specific spot —</option>
                {availableSpots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}{s.zoneName ? ` · ${s.zoneName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-border rounded text-sm text-foreground hover:border-[hsl(221,83%,53%)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedLocationId || update.isPending}
              className="flex-1 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors disabled:opacity-50"
            >
              {update.isPending ? "Saving..." : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleRow({ vehicle, canViewPrice }: { vehicle: Vehicle; canViewPrice: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <tr
        data-testid={`row-vehicle-${vehicle.id}`}
        onClick={() => setExpanded(!expanded)}
        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          <p className="text-xs text-muted-foreground font-mono">{vehicle.stockNumber}</p>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">{vehicle.vin}</td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[vehicle.status] ?? "bg-muted text-muted-foreground"}`}>
            {vehicle.status?.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
          {vehicle.locationName ?? "—"}
          {vehicle.spotCode && <span className="ml-1 font-mono">· {vehicle.spotCode}</span>}
        </td>
        <td className="px-4 py-3">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20 border-b border-border">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
              <div>
                <p className="text-muted-foreground mb-0.5">VIN</p>
                <p className="text-foreground font-mono">{vehicle.vin}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Condition</p>
                <p className="text-foreground capitalize">{vehicle.condition ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Color</p>
                <p className="text-foreground">{vehicle.color ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Mileage</p>
                <p className="text-foreground">{vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} km` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Location</p>
                <p className="text-foreground">{vehicle.locationName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Spot</p>
                <p className="text-foreground font-mono">{vehicle.spotCode ?? "—"} {vehicle.zoneName ? `· ${vehicle.zoneName}` : ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Price</p>
                {canViewPrice ? (
                  <p className="text-foreground font-medium">{vehicle.price != null ? `QAR ${Number(vehicle.price).toLocaleString()}` : "—"}</p>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground italic">
                    <Lock className="w-3 h-3" /> Management only
                  </span>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Arrived</p>
                <p className="text-foreground">{vehicle.arrivedAt ? new Date(vehicle.arrivedAt).toLocaleDateString() : "—"}</p>
              </div>
            </div>
            {/* Actions row */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                data-testid={`button-assign-yard-${vehicle.id}`}
                onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] rounded hover:bg-[hsl(221,83%,53%)] hover:text-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                {vehicle.locationName ? "Reassign Yard/Spot" : "Assign to Yard/Lot"}
              </button>
              {vehicle.locationName && (
                <span className="text-xs text-muted-foreground">
                  Currently at <span className="text-foreground font-medium">{vehicle.locationName}</span>
                  {vehicle.spotCode && <span className="font-mono"> · {vehicle.spotCode}</span>}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
      {showAssign && (
        <AssignToYardModal
          vehicle={vehicle}
          onClose={() => setShowAssign(false)}
          onSuccess={() => {
            setShowAssign(false);
            setExpanded(false);
            queryClient.invalidateQueries({ queryKey: getListYardVehiclesQueryKey() });
          }}
        />
      )}
    </>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<VehicleStatus>("all");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Pricing visible only to yard_manager and admin roles
  const canViewPrice = user?.role === "yard_manager" || user?.role === "admin";

  const params = { q: debouncedSearch || undefined, status: status === "all" ? undefined : status, page, limit: 15 };
  const { data, isLoading } = useListYardVehicles(params, {
    query: { queryKey: getListYardVehiclesQueryKey(params) },
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vehicle Inventory</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} vehicles</p>
        </div>
        {/* Only managers can add vehicles */}
        {canViewPrice && (
          <button
            data-testid="button-add-vehicle"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(221,83%,53%)] text-white text-sm font-medium rounded hover:bg-[hsl(221,83%,45%)] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      </div>

      {/* Role indicator */}
      {!canViewPrice && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <Lock className="w-3 h-3" />
          <span>Operator view — pricing and financial data is restricted to management.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          data-testid="input-search-vehicles"
          type="search"
          placeholder="Search VIN, stock number, make, model..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-card-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-[hsl(221,83%,53%)]"
        />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map(({ value, label }) => (
          <button
            key={value}
            data-testid={`filter-${value}`}
            onClick={() => { setStatus(value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              status === value
                ? "bg-[hsl(221,83%,53%)] border-[hsl(221,83%,53%)] text-white"
                : "border-border text-muted-foreground hover:border-[hsl(221,83%,53%)] hover:text-[hsl(221,83%,53%)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-vehicles">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">VIN</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Location / Spot</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : (data?.vehicles ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No vehicles found</td>
                </tr>
              ) : (
                (data?.vehicles ?? []).map((v) => <VehicleRow key={v.id} vehicle={v as Vehicle} canViewPrice={canViewPrice} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} of {data?.totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-border rounded text-foreground disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.totalPages ?? 1)}
                className="px-3 py-1.5 text-xs border border-border rounded text-foreground disabled:opacity-40 hover:border-[hsl(221,83%,53%)] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddVehicleModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: getListYardVehiclesQueryKey() });
          }}
        />
      )}
    </div>
  );
}

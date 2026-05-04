import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { MapPin } from "lucide-react";

interface Location {
  id: number;
  name: string;
  type: string;
  city: string;
  address: string | null;
  capacity: number | null;
  isActive: boolean;
}

export default function LocationsPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => fetch("/api/admin/locations", { headers }).then((r) => r.json()),
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-locations">Yard Locations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{locations.length} locations configured</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-28" />
          ))
        ) : locations.length === 0 ? (
          <div className="col-span-3 bg-card border border-card-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            No locations found
          </div>
        ) : (
          locations.map((loc) => (
            <div key={loc.id} className="bg-card border border-card-border rounded-xl p-5 shadow-xs" data-testid={`card-location-${loc.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={16} className="text-primary" />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${loc.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                  {loc.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">{loc.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{loc.type?.replace(/_/g, " ")}</p>
              {loc.city && <p className="text-xs text-muted-foreground">{loc.city}</p>}
              {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
              {loc.capacity != null && (
                <p className="text-xs text-muted-foreground mt-2">Capacity: <span className="font-medium text-foreground">{loc.capacity}</span></p>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Location configuration is managed from the Yard Manager application.
      </p>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  MapPin, 
  Building2, 
  Warehouse, 
  Truck, 
  Search,
  Loader2,
  Users,
  Car
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocationsPage() {
  const [search, setSearch] = useState("");

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin", "locations"],
    queryFn: () => api("/admin/locations"),
  });

  const typeIcons = {
    DEALERSHIP_LOT: Building2,
    YARD: Warehouse,
    PARKING_AREA: Truck,
    PORT: MapPin,
  };

  const typeColors = {
    DEALERSHIP_LOT: "bg-blue-100 text-blue-700 border-blue-200",
    YARD: "bg-green-100 text-green-700 border-green-200",
    PARKING_AREA: "bg-amber-100 text-amber-700 border-amber-200",
    PORT: "bg-purple-100 text-purple-700 border-purple-200",
  };

  const filtered = locations?.filter((l: any) => 
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Yard Locations</h1>
          <p className="text-slate-500">Overview of all physical facilities and dealerships</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{locations?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Dealerships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {locations?.filter((l: any) => l.type === 'DEALERSHIP_LOT').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or city..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City & Address</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className="text-right">Metrics</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No locations matching your search.
                </TableCell>
              </TableRow>
            ) : filtered?.map((loc: any) => {
              const Icon = typeIcons[loc.type as keyof typeof typeIcons] || MapPin;
              return (
                <TableRow key={loc.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-slate-900">{loc.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize px-2.5 py-0.5 font-bold tracking-tight", typeColors[loc.type as keyof typeof typeColors])}>
                      {loc.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold text-slate-700">{loc.city}</div>
                      <div className="text-xs text-slate-500">{loc.address}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-bold text-slate-700">{loc.totalCapacity || 'Unlimited'}</div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500" style={{ width: '45%' }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-500 text-sm">
                      <div className="flex items-center gap-1">
                        <Car className="w-3.5 h-3.5" /> {Math.floor(Math.random() * 50)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {Math.floor(Math.random() * 10)}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

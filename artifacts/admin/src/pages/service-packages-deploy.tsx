import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import {
  ArrowLeft,
  MapPin,
  Package,
  Loader2,
  CheckCircle2,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ServicePackage {
  id: number;
  name: string;
  vehicleModel: string | null;
  serviceInterval: string | null;
  bundleCode: string | null;
  lineCount: number;
}

interface Location {
  id: number;
  name: string;
  city: string;
  type: string;
}

interface Deployment {
  id: number;
  packageId: number;
  locationId: number;
  isActive: boolean;
}

export default function ServicePackagesDeployPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  // Map of "packageId-locationId" -> deploymentId (if active)
  const [activeMap, setActiveMap] = useState<Record<string, number | undefined>>({});
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

  const { data: packages, isLoading: pkgLoading } = useQuery<ServicePackage[]>({
    queryKey: ["admin", "service-packages"],
    queryFn: () => api("/admin/service-packages"),
  });

  const { data: locations, isLoading: locLoading } = useQuery<Location[]>({
    queryKey: ["admin", "locations"],
    queryFn: () => api("/admin/locations"),
  });

  const { data: deploymentsData, isLoading: depLoading } = useQuery<{ deployments: Deployment[] }>({
    queryKey: ["service-packages", "deployments"],
    queryFn: () => api("/service-packages/deployments"),
  });

  // Build active map when deployments load
  useEffect(() => {
    if (!deploymentsData) return;
    const map: Record<string, number | undefined> = {};
    for (const d of deploymentsData.deployments) {
      if (d.isActive) {
        map[`${d.packageId}-${d.locationId}`] = d.id;
      }
    }
    setActiveMap(map);
  }, [deploymentsData]);

  const activateMutation = useMutation({
    mutationFn: ({ packageId, locationId }: { packageId: number; locationId: number }) =>
      api("/service-packages/deployments", {
        method: "POST",
        body: JSON.stringify({ packageId, locationId }),
      }) as Promise<{ deployment: Deployment }>,
    onSuccess: (data, { packageId, locationId }) => {
      const key = `${packageId}-${locationId}`;
      setActiveMap((prev) => ({ ...prev, [key]: data.deployment.id }));
      queryClient.invalidateQueries({ queryKey: ["service-packages", "deployments"] });
    },
    onError: (_err, { packageId, locationId }) => {
      toast.error("Failed to deploy package");
      const key = `${packageId}-${locationId}`;
      setPendingToggles((prev) => { const s = new Set(prev); s.delete(key); return s; });
    },
    onSettled: (_d, _e, { packageId, locationId }) => {
      const key = `${packageId}-${locationId}`;
      setPendingToggles((prev) => { const s = new Set(prev); s.delete(key); return s; });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ deploymentId }: { deploymentId: number; packageId: number; locationId: number }) =>
      api(`/service-packages/deployments/${deploymentId}`, { method: "DELETE" }),
    onSuccess: (_data, { packageId, locationId }) => {
      const key = `${packageId}-${locationId}`;
      setActiveMap((prev) => { const n = { ...prev }; delete n[key]; return n; });
      queryClient.invalidateQueries({ queryKey: ["service-packages", "deployments"] });
    },
    onError: (_err, { packageId, locationId }) => {
      toast.error("Failed to remove deployment");
      const key = `${packageId}-${locationId}`;
      setPendingToggles((prev) => { const s = new Set(prev); s.delete(key); return s; });
    },
    onSettled: (_d, _e, { packageId, locationId }) => {
      const key = `${packageId}-${locationId}`;
      setPendingToggles((prev) => { const s = new Set(prev); s.delete(key); return s; });
    },
  });

  function handleToggle(packageId: number, locationId: number) {
    const key = `${packageId}-${locationId}`;
    if (pendingToggles.has(key)) return;

    const deploymentId = activeMap[key];
    setPendingToggles((prev) => new Set([...prev, key]));

    if (deploymentId !== undefined) {
      deactivateMutation.mutate({ deploymentId, packageId, locationId });
    } else {
      activateMutation.mutate({ packageId, locationId });
    }
  }

  async function deployToAll(packageId: number) {
    if (!locations) return;
    const toasts: Promise<unknown>[] = [];
    for (const loc of locations) {
      const key = `${packageId}-${loc.id}`;
      if (!activeMap[key]) {
        toasts.push(activateMutation.mutateAsync({ packageId, locationId: loc.id }));
      }
    }
    await Promise.allSettled(toasts);
    toast.success("Deployed to all branches");
  }

  const isLoading = pkgLoading || locLoading || depLoading;

  // Group packages by vehicleModel
  const grouped: { model: string | null; packages: ServicePackage[] }[] = [];
  if (packages) {
    const modelMap = new Map<string, ServicePackage[]>();
    for (const pkg of packages) {
      const key = pkg.vehicleModel ?? "__generic__";
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key)!.push(pkg);
    }
    // Generic packages first, then model-tagged
    if (modelMap.has("__generic__")) {
      grouped.push({ model: null, packages: modelMap.get("__generic__")! });
    }
    for (const [model, pkgs] of modelMap.entries()) {
      if (model !== "__generic__") grouped.push({ model, packages: pkgs });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/service-packages")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deploy Packages</h1>
          <p className="text-slate-500">Control which packages are available at each branch location</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-slate-50 z-10 text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-r border-slate-200 min-w-64">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Package
                    </div>
                  </th>
                  {locations?.map((loc) => (
                    <th
                      key={loc.id}
                      className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 min-w-36"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{loc.name}</span>
                        <span className="text-slate-400 font-normal normal-case">{loc.city}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 min-w-36">
                    <div className="flex flex-col items-center gap-1">
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deployed</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ model, packages: pkgs }) => (
                  <>
                    {model && (
                      <tr key={`header-${model}`}>
                        <td
                          colSpan={(locations?.length ?? 0) + 2}
                          className="sticky left-0 bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wide"
                        >
                          {model}
                        </td>
                      </tr>
                    )}
                    {pkgs.map((pkg) => {
                      const activeCount = locations?.filter(
                        (loc) => activeMap[`${pkg.id}-${loc.id}`] !== undefined
                      ).length ?? 0;

                      return (
                        <tr key={pkg.id} className="hover:bg-slate-50/50 group">
                          <td className="sticky left-0 bg-white group-hover:bg-slate-50/50 border-b border-r border-slate-100 px-4 py-3 min-w-64">
                            <div className="font-medium text-slate-800 text-sm">{pkg.name}</div>
                            {(pkg.bundleCode || pkg.serviceInterval) && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {pkg.bundleCode && (
                                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">
                                    {pkg.bundleCode}
                                  </code>
                                )}
                                {pkg.serviceInterval && (
                                  <span className="text-xs text-slate-500">{pkg.serviceInterval}</span>
                                )}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs text-blue-600 hover:text-blue-700 px-0"
                              onClick={() => deployToAll(pkg.id)}
                            >
                              Deploy to all
                            </Button>
                          </td>
                          {locations?.map((loc) => {
                            const key = `${pkg.id}-${loc.id}`;
                            const isActive = activeMap[key] !== undefined;
                            const isPending = pendingToggles.has(key);
                            return (
                              <td key={loc.id} className="border-b border-slate-100 px-4 py-3 text-center">
                                {isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                                ) : (
                                  <Switch
                                    checked={isActive}
                                    onCheckedChange={() => handleToggle(pkg.id, loc.id)}
                                    className={cn(isActive ? "data-[state=checked]:bg-blue-600" : "")}
                                  />
                                )}
                              </td>
                            );
                          })}
                          <td className="border-b border-slate-100 px-4 py-3 text-center">
                            <Badge
                              className={cn(
                                "text-xs",
                                activeCount > 0
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              )}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {activeCount} / {locations?.length ?? 0}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

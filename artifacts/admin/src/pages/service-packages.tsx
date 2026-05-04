import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface ServicePackage {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  lineCount: number;
  createdAt: string;
}

export default function ServicePackagesPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data: packages = [], isLoading } = useQuery<ServicePackage[]>({
    queryKey: ["admin-service-packages"],
    queryFn: () => fetch("/api/admin/service-packages", { headers }).then((r) => r.json()),
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-service-packages">Service Packages</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{packages.length} packages configured</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No service packages found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Package</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Lines</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-package-${pkg.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: pkg.color ? `${pkg.color}20` : undefined }}
                      >
                        {pkg.icon}
                      </div>
                      <span className="font-medium text-foreground">{pkg.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{pkg.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-accent text-accent-foreground text-xs font-semibold">
                      {pkg.lineCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", pkg.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600")}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(pkg.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Service packages and their line items are managed from the Yard Manager application.
      </p>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, Clock } from "lucide-react";

interface SystemSettings {
  inspectionTypes: Array<{ key: string; label: string }>;
  defaultInspectionIntervalDays: number;
  notificationsEnabled: boolean;
  version: string;
  modules: Array<{ id: string; label: string; enabled: boolean }>;
}

export default function InspectionSettingsPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data, isLoading } = useQuery<SystemSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin/settings", { headers }).then((r) => r.json()),
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-inspection-settings">Inspection Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configured inspection types and intervals</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <Clock size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Default Inspection Interval</h2>
        </div>
        {isLoading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground" data-testid="text-interval-days">{data?.defaultInspectionIntervalDays}</span>
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Vehicles are flagged for re-inspection after this period.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <ClipboardList size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Inspection Types</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Key</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Display Label</th>
              </tr>
            </thead>
            <tbody>
              {(data?.inspectionTypes ?? []).map((t) => (
                <tr key={t.key} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`row-inspection-type-${t.key}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.key}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Inspection type definitions are configured in the system codebase.
      </p>
    </div>
  );
}

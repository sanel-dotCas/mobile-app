import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Smartphone, Bell, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemSettings {
  mobileCredentials: Array<{ code: string; name: string; role: string }>;
  inspectionTypes: Array<{ key: string; label: string }>;
  defaultInspectionIntervalDays: number;
  notificationsEnabled: boolean;
  version: string;
  modules: Array<{ id: string; label: string; enabled: boolean }>;
}

const ROLE_COLORS: Record<string, string> = {
  supervisor: "bg-blue-100 text-blue-800",
  technician: "bg-emerald-100 text-emerald-800",
  estimator: "bg-purple-100 text-purple-800",
};

export default function SettingsPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data, isLoading } = useQuery<SystemSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin/settings", { headers }).then((r) => r.json()),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <Settings size={18} className="text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="heading-settings">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configuration overview and system info</p>
        </div>
      </div>

      {/* System info */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">System Information</h2>
        </div>
        {isLoading ? <div className="h-12 bg-muted animate-pulse rounded" /> : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="text-sm font-medium text-foreground mt-0.5" data-testid="text-version">{data?.version}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Push Notifications</p>
              <p className="text-sm font-medium text-foreground mt-0.5" data-testid="text-notifications">
                {data?.notificationsEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modules */}
      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Layers size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">System Modules</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-border">
            {(data?.modules ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3" data-testid={`row-module-${m.id}`}>
                <span className="text-sm font-medium text-foreground">{m.label}</span>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", m.enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600")}>
                  {m.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile credentials */}
      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Smartphone size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Mobile App Credentials</h2>
        </div>
        <div className="px-5 py-2 border-b border-border bg-amber-50">
          <p className="text-xs text-amber-700">These credentials are used for DMS mobile app login. Keep them secure.</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User Code</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
              </tr>
            </thead>
            <tbody>
              {(data?.mobileCredentials ?? []).map((c) => (
                <tr key={c.code} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`row-credential-${c.code}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", ROLE_COLORS[c.role] ?? "bg-gray-100 text-gray-700")}>
                      {c.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notifications info */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Push Notifications</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Push notifications are delivered via Expo to mobile technician devices. Notifications are sent when vehicle inspections fail or when urgent vehicle conditions are detected. Individual user notification preferences are managed from the Yard Manager application.
        </p>
      </div>
    </div>
  );
}

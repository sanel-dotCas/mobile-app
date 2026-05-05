import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Settings as SettingsIcon, 
  Database, 
  Layers, 
  Shield, 
  Terminal,
  CheckCircle2,
  XCircle,
  Bell,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api("/admin/settings"),
  });

  const { data: retentionData, isLoading: retentionLoading, isError: retentionError } = useQuery({
    queryKey: ["admin", "settings", "notification-retention"],
    queryFn: () => api("/admin/settings/notification-retention"),
  });

  const [retentionInput, setRetentionInput] = useState<string>("");

  const currentRetention: number | undefined = retentionData?.notificationRetentionDays;

  const retentionMutation = useMutation({
    mutationFn: (days: number) =>
      api("/admin/settings/notification-retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "settings", "notification-retention"], data);
      setRetentionInput("");
      toast.success(`Notification history retention updated to ${data.notificationRetentionDays} days`);
    },
    onError: () => {
      toast.error("Failed to update retention period");
    },
  });

  const handleRetentionSave = () => {
    const parsed = parseInt(retentionInput, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 3650) {
      toast.error("Enter a value between 1 and 3650 days");
      return;
    }
    retentionMutation.mutate(parsed);
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings & Status</h1>
        <p className="text-slate-500">Core system configuration and database statistics</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* System Info */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>System Database</CardTitle>
                <CardDescription>Record counts and infrastructure info</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Users</div>
                <div className="text-2xl font-bold text-slate-900">{settings.dbInfo.users}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Techs</div>
                <div className="text-2xl font-bold text-slate-900">{settings.dbInfo.technicians}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Vehicles</div>
                <div className="text-2xl font-bold text-slate-900">{settings.dbInfo.vehicles}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">API Version</div>
                <div className="text-sm font-mono font-bold text-blue-600">v{settings.version || '1.2.0'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Retention */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Notification History Retention</CardTitle>
                <CardDescription>How long notification records are kept before automatic cleanup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Setting</div>
                {retentionLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : retentionError ? (
                  <div className="text-sm text-red-500 font-medium">Could not load setting</div>
                ) : (
                  <div className="text-2xl font-bold text-slate-900">
                    {currentRetention} <span className="text-base font-medium text-slate-500">days</span>
                  </div>
                )}
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-semibold">
                Active
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention-days" className="text-sm font-semibold text-slate-700">
                Change retention period (days)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="retention-days"
                  type="number"
                  min={1}
                  max={3650}
                  placeholder={String(currentRetention ?? 30)}
                  value={retentionInput}
                  onChange={(e) => setRetentionInput(e.target.value)}
                  className="w-32"
                  onKeyDown={(e) => { if (e.key === "Enter") handleRetentionSave(); }}
                />
                <Button
                  onClick={handleRetentionSave}
                  disabled={retentionMutation.isPending || !retentionInput}
                  size="sm"
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  {retentionMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Notifications older than this many days are deleted automatically each day. Range: 1–3650 days.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Modules */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
             <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Enabled Modules</CardTitle>
                <CardDescription>Active features across the platform</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {settings.modules?.map((mod: any) => (
                <div key={mod.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    {mod.enabled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                    <span className="font-semibold text-slate-700">{mod.label}</span>
                  </div>
                  <Badge variant={mod.enabled ? "default" : "outline"} className={mod.enabled ? "bg-green-600" : ""}>
                    {mod.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              ))}
              {!settings.modules && (
                <div className="text-center py-8 text-slate-500 italic">Module list not available in this environment.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inspection Types */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Inspection Registry</CardTitle>
                <CardDescription>Configured yard inspection types</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {settings.inspectionTypes?.map((type: any) => (
                <Badge key={type.key} variant="outline" className="px-3 py-1.5 bg-white text-slate-700 border-slate-200 font-bold capitalize">
                  {type.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Roles Info */}
        <Card className="border-slate-200 shadow-sm overflow-hidden md:col-span-2">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Role Mapping</CardTitle>
                <CardDescription>Standardized role identifiers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Yard Platform Roles</h4>
              <div className="flex flex-wrap gap-2">
                {settings.yardRoles?.map((role: string) => (
                  <code key={role} className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono font-bold capitalize">
                    {role.replace('_', ' ')}
                  </code>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">DMS Mobile Roles</h4>
              <div className="flex flex-wrap gap-2">
                {settings.dmsRoles?.map((role: string) => (
                  <code key={role} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded font-mono font-bold capitalize">
                    {role.replace('_', ' ')}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

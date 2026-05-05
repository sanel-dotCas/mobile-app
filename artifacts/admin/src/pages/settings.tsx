import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Settings as SettingsIcon, 
  Database, 
  Layers, 
  Shield, 
  Info,
  CheckCircle2,
  XCircle,
  Server,
  Terminal,
  Cpu
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api("/admin/settings"),
  });

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
                <div key={mod.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    {mod.enabled ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                    <span className="font-semibold text-slate-700">{mod.name}</span>
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
                <Badge key={type.value} variant="outline" className="px-3 py-1.5 bg-white text-slate-700 border-slate-200 font-bold capitalize">
                  {type.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Roles Info */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
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

import { useQuery } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Shield, 
  Info, 
  Check, 
  X,
  Lock,
  Loader2,
  Smartphone,
  Layout
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export default function RolesPage() {
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api("/admin/roles"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  const { availablePermissions, yardRoles, dmsRoles, yardRoleNames, dmsRoleNames } = rolesData;

  const renderPermissionGrid = (roleMap: any, roleNames: string[], title: string, description: string, Icon: any) => (
    <Card className="border-slate-200 shadow-sm flex flex-col">
      <CardHeader className="border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-auto flex-1">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[200px] bg-slate-50">Permission</TableHead>
              {roleNames.map(role => (
                <TableHead key={role} className="text-center bg-slate-50">
                  <span className="capitalize">{role.replace('_', ' ')}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {availablePermissions.map((perm: string) => (
              <TableRow key={perm} className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-slate-700 py-3">
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {perm}
                  </code>
                </TableCell>
                {roleNames.map(role => {
                  const hasPerm = roleMap[role]?.includes(perm);
                  return (
                    <TableCell key={role} className="text-center">
                      <div className="flex justify-center">
                        <Checkbox checked={hasPerm} disabled className="disabled:opacity-100 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles & Permissions</h1>
        <p className="text-slate-500">System-wide permission matrix overview</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200 text-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="font-bold">System Configuration Only</AlertTitle>
        <AlertDescription>
          Role permissions are configured at the system level. Contact your administrator to request changes to these matrices.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        {renderPermissionGrid(
          yardRoles, 
          yardRoleNames, 
          "Yard & Admin Roles", 
          "Permissions for the web-based management platform",
          Layout
        )}
        {renderPermissionGrid(
          dmsRoles, 
          dmsRoleNames, 
          "DMS Mobile Roles", 
          "Permissions for technicians and estimators on mobile",
          Smartphone
        )}
      </div>
    </div>
  );
}

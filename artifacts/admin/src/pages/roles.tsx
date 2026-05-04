import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Check, X } from "lucide-react";

interface RolesData {
  availablePermissions: string[];
  yardRoles: Record<string, string[]>;
  dmsRoles: Record<string, string[]>;
  yardRoleNames: string[];
  dmsRoleNames: string[];
}

const PERMISSION_LABELS: Record<string, string> = {
  view_pricing: "View Pricing",
  move_vehicles: "Move Vehicles",
  create_inspections: "Create Inspections",
  manage_users: "Manage Users",
  view_reports: "View Reports",
  configure_settings: "Configure Settings",
  view_all_locations: "View All Locations",
  view_yard: "View Yard",
  manage_technicians: "Manage Technicians",
  manage_jobs: "Manage Jobs",
  manage_parts: "Manage Parts",
  manage_service_packages: "Manage Service Packages",
  view_accounting: "View Accounting",
  manage_accounting: "Manage Accounting",
  view_hr: "View HR",
  manage_hr: "Manage HR",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  yard_manager: "Yard Manager",
  yard_operator: "Yard Operator",
  supervisor: "Supervisor",
  technician: "Technician",
  estimator: "Estimator",
};

function PermissionMatrix({
  title,
  roleNames,
  rolePermissions,
  permissions,
}: {
  title: string;
  roleNames: string[];
  rolePermissions: Record<string, string[]>;
  permissions: string[];
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-52">Permission</th>
              {roleNames.map((r) => (
                <th key={r} className="text-center px-4 py-3 font-semibold text-muted-foreground min-w-[120px]">
                  {ROLE_LABELS[r] ?? r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`row-perm-${perm}`}>
                <td className="px-4 py-2.5 text-foreground font-medium">
                  {PERMISSION_LABELS[perm] ?? perm.replace(/_/g, " ")}
                </td>
                {roleNames.map((role) => {
                  const has = (rolePermissions[role] ?? []).includes(perm);
                  return (
                    <td key={role} className="px-4 py-2.5 text-center">
                      {has ? (
                        <Check size={15} className="text-emerald-600 mx-auto" data-testid={`check-${role}-${perm}`} />
                      ) : (
                        <X size={14} className="text-muted-foreground/30 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { userId } = useAuth();
  const headers = { "x-yard-user-id": userId! };

  const { data, isLoading } = useQuery<RolesData>({
    queryKey: ["admin-roles"],
    queryFn: () => fetch("/api/admin/roles", { headers }).then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!data) return null;

  const yardPerms = data.availablePermissions.filter((p) =>
    Object.values(data.yardRoles).some((rp) => rp.includes(p))
  );
  const dmsPerms = data.availablePermissions.filter((p) =>
    Object.values(data.dmsRoles).some((rp) => rp.includes(p))
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-roles">Roles &amp; Permissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Current permission assignments across all roles</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        Permissions are currently managed in code. This view reflects the current configuration.
      </div>

      <PermissionMatrix
        title="Yard Web Roles"
        roleNames={data.yardRoleNames}
        rolePermissions={data.yardRoles}
        permissions={yardPerms.length ? yardPerms : data.availablePermissions}
      />

      <PermissionMatrix
        title="DMS Mobile Roles"
        roleNames={data.dmsRoleNames}
        rolePermissions={data.dmsRoles}
        permissions={dmsPerms.length ? dmsPerms : data.availablePermissions}
      />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface YardUser {
  id: number;
  username: string;
  name: string;
  role: "admin" | "yard_manager" | "yard_operator";
  locationId: number | null;
  notificationsEnabled: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  yard_manager: "bg-blue-100 text-blue-800",
  yard_operator: "bg-emerald-100 text-emerald-800",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  yard_manager: "Yard Manager",
  yard_operator: "Yard Operator",
};

const EMPTY_FORM = { username: "", password: "", name: "", role: "yard_operator" as string, locationId: "" };

export default function UsersPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const headers = { "x-yard-user-id": userId!, "Content-Type": "application/json" };

  const { data: users = [], isLoading } = useQuery<YardUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users", { headers }).then((r) => r.json()),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<YardUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<YardUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/admin/users", { method: "POST", headers, body: JSON.stringify({ ...body, locationId: body.locationId ? Number(body.locationId) : null }) }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setShowCreate(false); toast.success("User created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<typeof form> }) =>
      fetch(`/api/admin/users/${id}`, { method: "PATCH", headers, body: JSON.stringify({ ...body, locationId: body.locationId ? Number(body.locationId) : null }) }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditUser(null); toast.success("User updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/users/${id}`, { method: "DELETE", headers }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeleteUser(null); toast.success("User deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(u: YardUser) {
    setEditUser(u);
    setForm({ username: u.username, password: "", name: u.name, role: u.role, locationId: u.locationId ? String(u.locationId) : "" });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="heading-users">Yard Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} data-testid="button-create-user">
          <Plus size={15} className="mr-1.5" /> Add User
        </Button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Username</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Notifications</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-user-${u.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.notificationsEnabled ? "On" : "Off"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}><Pencil size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)} data-testid={`button-delete-user-${u.id}`}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Yard User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { id: "name", label: "Full Name", type: "text", key: "name" },
              { id: "username", label: "Username", type: "text", key: "username" },
              { id: "password", label: "Password", type: "password", key: "password" },
            ].map(({ id, label, type, key }) => (
              <div key={id} className="space-y-1">
                <Label htmlFor={id}>{label}</Label>
                <Input id={id} data-testid={`input-${id}`} type={type} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="yard_manager">Yard Manager</SelectItem>
                  <SelectItem value="yard_operator">Yard Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-confirm-create-user">
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { id: "edit-name", label: "Full Name", type: "text", key: "name" },
              { id: "edit-password", label: "New Password (leave blank to keep)", type: "password", key: "password" },
            ].map(({ id, label, type, key }) => (
              <div key={id} className="space-y-1">
                <Label htmlFor={id}>{label}</Label>
                <Input id={id} data-testid={`input-${id}`} type={type} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="yard_manager">Yard Manager</SelectItem>
                  <SelectItem value="yard_operator">Yard Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              onClick={() => editUser && updateMutation.mutate({ id: editUser.id, body: { name: form.name, role: form.role, ...(form.password ? { password: form.password } : {}) } })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit-user"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>{deleteUser?.name}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
              data-testid="button-confirm-delete-user"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

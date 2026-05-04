import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Technician {
  id: string;
  name: string;
  role: string;
  avatar: string;
  userCode: string;
  specializations: string[];
  status: "idle" | "busy" | "offline";
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-emerald-100 text-emerald-800",
  busy: "bg-amber-100 text-amber-800",
  offline: "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = { id: "", name: "", role: "technician", avatar: "👤", userCode: "", specializations: "", status: "idle" };

export default function TechniciansPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const headers = { "x-yard-user-id": userId!, "Content-Type": "application/json" };

  const { data: techs = [], isLoading } = useQuery<Technician[]>({
    queryKey: ["admin-technicians"],
    queryFn: () => fetch("/api/admin/technicians", { headers }).then((r) => r.json()),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [deleteTech, setDeleteTech] = useState<Technician | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/admin/technicians", {
        method: "POST", headers,
        body: JSON.stringify({ ...body, specializations: body.specializations.split(",").map((s) => s.trim()).filter(Boolean) }),
      }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-technicians"] }); setShowCreate(false); toast.success("Technician created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<typeof form> }) =>
      fetch(`/api/admin/technicians/${id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ ...body, ...(body.specializations !== undefined ? { specializations: String(body.specializations).split(",").map((s) => s.trim()).filter(Boolean) } : {}) }),
      }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-technicians"] }); setEditTech(null); toast.success("Technician updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/technicians/${id}`, { method: "DELETE", headers }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-technicians"] }); setDeleteTech(null); toast.success("Technician deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(t: Technician) {
    setEditTech(t);
    setForm({ id: t.id, name: t.name, role: t.role, avatar: t.avatar, userCode: t.userCode, specializations: t.specializations.join(", "), status: t.status });
  }

  const FormFields = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="space-y-3 py-2">
      {!isEdit && (
        <>
          <div className="space-y-1">
            <Label htmlFor="tech-id">Technician ID</Label>
            <Input id="tech-id" data-testid="input-tech-id" placeholder="e.g. tech-001" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tech-usercode">User Code</Label>
            <Input id="tech-usercode" data-testid="input-tech-usercode" placeholder="e.g. MR1234" value={form.userCode} onChange={(e) => setForm((f) => ({ ...f, userCode: e.target.value }))} />
          </div>
        </>
      )}
      <div className="space-y-1">
        <Label htmlFor="tech-name">Full Name</Label>
        <Input id="tech-name" data-testid="input-tech-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
          <SelectTrigger data-testid="select-tech-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="technician">Technician</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="estimator">Estimator</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
          <SelectTrigger data-testid="select-tech-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tech-spec">Specializations (comma-separated)</Label>
        <Input id="tech-spec" data-testid="input-tech-specializations" placeholder="e.g. Engine, Brakes" value={form.specializations} onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="heading-technicians">Technicians</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{techs.length} technicians</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} data-testid="button-create-technician">
          <Plus size={15} className="mr-1.5" /> Add Technician
        </Button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : techs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No technicians found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Specializations</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {techs.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-tech-${t.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{t.avatar}</span>
                      <span className="font-medium text-foreground">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.userCode}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{t.role}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-700")}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.specializations.map((s) => (
                        <span key={s} className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`button-edit-tech-${t.id}`}><Pencil size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTech(t)} data-testid={`button-delete-tech-${t.id}`}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Technician</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-confirm-create-tech">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTech} onOpenChange={(o) => !o && setEditTech(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Technician — {editTech?.name}</DialogTitle></DialogHeader>
          <FormFields isEdit />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTech(null)}>Cancel</Button>
            <Button
              onClick={() => editTech && updateMutation.mutate({ id: editTech.id, body: { name: form.name, role: form.role, avatar: form.avatar, specializations: form.specializations, status: form.status } })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit-tech"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTech} onOpenChange={(o) => !o && setDeleteTech(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Technician</AlertDialogTitle>
            <AlertDialogDescription>Delete <strong>{deleteTech?.name}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTech && deleteMutation.mutate(deleteTech.id)} data-testid="button-confirm-delete-tech">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

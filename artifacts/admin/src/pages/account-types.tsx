import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AccountType {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  displayOrder: number;
}

const EMPTY_FORM = { name: "", code: "", displayOrder: "0" };

export default function AccountTypesPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const headers = { "x-yard-user-id": userId!, "Content-Type": "application/json" };

  const { data: types = [], isLoading } = useQuery<AccountType[]>({
    queryKey: ["admin-account-types"],
    queryFn: () => fetch("/api/admin/account-types", { headers }).then((r) => r.json()),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editType, setEditType] = useState<AccountType | null>(null);
  const [deleteType, setDeleteType] = useState<AccountType | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/admin/account-types", { method: "POST", headers, body: JSON.stringify({ ...body, displayOrder: Number(body.displayOrder) }) })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-account-types"] }); setShowCreate(false); toast.success("Account type created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<AccountType> }) =>
      fetch(`/api/admin/account-types/${id}`, { method: "PATCH", headers, body: JSON.stringify(body) })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-account-types"] }); setEditType(null); toast.success("Account type updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/account-types/${id}`, { method: "DELETE", headers })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-account-types"] }); setDeleteType(null); toast.success("Account type deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleActive(t: AccountType) {
    updateMutation.mutate({ id: t.id, body: { isActive: !t.isActive } });
  }

  function openEdit(t: AccountType) {
    setEditType(t);
    setForm({ name: t.name, code: t.code, displayOrder: String(t.displayOrder) });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="heading-account-types">Account Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{types.length} account types</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} data-testid="button-create-account-type">
          <Plus size={15} className="mr-1.5" /> Add Type
        </Button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No account types found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-account-type-${t.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.displayOrder}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={() => toggleActive(t)}
                      data-testid={`switch-active-${t.id}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`button-edit-type-${t.id}`}><Pencil size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteType(t)} data-testid={`button-delete-type-${t.id}`}><Trash2 size={13} /></Button>
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
          <DialogHeader><DialogTitle>Add Account Type</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label htmlFor="at-name">Name</Label><Input id="at-name" data-testid="input-at-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="at-code">Code</Label><Input id="at-code" data-testid="input-at-code" placeholder="e.g. CASH" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="at-order">Display Order</Label><Input id="at-order" data-testid="input-at-order" type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-confirm-create-type">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editType} onOpenChange={(o) => !o && setEditType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account Type</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label htmlFor="edit-at-name">Name</Label><Input id="edit-at-name" data-testid="input-edit-at-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="edit-at-order">Display Order</Label><Input id="edit-at-order" data-testid="input-edit-at-order" type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditType(null)}>Cancel</Button>
            <Button onClick={() => editType && updateMutation.mutate({ id: editType.id, body: { name: form.name, displayOrder: Number(form.displayOrder) } })} disabled={updateMutation.isPending} data-testid="button-confirm-edit-type">
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteType} onOpenChange={(o) => !o && setDeleteType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account Type</AlertDialogTitle>
            <AlertDialogDescription>Delete <strong>{deleteType?.name}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteType && deleteMutation.mutate(deleteType.id)} data-testid="button-confirm-delete-type">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

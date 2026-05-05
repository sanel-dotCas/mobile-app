import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle,
  Hash,
  Search,
  Loader2,
  MoreVertical
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const accountTypeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(2, "Code is required").toUpperCase(),
  displayOrder: z.coerce.number().default(0),
});

type AccountTypeFormValues = z.infer<typeof accountTypeSchema>;

export default function AccountTypesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: types, isLoading } = useQuery({
    queryKey: ["admin", "account-types"],
    queryFn: () => api("/admin/account-types"),
  });

  const addMutation = useMutation({
    mutationFn: (data: AccountTypeFormValues) => api("/admin/account-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "account-types"] });
      setIsAddOpen(false);
      success("Account type created");
    },
    onError: (err: any) => error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api(`/admin/account-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "account-types"] });
      setEditingType(null);
      success("Account type updated");
    },
    onError: (err: any) => error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/account-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "account-types"] });
      success("Account type removed");
    },
    onError: (err: any) => error(err.message),
  });

  const form = useForm<AccountTypeFormValues>({
    resolver: zodResolver(accountTypeSchema) as any,
    defaultValues: {
      name: "",
      code: "",
      displayOrder: 0,
    },
  });

  const onAddSubmit = (data: AccountTypeFormValues) => addMutation.mutate(data);
  const onEditSubmit = (data: AccountTypeFormValues) => updateMutation.mutate({ 
    id: editingType.id, 
    data: { name: data.name, displayOrder: data.displayOrder } 
  });

  const filtered = types?.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Types</h1>
          <p className="text-slate-500">Manage billing and customer account classifications</p>
        </div>
        <Button onClick={() => {
          form.reset({ name: "", code: "", displayOrder: 0 });
          setIsAddOpen(true);
        }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Account Type
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search types..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type Name</TableHead>
              <TableHead>System Code</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No account types defined.
                </TableCell>
              </TableRow>
            ) : filtered?.sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((type: any) => (
              <TableRow key={type.id}>
                <TableCell className="font-bold text-slate-900">{type.name}</TableCell>
                <TableCell>
                  <code className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono text-xs font-bold">
                    {type.code}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium text-slate-600">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    {type.displayOrder}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={type.isActive} 
                      onCheckedChange={(checked) => updateMutation.mutate({ 
                        id: type.id, 
                        data: { isActive: checked } 
                      })}
                      disabled={updateMutation.isPending}
                    />
                    {type.isActive ? (
                      <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Active</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disabled</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        setEditingType(type);
                        form.reset({
                          name: type.name,
                          code: type.code,
                          displayOrder: type.displayOrder,
                        });
                      }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm("Delete account type? This may affect historical data reporting.")) {
                            deleteMutation.mutate(type.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Account Type</DialogTitle>
            <DialogDescription>Define a new classification for client accounts.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Private Fleet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Code</FormLabel>
                    <FormControl>
                      <Input placeholder="PRIV_FLEET" {...field} />
                    </FormControl>
                    <p className="text-[10px] text-slate-500 uppercase tracking-tight font-medium">Used for API integration. Cannot be changed later.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={addMutation.isPending} className="w-full">
                  Create Account Type
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Account Type</DialogTitle>
            <DialogDescription>Update the display name or sorting order.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

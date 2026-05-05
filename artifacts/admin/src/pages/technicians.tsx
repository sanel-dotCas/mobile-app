import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Wrench, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  User, 
  CheckCircle2, 
  Clock, 
  PauseCircle, 
  XCircle,
  Search,
  Loader2,
  ChevronRight
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

const techSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(2, "Name is required"),
  role: z.string().min(1, "Role is required"),
  userCode: z.string().min(4, "User code is required"),
  avatar: z.string().optional(),
  status: z.enum(["active", "idle", "break", "absent"]),
  specializations: z.array(z.string()).default([]),
});

type TechFormValues = z.infer<typeof techSchema>;

const SPECS = ["MECHANICAL", "ELECTRICAL", "BODY", "PAINT", "DIAGNOSTIC"];

export default function TechniciansPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: techs, isLoading } = useQuery({
    queryKey: ["admin", "technicians"],
    queryFn: () => api("/admin/technicians"),
  });

  const addTechMutation = useMutation({
    mutationFn: (data: TechFormValues) => api("/admin/technicians", {
      method: "POST",
      body: JSON.stringify({ ...data, id: parseInt(data.id) }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] });
      setIsAddOpen(false);
      success("Technician added successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const updateTechMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api(`/admin/technicians/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] });
      setEditingTech(null);
      success("Technician updated successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const deleteTechMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/technicians/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] });
      success("Technician deleted successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const form = useForm<TechFormValues>({
    resolver: zodResolver(techSchema) as any,
    defaultValues: {
      id: "",
      name: "",
      role: "Technician",
      userCode: "",
      avatar: "",
      status: "active",
      specializations: [],
    },
  });

  const onAddSubmit = (data: TechFormValues) => addTechMutation.mutate(data);
  const onEditSubmit = (data: TechFormValues) => updateTechMutation.mutate({ id: editingTech.id, data });

  const statusColors = {
    active: "bg-green-100 text-green-700 border-green-200",
    idle: "bg-slate-100 text-slate-700 border-slate-200",
    break: "bg-amber-100 text-amber-700 border-amber-200",
    absent: "bg-red-100 text-red-700 border-red-200",
  };

  const statusIcons = {
    active: CheckCircle2,
    idle: Clock,
    break: PauseCircle,
    absent: XCircle,
  };

  const filteredTechs = techs?.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.userCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Technicians</h1>
          <p className="text-slate-500">Manage workshop staff and their specializations</p>
        </div>
        <Button onClick={() => {
          form.reset({
            id: "",
            name: "",
            role: "Technician",
            userCode: "",
            avatar: "",
            status: "active",
            specializations: [],
          });
          setIsAddOpen(true);
        }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Technician
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or code..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Technician</TableHead>
              <TableHead>User Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Specializations</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            ) : filteredTechs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  No technicians found.
                </TableCell>
              </TableRow>
            ) : filteredTechs?.map((tech: any) => {
              const StatusIcon = statusIcons[tech.status as keyof typeof statusIcons] || Clock;
              return (
                <TableRow key={tech.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-slate-900">{tech.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold">
                      {tech.userCode}
                    </code>
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium">{tech.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize gap-1 px-2.5 py-0.5", statusColors[tech.status as keyof typeof statusColors])}>
                      <StatusIcon className="w-3 h-3" />
                      {tech.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tech.specializations?.map((spec: string) => (
                        <span key={spec} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold tracking-wider uppercase border border-blue-100">
                          {spec}
                        </span>
                      )) || <span className="text-slate-400 text-xs italic">No specializations</span>}
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
                          setEditingTech(tech);
                          form.reset({
                            id: tech.id.toString(),
                            name: tech.name,
                            role: tech.role,
                            userCode: tech.userCode,
                            avatar: tech.avatar || "",
                            status: tech.status,
                            specializations: tech.specializations || [],
                          });
                        }}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit Info
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            if (window.confirm("Delete technician record? This cannot be undone.")) {
                              deleteTechMutation.mutate(tech.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Tech Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Technician</DialogTitle>
            <DialogDescription>Register a new technician to the workshop system.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Database ID</FormLabel>
                      <FormControl>
                        <Input placeholder="101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="userCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="4455" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Roberto Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Master Mechanic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specializations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specializations</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SPECS.map(spec => (
                        <Badge
                          key={spec}
                          variant={field.value.includes(spec) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-1",
                            field.value.includes(spec) ? "bg-blue-600" : "hover:bg-slate-50"
                          )}
                          onClick={() => {
                            const next = field.value.includes(spec)
                              ? field.value.filter(s => s !== spec)
                              : [...field.value, spec];
                            field.onChange(next);
                          }}
                        >
                          {spec}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={addTechMutation.isPending} className="w-full">
                  {addTechMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Register Technician
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Tech Dialog */}
      <Dialog open={!!editingTech} onOpenChange={(open) => !open && setEditingTech(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Technician</DialogTitle>
            <DialogDescription>Modify technician profile and workshop status.</DialogDescription>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role / Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="idle">Idle</SelectItem>
                          <SelectItem value="break">On Break</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="specializations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specializations</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SPECS.map(spec => (
                        <Badge
                          key={spec}
                          variant={field.value.includes(spec) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-1",
                            field.value.includes(spec) ? "bg-blue-600" : "hover:bg-slate-50"
                          )}
                          onClick={() => {
                            const next = field.value.includes(spec)
                              ? field.value.filter(s => s !== spec)
                              : [...field.value, spec];
                            field.onChange(next);
                          }}
                        >
                          {spec}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateTechMutation.isPending} className="w-full">
                  {updateTechMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Profile
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

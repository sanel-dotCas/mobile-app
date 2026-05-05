import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { 
  Users, 
  UserPlus, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Mail, 
  Shield, 
  MapPin, 
  Bell, 
  BellOff,
  Search,
  Loader2
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
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  name: z.string().min(2, "Name is required"),
  role: z.enum(["admin", "yard_manager", "yard_operator"]),
  locationId: z.string().optional(),
  notificationsEnabled: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api("/admin/users"),
  });

  const addUserMutation = useMutation({
    mutationFn: (data: UserFormValues) => api("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        locationId: data.locationId ? parseInt(data.locationId) : null
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsAddOpen(false);
      success("User added successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        locationId: data.locationId ? parseInt(data.locationId) : null,
        password: data.password || undefined
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingUser(null);
      success("User updated successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      success("User deleted successfully");
    },
    onError: (err: any) => error(err.message),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      username: "",
      password: "",
      name: "",
      role: "yard_operator",
      locationId: "",
      notificationsEnabled: true,
    },
  });

  const onAddSubmit = (data: UserFormValues) => addUserMutation.mutate(data);
  const onEditSubmit = (data: UserFormValues) => updateUserMutation.mutate({ id: editingUser.id, data });

  const roleColors = {
    admin: "bg-red-100 text-red-700 border-red-200",
    yard_manager: "bg-blue-100 text-blue-700 border-blue-200",
    yard_operator: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const filteredUsers = users?.filter((u: any) => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Manage access control and roles for yard staff</p>
        </div>
        <Button onClick={() => {
          form.reset({
            username: "",
            password: "",
            name: "",
            role: "yard_operator",
            locationId: "",
            notificationsEnabled: true,
          });
          setIsAddOpen(true);
        }} className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Add New User
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search users..." 
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Notifications</TableHead>
              <TableHead>Created At</TableHead>
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
            ) : filteredUsers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  No users found.
                </TableCell>
              </TableRow>
            ) : filteredUsers?.map((user: any) => (
              <TableRow key={user.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200 uppercase">
                      {user.name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {user.username}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize px-2.5 py-0.5", roleColors[user.role as keyof typeof roleColors])}>
                    {user.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {user.locationId ? `ID: ${user.locationId}` : 'All Locations'}
                  </div>
                </TableCell>
                <TableCell>
                  {user.notificationsEnabled ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 px-2">
                      <Bell className="w-3 h-3" /> Enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1 px-2">
                      <BellOff className="w-3 h-3" /> Disabled
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
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
                        setEditingUser(user);
                        form.reset({
                          username: user.username,
                          password: "",
                          name: user.name,
                          role: user.role,
                          locationId: user.locationId?.toString() || "",
                          notificationsEnabled: user.notificationsEnabled,
                        });
                      }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this user?")) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new account for yard or admin staff.</DialogDescription>
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
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="jdoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="yard_manager">Yard Manager</SelectItem>
                        <SelectItem value="yard_operator">Yard Operator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={addUserMutation.isPending} className="w-full">
                  {addUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and permissions.</DialogDescription>
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password (Leave blank to keep current)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
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
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="yard_manager">Yard Manager</SelectItem>
                        <SelectItem value="yard_operator">Yard Operator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notificationsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Push Notifications</FormLabel>
                      <p className="text-xs text-slate-500">Enable or disable mobile alerts</p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateUserMutation.isPending} className="w-full">
                  {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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

import { cn } from "@/lib/utils";

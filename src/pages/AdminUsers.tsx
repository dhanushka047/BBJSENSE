import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, UserCheck, UserX, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "super_admin" || role === "admin";
  const isSuperAdmin = role === "super_admin";

  // Fetch all profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all roles
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch device counts per user
  const { data: deviceCounts = {} } = useQuery({
    queryKey: ["admin-device-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("owner_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((d) => {
        if (d.owner_id) counts[d.owner_id] = (counts[d.owner_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin,
  });

  // Update subscription status
  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "active" | "suspended" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: status })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast({ title: "User status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Update role (super_admin only)
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getRoleForUser = (userId: string) => {
    const r = roles.find((r) => r.user_id === userId);
    return r?.role || "user";
  };

  const filtered = profiles.filter(
    (u) =>
      u.first_name.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.factory_name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">{profiles.length} registered users</p>
        </div>

        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-4 font-medium">User</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Factory</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Devices</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => {
                      const userRole = getRoleForUser(user.user_id);
                      const devCount = deviceCounts[user.user_id] || 0;
                      return (
                        <tr key={user.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{user.factory_name || "—"}</td>
                          <td className="py-3 px-4">
                            {isSuperAdmin ? (
                              <Select value={userRole} onValueChange={(v) => updateRole.mutate({ userId: user.user_id, newRole: v })}>
                                <SelectTrigger className="h-7 w-28 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">user</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                  <SelectItem value="super_admin">super_admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={userRole !== "user" ? "default" : "secondary"} className="text-xs">
                                {userRole}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{devCount}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-medium ${user.subscription_status === "active" ? "text-success" : "text-destructive"}`}>
                              {user.subscription_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() =>
                                updateStatus.mutate({
                                  userId: user.user_id,
                                  status: user.subscription_status === "active" ? "suspended" : "active",
                                })
                              }
                            >
                              {user.subscription_status === "active" ? "Suspend" : "Activate"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default AdminUsers;

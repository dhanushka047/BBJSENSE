import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, UserCheck, UserX, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield size={24} className="text-accent" /> User Management
            </h1>
            <p className="text-sm text-muted-foreground">{profiles.length} registered console accounts</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search user, email or plant..."
              className="pl-9 h-10 bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground">Registered Members Directory</CardTitle>
            <CardDescription>View status, alter permission roles, or revoke system console access</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Loading users directory...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground bg-muted/10">
                      <th className="text-left py-3 px-4 font-semibold">User Details</th>
                      <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Factory / Plant Name</th>
                      <th className="text-left py-3 px-4 font-semibold">System Role</th>
                      <th className="text-left py-3 px-4 font-semibold hidden sm:table-cell">Connected Gateway Nodes</th>
                      <th className="text-left py-3 px-4 font-semibold">Subscription Status</th>
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => {
                      const userRole = getRoleForUser(user.user_id);
                      const devCount = deviceCounts[user.user_id] || 0;
                      return (
                        <tr key={user.id} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-foreground">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.email}</p>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground hidden md:table-cell">{user.factory_name || "—"}</td>
                          <td className="py-3.5 px-4">
                            {isSuperAdmin ? (
                              <Select value={userRole} onValueChange={(v) => updateRole.mutate({ userId: user.user_id, newRole: v })}>
                                <SelectTrigger className="h-8 w-32 text-xs bg-background/50 border-white/10 font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">user</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                  <SelectItem value="super_admin">super_admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className="text-[10px] font-bold border-0 bg-primary/10 text-primary uppercase">
                                {userRole}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground font-semibold font-mono hidden sm:table-cell">{devCount}</td>
                          <td className="py-3.5 px-4">
                            <Badge className={`text-xs font-semibold ${
                              user.subscription_status === "active"
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-destructive/10 text-destructive border border-destructive/20"
                            }`}>
                              {user.subscription_status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 text-xs font-semibold border border-transparent ${
                                user.subscription_status === "active"
                                  ? "text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/10"
                                  : "text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/10"
                              }`}
                              onClick={() =>
                                updateStatus.mutate({
                                  userId: user.user_id,
                                  status: user.subscription_status === "active" ? "suspended" : "active",
                                })
                              }
                            >
                              {user.subscription_status === "active" ? (
                                <><UserX size={13} className="mr-1" /> Suspend</>
                              ) : (
                                <><UserCheck size={13} className="mr-1" /> Activate</>
                              )}
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

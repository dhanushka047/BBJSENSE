import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, Cpu, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";

const DeviceApprovals = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "super_admin" || role === "admin";

  const { data: pendingDevices = [], isLoading } = useQuery({
    queryKey: ["pending-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: allDevices = [] } = useQuery({
    queryKey: ["all-devices-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const updateApproval = useMutation({
    mutationFn: async ({ deviceId, status }: { deviceId: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("devices")
        .update({ approval_status: status, approved_by: user?.id })
        .eq("id", deviceId);
      if (error) throw error;

      // Log event
      await supabase.from("device_events").insert({
        device_id: deviceId,
        event_type: "control",
        message: `Device ${status} by admin`,
        triggered_by: user?.id,
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["pending-devices"] });
      queryClient.invalidateQueries({ queryKey: ["all-devices-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      toast({ title: `Device ${status}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-primary/10 text-primary border border-primary/20";
      case "rejected":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      default:
        return "bg-accent/10 text-accent border border-accent/20";
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-accent" /> Device Approvals
          </h1>
          <p className="text-sm text-muted-foreground">{pendingDevices.length} devices pending gateway registration approval</p>
        </div>

        {/* Pending Devices */}
        {pendingDevices.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-2">
              <Clock size={14} className="animate-pulse" /> Pending Approval
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingDevices.map((device) => (
                <Card key={device.id} className="border border-primary bg-card relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                          <Cpu size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{device.name}</h3>
                          <p className="font-mono text-xs text-muted-foreground/80 mt-0.5">{device.mac_address}</p>
                        </div>
                      </div>
                      <Badge className="bg-accent/15 text-accent border border-accent/25">Pending</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Requested: {new Date(device.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                        onClick={() => updateApproval.mutate({ deviceId: device.id, status: "approved" })}
                        disabled={updateApproval.isPending}
                      >
                        <CheckCircle size={14} className="mr-1.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 font-semibold"
                        onClick={() => updateApproval.mutate({ deviceId: device.id, status: "rejected" })}
                        disabled={updateApproval.isPending}
                      >
                        <XCircle size={14} className="mr-1.5" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Devices Status */}
        <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground">Registered Devices Directory</CardTitle>
            <CardDescription>Directory of all registered IoT nodes and approval state logs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Loading devices registry...</p>
            ) : allDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center font-medium">No devices registered in local SQLite DB yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground bg-muted/10">
                      <th className="text-left py-3 px-4 font-semibold">Device Nickname / Name</th>
                      <th className="text-left py-3 px-4 font-semibold">MAC Physical Address</th>
                      <th className="text-left py-3 px-4 font-semibold">Approval Status</th>
                      <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Registered Date</th>
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDevices.map((device) => (
                      <tr key={device.id} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">{device.nickname || device.name}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{device.mac_address}</td>
                        <td className="py-3.5 px-4">
                          <Badge className={`${statusColor(device.approval_status)} font-semibold text-xs`}>
                            {device.approval_status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono hidden md:table-cell">
                          {new Date(device.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {device.approval_status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/10"
                              onClick={() => updateApproval.mutate({ deviceId: device.id, status: "approved" })}
                            >
                              Approve
                            </Button>
                          )}
                          {device.approval_status === "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/10"
                              onClick={() => updateApproval.mutate({ deviceId: device.id, status: "rejected" })}
                            >
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
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

export default DeviceApprovals;

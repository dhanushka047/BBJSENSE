import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, Cpu, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      case "approved": return "bg-success/10 text-success";
      case "rejected": return "bg-destructive/10 text-destructive";
      default: return "bg-warning/10 text-warning";
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-primary" /> Device Approvals
          </h1>
          <p className="text-sm text-muted-foreground">{pendingDevices.length} devices pending approval</p>
        </div>

        {/* Pending Devices */}
        {pendingDevices.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-warning" /> Pending Approval
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingDevices.map((device) => (
                <Card key={device.id} className="border-warning/30">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-warning/10">
                          <Cpu size={20} className="text-warning" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{device.name}</h3>
                          <p className="font-mono text-xs text-muted-foreground">{device.mac_address}</p>
                        </div>
                      </div>
                      <Badge className="bg-warning/10 text-warning border-0">Pending</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Added {new Date(device.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => updateApproval.mutate({ deviceId: device.id, status: "approved" })}
                        disabled={updateApproval.isPending}
                      >
                        <CheckCircle size={14} className="mr-1.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : allDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No devices registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-2 font-medium">Device</th>
                      <th className="text-left py-3 px-2 font-medium">MAC</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Added</th>
                      <th className="text-left py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDevices.map((device) => (
                      <tr key={device.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium text-foreground">{device.nickname || device.name}</td>
                        <td className="py-3 px-2 font-mono text-xs text-muted-foreground">{device.mac_address}</td>
                        <td className="py-3 px-2">
                          <Badge className={`${statusColor(device.approval_status)} border-0 text-xs`}>
                            {device.approval_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-xs text-muted-foreground hidden md:table-cell">
                          {new Date(device.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2">
                          {device.approval_status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-success"
                              onClick={() => updateApproval.mutate({ deviceId: device.id, status: "approved" })}
                            >
                              Approve
                            </Button>
                          )}
                          {device.approval_status === "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-destructive"
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

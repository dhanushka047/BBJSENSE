import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, Cpu, Wifi, WifiOff, ScanLine, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { useEffect } from "react";

const Devices = () => {
  const [search, setSearch] = useState("");
  const [macInput, setMacInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "super_admin" || role === "admin";

  const { data: devices = [], isLoading, refetch } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Real-time device updates
  useEffect(() => {
    const channel = supabase
      .channel("devices-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const addDevice = useMutation({
    mutationFn: async () => {
      const mac = macInput.trim().toUpperCase();
      if (!mac) throw new Error("MAC address is required");
      const { data: newDevice, error } = await supabase.from("devices").insert({
        mac_address: mac,
        name: nameInput.trim() || "New Device",
        owner_id: user?.id,
      }).select("id").single();
      if (error) throw error;

      // Log event
      await supabase.from("device_events").insert({
        device_id: newDevice.id,
        event_type: "info",
        message: `Device registered with MAC ${mac}`,
        triggered_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      setMacInput("");
      setNameInput("");
      setDialogOpen(false);
      toast({ title: "Device added", description: "Pending admin approval." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteDevice = useMutation({
    mutationFn: async (device: { id: string; name: string }) => {
      // Log before delete (cascade will remove events too, so log first)
      await supabase.from("device_events").insert({
        device_id: device.id,
        event_type: "info",
        message: `Device "${device.name}" removed`,
        triggered_by: user?.id,
      });
      const { error } = await supabase.from("devices").delete().eq("id", device.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-devices"] });
      toast({ title: "Device removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.mac_address.toLowerCase().includes(search.toLowerCase()) ||
      (d.nickname || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Devices</h1>
            <p className="text-sm text-muted-foreground">{devices.length} devices registered</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand text-primary-foreground">
                <Plus size={18} className="mr-2" /> Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Device</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Device Name</Label>
                  <Input placeholder="e.g. Pump Station A" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>MAC Address</Label>
                  <Input placeholder="AA:BB:CC:DD:EE:FF" value={macInput} onChange={(e) => setMacInput(e.target.value)} className="font-mono h-11" />
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-popover px-2 text-muted-foreground">or</span></div>
                </div>
                <Button variant="outline" className="w-full h-11" disabled>
                  <ScanLine size={18} className="mr-2" /> Scan via BLE (Coming Soon)
                </Button>
                <Button className="w-full h-11 gradient-brand text-primary-foreground" onClick={() => addDevice.mutate()} disabled={addDevice.isPending}>
                  {addDevice.isPending ? "Adding..." : "Add Device"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Device will need admin approval before data is visible</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or MAC..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading devices...</p>
        ) : (
          <div className="data-grid">
            {filtered.map((device, i) => (
              <motion.div key={device.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`gradient-card border-border/50 hover:border-primary/30 transition-all hover:shadow-lg ${device.approval_status !== "approved" ? "opacity-60" : ""}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Link to={`/devices/${device.id}`} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                        <Cpu size={20} className="text-primary" />
                      </Link>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                        device.approval_status !== "approved"
                          ? "bg-warning/10 text-warning"
                          : device.is_online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {device.approval_status !== "approved" ? device.approval_status
                          : device.is_online ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
                      </span>
                    </div>
                    <Link to={`/devices/${device.id}`}>
                      <h3 className="font-semibold text-foreground hover:text-primary transition-colors">{device.nickname || device.name}</h3>
                    </Link>
                    {device.nickname && <p className="text-xs text-muted-foreground">{device.name}</p>}
                    <p className="font-mono text-xs text-muted-foreground mt-1">{device.mac_address}</p>
                    <p className="text-xs text-muted-foreground mt-2">Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}</p>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <Link to={`/devices/${device.id}/config`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-foreground">
                          <Settings size={12} className="mr-1" /> Config
                        </Button>
                      </Link>
                      {(device.owner_id === user?.id || isAdmin) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive/70 hover:text-destructive ml-auto">
                              <Trash2 size={12} className="mr-1" /> Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Device</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{device.nickname || device.name}" and all its readings and events.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteDevice.mutate({ id: device.id, name: device.nickname || device.name })}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Devices;

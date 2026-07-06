import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, Cpu, Wifi, WifiOff, ScanLine, Trash2, Settings, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { useEffect } from "react";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const Devices = () => {
  const [search, setSearch] = useState("");
  const [macInput, setMacInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [wifiSsidInput, setWifiSsidInput] = useState("");
  const [wifiPassInput, setWifiPassInput] = useState("");
  const [apiUrlInput, setApiUrlInput] = useState("http://localhost:5001/api");
  const [bleLoading, setBleLoading] = useState(false);
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
      toast({ title: "Device added", description: "Successfully created local node configuration." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleBLEProvisioning = async () => {
    if (!wifiSsidInput) {
      toast({ title: "Validation Error", description: "Wi-Fi SSID is required for BLE configuration.", variant: "destructive" });
      return;
    }
    
    setBleLoading(true);
    try {
      toast({ title: "BLE Scan", description: "Requesting Bluetooth device..." });
      
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "IOBuilds-BLE" },
          { namePrefix: "BBJSENSE-BLE" }
        ],
        optionalServices: ["12345678-1234-1234-1234-1234567890ab"]
      });
      
      toast({ title: "BLE Connection", description: "Connecting to GATT Server..." });
      const gattServer = await device.gatt?.connect();
      if (!gattServer) throw new Error("Could not connect to BLE GATT server");
      
      const service = await gattServer.getPrimaryService("12345678-1234-1234-1234-1234567890ab");
      const characteristic = await service.getCharacteristic("12345678-1234-1234-1234-1234567890ac");
      
      toast({ title: "Syncing status", description: "Reading device MAC address..." });
      const value = await characteristic.readValue();
      const statusStr = new TextDecoder().decode(value);
      console.log("BLE status read:", statusStr);
      
      let macAddress = "";
      let i2cStatus = "ok";
      const parts = statusStr.split(";");
      parts.forEach(p => {
        const [k, v] = p.split("=");
        if (k === "MAC") macAddress = v;
        if (k === "I2C") i2cStatus = v;
      });
      
      if (!macAddress) {
        throw new Error("Failed to read MAC address from hardware device.");
      }
      
      if (i2cStatus === "fail") {
        toast({ title: "Hardware Warning", description: "Warning: Board reported I2C initialization failure!", variant: "destructive" });
      }
      
      const generatedUUID = generateUUID();
      
      const configObj = {
        ssid: wifiSsidInput,
        pass: wifiPassInput,
        uuid: generatedUUID,
        api: apiUrlInput
      };
      
      toast({ title: "Configuring Device", description: "Writing network profiles over BLE..." });
      const encoder = new TextEncoder();
      const payloadBytes = encoder.encode(JSON.stringify(configObj));
      await characteristic.writeValue(payloadBytes);
      
      toast({ title: "Configured!", description: "Hardware configured. Registering with local server..." });
      
      const mac = macAddress.trim().toUpperCase();
      const { data: newDevice, error } = await supabase.from("devices").insert({
        id: generatedUUID,
        mac_address: mac,
        name: nameInput.trim() || "BLE Provisioned Node",
        owner_id: user?.id,
      }).select("id").single();
      
      if (error) throw error;
      
      await supabase.from("device_events").insert({
        device_id: generatedUUID,
        event_type: "info",
        message: `Device provisioned and registered over BLE. MAC: ${mac}`,
        triggered_by: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      setMacInput("");
      setNameInput("");
      setWifiSsidInput("");
      setWifiPassInput("");
      setDialogOpen(false);
      
      toast({ title: "Success!", description: "Gateway device provisioned, configured, and registered!" });
    } catch (err: any) {
      console.error("BLE Provisioning error:", err);
      toast({ title: "Configuration Failed", description: err.message, variant: "destructive" });
    } finally {
      setBleLoading(false);
    }
  };

  const deleteDevice = useMutation({
    mutationFn: async (device: { id: string; name: string }) => {
      await supabase.from("devices").delete().eq("id", device.id);
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Device Nodes</h1>
            <p className="text-sm text-muted-foreground">{devices.length} registered hardware nodes</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand text-primary-foreground font-semibold">
                <Plus size={18} className="mr-2" /> Add Hardware Node
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border border-border shadow-xl">
              <DialogHeader>
                <DialogTitle>Add New IoT Gateway</DialogTitle>
                <DialogDescription>Input the network profile configurations of the node</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm overflow-y-auto max-h-[75vh] pr-1">
                <div className="space-y-2">
                  <Label htmlFor="node-name">Device Name / Label</Label>
                  <Input id="node-name" placeholder="e.g. Pump Station A" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="h-10 bg-background border-border" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="wifi-ssid">Wi-Fi SSID (Required for BLE Setup)</Label>
                  <Input id="wifi-ssid" placeholder="Factory_SSID" value={wifiSsidInput} onChange={(e) => setWifiSsidInput(e.target.value)} className="h-10 bg-background border-border" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="wifi-pass">Wi-Fi Password</Label>
                  <Input id="wifi-pass" type="password" placeholder="SSID_Password" value={wifiPassInput} onChange={(e) => setWifiPassInput(e.target.value)} className="h-10 bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-url">Backend API Base URL</Label>
                  <Input id="api-url" placeholder="http://localhost:5001/api" value={apiUrlInput} onChange={(e) => setApiUrlInput(e.target.value)} className="font-mono h-10 bg-background border-border" />
                </div>

                <Button variant="secondary" className="w-full h-10 border-border font-semibold bg-primary/10 text-primary hover:bg-primary/20" onClick={handleBLEProvisioning} disabled={bleLoading}>
                  <ScanLine size={18} className="mr-2" /> {bleLoading ? "Configuring over BLE..." : "Configure & Add via BLE"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or manual registry</span></div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mac-address">MAC Address</Label>
                  <Input id="mac-address" placeholder="AA:BB:CC:DD:EE:FF" value={macInput} onChange={(e) => setMacInput(e.target.value)} className="font-mono h-10 bg-background border-border" />
                </div>

                <Button className="w-full h-10 gradient-brand text-primary-foreground font-semibold" onClick={() => addDevice.mutate()} disabled={addDevice.isPending}>
                  {addDevice.isPending ? "Configuring..." : "Add Hardware Node Manually"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search tool */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, nickname, or MAC..." className="pl-9 h-10 bg-card border-border focus:border-primary/50 focus:ring-primary/20 text-foreground" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading nodes list...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((device, i) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="group"
              >
                <Card className={`bg-card border-border hover:border-primary/50 shadow-md transition-all duration-300 relative overflow-hidden ${device.approval_status !== "approved" ? "opacity-60" : ""}`}>
                  
                  {/* Visual Hardware Sketch */}
                  <div className="h-1.5 w-full bg-primary" />
                  
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition duration-300">
                        <Cpu size={20} />
                      </div>
                      
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        device.approval_status !== "approved"
                          ? "bg-warning/15 text-warning border border-warning/20"
                          : device.is_online ? "bg-success/15 text-success border border-success/20" : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {device.approval_status !== "approved" ? device.approval_status
                          : device.is_online ? <><Wifi size={11} className="channel-pulse" /> Online</> : <><WifiOff size={11} /> Offline</>}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Link to={`/devices/${device.id}`}>
                        <h3 className="font-extrabold text-foreground hover:text-primary transition-colors text-base tracking-tight">
                          {device.nickname || device.name}
                        </h3>
                      </Link>
                      {device.nickname && <p className="text-xs text-muted-foreground">{device.name}</p>}
                      <p className="font-mono text-xs text-muted-foreground/85 flex items-center gap-1.5">
                        <Terminal size={12} /> {device.mac_address}
                      </p>
                    </div>

                    <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Slave Address:</span>
                        <span className="font-bold text-foreground">{device.modbus_address || "0x01"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Ping:</span>
                        <span className="font-bold text-foreground">
                          {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : "Never"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                      <Link to={`/devices/${device.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-8 text-primary hover:bg-primary/5 hover:text-primary font-medium">
                          🔍 Monitor Data
                        </Button>
                      </Link>
                      <Link to={`/devices/${device.id}/config`}>
                        <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground hover:text-foreground">
                          <Settings size={12} className="mr-1" /> Config
                        </Button>
                      </Link>
                      {(device.owner_id === user?.id || isAdmin) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs h-8 text-destructive/70 hover:text-destructive hover:bg-destructive/5 ml-auto">
                              <Trash2 size={12} className="mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border shadow-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Delete Gateway Node</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                This will permanently remove "{device.nickname || device.name}" from your local network registry, including all saved readings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-background text-foreground border-border hover:bg-muted">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteDevice.mutate({ id: device.id, name: device.nickname || device.name })}>
                                Confirm Delete
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

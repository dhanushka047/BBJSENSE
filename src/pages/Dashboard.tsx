import { motion } from "framer-motion";
import {
  Cpu, Activity, Wifi, WifiOff, AlertTriangle, ArrowRight,
  TrendingUp, Shield, BarChart3, Database, Cable
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";


const Dashboard = () => {
  const { profile } = useAuth();
  const userName = profile ? profile.first_name || "Console User" : "Console User";

  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ["dashboard-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("approval_status", "approved")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["dashboard-pending"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("device_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "alert");
      if (error) throw error;
      return count || 0;
    },
  });

  // Real-time device status updates
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-devices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => {
        refetchDevices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchDevices]);

  const onlineCount = devices.filter((d) => d.is_online).length;
  const offlineCount = devices.filter((d) => !d.is_online).length;

  const stats = [
    { label: "Active Nodes", value: String(devices.length), icon: Cpu, trend: `${pendingCount} pending approvals`, color: "text-primary", bg: "bg-primary/10" },
    { label: "Online Nodes", value: String(onlineCount), icon: Wifi, color: "text-success", bg: "bg-success/10", glow: "glow-success" },
    { label: "Offline Nodes", value: String(offlineCount), icon: WifiOff, color: "text-muted-foreground", bg: "bg-muted/20" },
    { label: "Critical Alerts", value: String(alertCount), icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", glow: "glow-warning" },
  ];

  // Get latest reading for each device
  const { data: latestReadings = {} } = useQuery({
    queryKey: ["dashboard-latest-readings", devices.map((d) => d.id)],
    queryFn: async () => {
      if (devices.length === 0) return {};
      const results: Record<string, any> = {};
      const subset = devices.slice(0, 10);
      await Promise.all(
        subset.map(async (dev) => {
          const { data } = await supabase
            .from("device_readings")
            .select("analog_ch1, analog_ch2, analog_ch3, analog_ch4")
            .eq("device_id", dev.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) results[dev.id] = data;
        })
      );
      return results;
    },
    enabled: devices.length > 0,
  });

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        
        {/* Welcome Section with visual banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3">
                <Shield size={12} /> System Console Active
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
                Hello, <span className="text-primary">{userName}</span>
              </h1>
              <p className="text-muted-foreground text-sm max-w-lg">
                Real-time monitoring panel for local RS-485 Modbus networks and edge IoT devices.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/devices">
                <Button className="gradient-brand text-primary-foreground font-semibold">
                  Manage Nodes <ArrowRight size={16} className="ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="group"
            >
              <Card className="bg-card border-border hover:border-primary/50 shadow-md transition-all duration-300 relative overflow-hidden">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${stat.bg} ${stat.color}`}>
                    <stat.icon size={22} className="group-hover:scale-105 transition duration-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                    {stat.trend && (
                      <p className="text-[10px] font-semibold text-primary mt-0.5 truncate">{stat.trend}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Grid: Devices List & Quick Diagnostics Panel */}
        <div className="grid grid-cols-1 gap-6">
          {/* Recent Devices Card */}
          <Card className="border-border shadow-md bg-card w-full">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cable size={18} className="text-primary" /> Recent Active Nodes
                  </CardTitle>
                  <CardDescription>Status and analog diagnostics of approved IoT gateways</CardDescription>
                </div>
                <Link to="/devices">
                  <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary hover:bg-primary/5">
                    View all <ArrowRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {devices.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Cpu size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold">No approved devices yet.</p>
                  <p className="text-xs">Go to Approvals or register a new device node.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full text-sm">
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="py-3 px-4">Device Name</TableHead>
                        <TableHead className="py-3 px-4 hidden md:table-cell">MAC Address</TableHead>
                        <TableHead className="py-3 px-4">Status</TableHead>
                        <TableHead className="py-3 px-4 hidden sm:table-cell">Analog Channels (V / mA)</TableHead>
                        <TableHead className="py-3 px-4 hidden lg:table-cell">Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.slice(0, 10).map((device) => {
                        const reading = latestReadings[device.id];
                        const analogValues = reading
                          ? [reading.analog_ch1, reading.analog_ch2, reading.analog_ch3, reading.analog_ch4]
                          : [0, 0, 0, 0];
                        return (
                          <TableRow key={device.id} className="hover:bg-muted/25 transition-colors border-b border-border/40">
                            <TableCell className="py-3.5 px-4 font-semibold text-foreground">
                               <Link to={`/devices/${device.id}`} className="hover:text-primary transition-colors">
                                 {device.nickname || device.name}
                               </Link>
                             </TableCell>
                             <TableCell className="py-3.5 px-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{device.mac_address}</TableCell>
                             <TableCell className="py-3.5 px-4">
                               <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                 device.is_online
                                   ? "bg-success/15 text-success"
                                   : "bg-muted text-muted-foreground"
                               }`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${device.is_online ? "bg-success channel-pulse" : "bg-muted-foreground"}`} />
                                 {device.is_online ? "online" : "offline"}
                               </span>
                             </TableCell>
                             <TableCell className="py-3.5 px-4 hidden sm:table-cell">
                               <div className="flex gap-1.5">
                                 {analogValues.map((v: number | null, j: number) => (
                                   <span key={j} className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-md">
                                     {(v ?? 0).toFixed(1)}
                                   </span>
                                 ))}
                               </div>
                             </TableCell>
                             <TableCell className="py-3.5 px-4 text-muted-foreground text-xs hidden lg:table-cell font-mono">
                               {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : "Never"}
                             </TableCell>
                           </TableRow>
                         );
                       })}
                     </TableBody>
                   </Table>
                 </div>
               )}
             </CardContent>
           </Card>
         </div>


      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;

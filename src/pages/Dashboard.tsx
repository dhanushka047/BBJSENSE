import { motion } from "framer-motion";
import {
  Cpu, Activity, Wifi, WifiOff, AlertTriangle, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const Dashboard = () => {
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
    { label: "Total Devices", value: String(devices.length), icon: Cpu, trend: `${pendingCount} pending` },
    { label: "Online", value: String(onlineCount), icon: Wifi, color: "text-success" },
    { label: "Offline", value: String(offlineCount), icon: WifiOff, color: "text-muted-foreground" },
    { label: "Alerts", value: String(alertCount), icon: AlertTriangle, color: "text-warning" },
  ];

  // Get latest reading for each device
  const { data: latestReadings = {} } = useQuery({
    queryKey: ["dashboard-latest-readings", devices.map((d) => d.id)],
    queryFn: async () => {
      if (devices.length === 0) return {};
      const results: Record<string, any> = {};
      // Fetch latest reading for up to 10 recent devices
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your IoT network</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="gradient-card border-border/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl bg-primary/10 ${stat.color || "text-primary"}`}>
                    <stat.icon size={22} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    {stat.trend && <p className="text-xs text-muted-foreground/70">{stat.trend}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Devices Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Devices</CardTitle>
              <Link to="/devices" className="text-sm text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No approved devices yet. Add a device and get it approved by an admin.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-2 font-medium">Device</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">MAC Address</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Analog CH</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.slice(0, 10).map((device) => {
                      const reading = latestReadings[device.id];
                      const analogValues = reading
                        ? [reading.analog_ch1, reading.analog_ch2, reading.analog_ch3, reading.analog_ch4]
                        : [0, 0, 0, 0];
                      return (
                        <tr key={device.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-2">
                            <Link to={`/devices/${device.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                              {device.nickname || device.name}
                            </Link>
                          </td>
                          <td className="py-3 px-2 font-mono text-xs text-muted-foreground hidden md:table-cell">{device.mac_address}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                              device.is_online
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${device.is_online ? "bg-success channel-pulse" : "bg-muted-foreground"}`} />
                              {device.is_online ? "online" : "offline"}
                            </span>
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell">
                            <div className="flex gap-1">
                              {analogValues.map((v: number | null, j: number) => (
                                <span key={j} className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {(v ?? 0).toFixed(1)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-muted-foreground text-xs hidden lg:table-cell">
                            {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}
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

export default Dashboard;

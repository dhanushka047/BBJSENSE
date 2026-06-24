import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Activity, ToggleRight, Clock, Zap, Radio, History,
  BarChart3, Pencil, Check, Settings, ArrowRightLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import ModbusScanner from "@/components/ModbusScanner";

const CHART_COLORS = [
  "hsl(214, 35%, 45%)", // Bedazzled Blue
  "hsl(12, 83%, 62%)",  // Burnt Sienna Orange
  "hsl(202, 46%, 65%)", // Soft Blue
  "hsl(218, 30%, 40%)", // Navy Accent
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-mono text-xs text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

interface EditableLabelProps {
  value: string;
  onChange: (v: string) => void;
  prefix: string;
}

const EditableLabel = ({ value, onChange, prefix }: EditableLabelProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  return editing ? (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground text-xs">{prefix} ·</span>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        onBlur={save}
        autoFocus
        className="h-5 text-xs px-1 py-0 w-24 bg-background border-primary/50"
      />
      <button onClick={save} className="text-primary hover:text-primary/80"><Check size={12} /></button>
    </div>
  ) : (
    <p className="text-xs text-muted-foreground flex items-center gap-1 group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
      {prefix} · {value}
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
    </p>
  );
};

const DeviceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("live");

  // Fetch device
  const { data: device } = useQuery({
    queryKey: ["device", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch latest reading
  const { data: latestReading, refetch: refetchReading } = useQuery({
    queryKey: ["device-latest-reading", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_readings")
        .select("*")
        .eq("device_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch historical readings for charts
  const { data: historicalReadings = [] } = useQuery({
    queryKey: ["device-historical-readings", id],
    queryFn: async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("device_readings")
        .select("analog_ch1, analog_ch2, analog_ch3, analog_ch4, created_at")
        .eq("device_id", id!)
        .gte("created_at", sixHoursAgo)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch channel config
  const { data: channelConfigs } = useQuery({
    queryKey: ["device-channel-config", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_channel_config")
        .select("*")
        .eq("device_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch events
  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ["device-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_events")
        .select("*")
        .eq("device_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Real-time subscription for readings
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`device-readings-${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "device_readings",
        filter: `device_id=eq.${id}`,
      }, () => {
        refetchReading();
        queryClient.invalidateQueries({ queryKey: ["device-historical-readings", id] });
      })
      .subscribe();

    const eventsChannel = supabase
      .channel(`device-events-${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "device_events",
        filter: `device_id=eq.${id}`,
      }, () => {
        refetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(eventsChannel);
    };
  }, [id, refetchReading, refetchEvents, queryClient]);

  const chartData = useMemo(() => {
    if (historicalReadings.length === 0) {
      // Generate mock data if no real data
      const data = [];
      const now = new Date();
      for (let i = 6 * 12; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000);
        data.push({
          time: `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`,
          ch1: +(3 + Math.sin(i / 6) * 2 + Math.random() * 0.5).toFixed(2),
          ch2: +(10 + Math.cos(i / 4) * 4 + Math.random() * 0.8).toFixed(2),
          ch3: +(1 + Math.sin(i / 8 + 1) * 1.5 + Math.random() * 0.3).toFixed(2),
          ch4: +(14 + Math.cos(i / 5 + 2) * 3 + Math.random() * 0.6).toFixed(2),
        });
      }
      return data;
    }
    return historicalReadings.map((r) => {
      const t = new Date(r.created_at);
      return {
        time: `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`,
        ch1: r.analog_ch1 ?? 0,
        ch2: r.analog_ch2 ?? 0,
        ch3: r.analog_ch3 ?? 0,
        ch4: r.analog_ch4 ?? 0,
      };
    });
  }, [historicalReadings]);

  const getLabel = (type: string, num: number, fallback: string) => {
    const cfg = channelConfigs?.find((c) => c.channel_type === type && c.channel_number === num);
    return cfg?.label || fallback;
  };

  const getMode = (chNum: number) => {
    const modeKey = `analog_ch${chNum}_mode` as keyof typeof latestReading;
    if (latestReading && latestReading[modeKey]) return latestReading[modeKey] as string;
    const cfg = channelConfigs?.find((c) => c.channel_type === "analog" && c.channel_number === chNum);
    return cfg?.data_mode || "0-10V";
  };

  const getUnit = (chNum: number) => getMode(chNum) === "4-20mA" ? "mA" : "V";

  const getAnalogValue = (chNum: number) => {
    if (!latestReading) return 0;
    const key = `analog_ch${chNum}` as keyof typeof latestReading;
    return (latestReading[key] as number) ?? 0;
  };

  const getDI = (chNum: number) => {
    if (!latestReading) return false;
    const key = `digital_in${chNum}` as keyof typeof latestReading;
    return (latestReading[key] as boolean) ?? false;
  };

  const getDO = (chNum: number) => {
    if (!latestReading) return false;
    const key = `digital_out${chNum}` as keyof typeof latestReading;
    return (latestReading[key] as boolean) ?? false;
  };

  // Save label change + log
  const saveLabel = useMutation({
    mutationFn: async ({ type, num, label }: { type: string; num: number; label: string }) => {
      const { error } = await supabase
        .from("device_channel_config")
        .upsert(
          { device_id: id!, channel_type: type, channel_number: num, label },
          { onConflict: "device_id,channel_type,channel_number" }
        );
      if (error) throw error;
      // Log event
      await supabase.from("device_events").insert({
        device_id: id!,
        event_type: "info",
        message: `Channel ${type} ${num} renamed to "${label}"`,
        triggered_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-channel-config", id] });
    },
  });

  // Toggle DO + log
  const toggleDO = useMutation({
    mutationFn: async (chNum: number) => {
      const current = getDO(chNum);
      const newState = !current;

      // Construct a new reading record with the updated digital output state
      const newReading = {
        device_id: id!,
        analog_ch1: latestReading?.analog_ch1 ?? 0,
        analog_ch2: latestReading?.analog_ch2 ?? 0,
        analog_ch3: latestReading?.analog_ch3 ?? 0,
        analog_ch4: latestReading?.analog_ch4 ?? 0,
        analog_ch1_mode: latestReading?.analog_ch1_mode ?? "0-10V",
        analog_ch2_mode: latestReading?.analog_ch2_mode ?? "0-10V",
        analog_ch3_mode: latestReading?.analog_ch3_mode ?? "0-10V",
        analog_ch4_mode: latestReading?.analog_ch4_mode ?? "0-10V",
        digital_in1: latestReading?.digital_in1 ?? false,
        digital_in2: latestReading?.digital_in2 ?? false,
        digital_in3: latestReading?.digital_in3 ?? false,
        digital_in4: latestReading?.digital_in4 ?? false,
        digital_out1: latestReading?.digital_out1 ?? false,
        digital_out2: latestReading?.digital_out2 ?? false,
        digital_out3: latestReading?.digital_out3 ?? false,
        digital_out4: latestReading?.digital_out4 ?? false,
        rtc_time: new Date().toISOString(),
      };

      // Set the toggled digital output
      (newReading as any)[`digital_out${chNum}`] = newState;

      // 1. Insert the new reading to update state in the SQLite database
      const { error: readingError } = await supabase.from("device_readings").insert(newReading);
      if (readingError) throw readingError;

      // 2. Log the control action in the events log
      const { error: eventError } = await supabase.from("device_events").insert({
        device_id: id!,
        event_type: "control",
        message: `DO${chNum} turned ${newState ? "ON" : "OFF"}`,
        triggered_by: user?.id,
      });
      if (eventError) throw eventError;

      toast({ 
        title: `DO${chNum} ${newState ? "ON" : "OFF"}`, 
        description: "Command will be synced on next device poll." 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-latest-reading", id] });
      queryClient.invalidateQueries({ queryKey: ["device-historical-readings", id] });
      queryClient.invalidateQueries({ queryKey: ["device-events", id] });
    },
  });

  const analogChannels = [1, 2, 3, 4];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/devices">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{device?.nickname || device?.name || "Loading..."}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs">{device?.mac_address}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${device?.is_online ? "text-success" : "text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${device?.is_online ? "bg-success channel-pulse" : "bg-muted-foreground"}`} />
                  {device?.is_online ? "online" : "offline"}
                </span>
              </div>
            </div>
          </div>
          <Link to={`/devices/${id}/config`}>
            <Button variant="outline" size="sm"><Settings size={14} className="mr-1.5" /> Config</Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock size={14} /> RTC: {latestReading?.rtc_time ? new Date(latestReading.rtc_time).toLocaleString() : "N/A"}</span>
          <span className="flex items-center gap-1.5"><Radio size={14} /> Modbus: {device?.modbus_address || "N/A"}</span>
          {historicalReadings.length > 0 && (
            <span className="flex items-center gap-1.5 text-success">
              <Activity size={14} /> Live · {historicalReadings.length} readings
            </span>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="live">Live Data</TabsTrigger>
            <TabsTrigger value="modbus"><ArrowRightLeft size={14} className="mr-1.5" /> RS-485 Modbus</TabsTrigger>
            <TabsTrigger value="charts"><BarChart3 size={14} className="mr-1.5" /> Charts</TabsTrigger>
            <TabsTrigger value="history">History ({events.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity size={14} className="text-channel-analog" /> Analog Inputs
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {analogChannels.map((n) => (
                  <Card key={n} className="border-border/50">
                    <CardContent className="p-4">
                      <EditableLabel value={getLabel("analog", n, `Analog ${n}`)} onChange={(v) => saveLabel.mutate({ type: "analog", num: n, label: v })} prefix={`CH${n}`} />
                      <p className="text-3xl font-bold font-mono text-foreground">
                        {getAnalogValue(n).toFixed(1)}
                        <span className="text-sm text-muted-foreground ml-1">{getUnit(n)}</span>
                      </p>
                      <p className="text-xs text-channel-analog mt-1">{getMode(n)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap size={14} className="text-channel-digital-in" /> Digital Inputs
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((n) => {
                  const state = getDI(n);
                  return (
                    <Card key={n} className="border-border/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <EditableLabel value={getLabel("digital_in", n, `DI ${n}`)} onChange={(v) => saveLabel.mutate({ type: "digital_in", num: n, label: v })} prefix={`DI${n}`} />
                          <p className={`text-sm font-semibold mt-1 ${state ? "text-channel-active" : "text-channel-inactive"}`}>{state ? "HIGH" : "LOW"}</p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${state ? "bg-channel-active glow-success" : "bg-channel-inactive"}`} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <ToggleRight size={14} className="text-channel-digital-out" /> Digital Outputs (Control)
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((n) => {
                  const state = getDO(n);
                  return (
                    <Card key={n} className="border-border/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <EditableLabel value={getLabel("digital_out", n, `DO ${n}`)} onChange={(v) => saveLabel.mutate({ type: "digital_out", num: n, label: v })} prefix={`DO${n}`} />
                          <p className={`text-sm font-semibold mt-1 ${state ? "text-channel-active" : "text-channel-inactive"}`}>{state ? "ON" : "OFF"}</p>
                        </div>
                        <Switch checked={state} onCheckedChange={() => toggleDO.mutate(n)} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={18} className="text-primary" /> All Analog Channels
                  {historicalReadings.length > 0 && <span className="text-xs text-muted-foreground font-normal">({historicalReadings.length} data points)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 12))} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      {analogChannels.map((n, i) => (
                        <Line key={n} type="monotone" dataKey={`ch${n}`} name={`CH${n} ${getLabel("analog", n, `Analog ${n}`)}`} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {analogChannels.map((n, i) => (
                <Card key={n}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>CH{n} · {getLabel("analog", n, `Analog ${n}`)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{getMode(n)}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 8))} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey={`ch${n}`} name={`${getLabel("analog", n, `Analog ${n}`)} (${getUnit(n)})`} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS[i] }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><History size={18} /> Device History</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 pt-0.5">
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          entry.event_type === "alert" ? "bg-warning" : entry.event_type === "control" ? "bg-channel-digital-out" : entry.event_type === "error" ? "bg-destructive" : "bg-info"
                        }`} />
                        <p className="text-foreground">{entry.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modbus">
            {device && (
              <ModbusScanner device={{ id: device.id, name: device.name, mac_address: device.mac_address }} />
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default DeviceDetail;

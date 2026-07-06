import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, RefreshCw, Settings, Activity, Zap, ToggleRight, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";

interface ChannelConfig {
  channel_type: string;
  channel_number: number;
  label: string;
  data_mode: string;
  unit: string;
  min_value: number;
  max_value: number;
}

const DEFAULT_CONFIGS: ChannelConfig[] = [
  ...([1, 2, 3, 4] as const).map((n) => ({
    channel_type: "analog",
    channel_number: n,
    label: `Analog ${n}`,
    data_mode: "0-10V",
    unit: "V",
    min_value: 0,
    max_value: 10,
  })),
  ...([1, 2, 3, 4] as const).map((n) => ({
    channel_type: "digital_in",
    channel_number: n,
    label: `DI ${n}`,
    data_mode: "binary",
    unit: "",
    min_value: 0,
    max_value: 1,
  })),
  ...([1, 2, 3, 4] as const).map((n) => ({
    channel_type: "digital_out",
    channel_number: n,
    label: `DO ${n}`,
    data_mode: "binary",
    unit: "",
    min_value: 0,
    max_value: 1,
  })),
];

const DeviceConfig = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<ChannelConfig[]>(DEFAULT_CONFIGS);
  const [nickname, setNickname] = useState("");
  const [modbusAddr, setModbusAddr] = useState("0x01");
  const [wifiMaxDisconnectTime, setWifiMaxDisconnectTime] = useState(900);
  const [ledDisabled, setLedDisabled] = useState(false);

  const { data: device } = useQuery({
    queryKey: ["device", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: savedConfigs } = useQuery({
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

  useEffect(() => {
    if (device) {
      setNickname(device.nickname || "");
      setModbusAddr(device.modbus_address || "0x01");
      setWifiMaxDisconnectTime(device.wifi_max_disconnect_time ?? 900);
      setLedDisabled(device.led_disabled ?? false);
    }
  }, [device]);

  useEffect(() => {
    if (savedConfigs && savedConfigs.length > 0) {
      setConfigs((prev) =>
        prev.map((c) => {
          const saved = savedConfigs.find(
            (s) => s.channel_type === c.channel_type && s.channel_number === c.channel_number
          );
          return saved
            ? {
                ...c,
                label: saved.label,
                data_mode: saved.data_mode || c.data_mode,
                unit: saved.unit || c.unit,
                min_value: saved.min_value ?? c.min_value,
                max_value: saved.max_value ?? c.max_value,
              }
            : c;
        })
      );
    }
  }, [savedConfigs]);

  const updateConfig = (type: string, num: number, field: keyof ChannelConfig, value: any) => {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.channel_type === type && c.channel_number === num) {
          const updated = { ...c, [field]: value };
          // Auto-set unit based on mode
          if (field === "data_mode") {
            if (value === "0-10V") {
              updated.unit = "V";
              updated.min_value = 0;
              updated.max_value = 10;
            } else if (value === "4-20mA") {
              updated.unit = "mA";
              updated.min_value = 4;
              updated.max_value = 20;
            }
          }
          return updated;
        }
        return c;
      })
    );
  };

  const saveConfig = useMutation({
    mutationFn: async () => {
      // Save device nickname/modbus/wifi_max_disconnect_time/led_disabled
      await supabase
        .from("devices")
        .update({ 
          nickname, 
          modbus_address: modbusAddr, 
          wifi_max_disconnect_time: Number(wifiMaxDisconnectTime),
          led_disabled: ledDisabled
        })
        .eq("id", id!);

      // Upsert channel configs
      for (const c of configs) {
        const { error } = await supabase
          .from("device_channel_config")
          .upsert(
            {
              device_id: id!,
              channel_type: c.channel_type,
              channel_number: c.channel_number,
              label: c.label,
              data_mode: c.data_mode,
              unit: c.unit,
              min_value: c.min_value,
              max_value: c.max_value,
            },
            { onConflict: "device_id,channel_type,channel_number" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-channel-config", id] });
      queryClient.invalidateQueries({ queryKey: ["device", id] });
      toast({ title: "Configuration saved", description: "Channel parameters applied locally in SQLite storage." });
    },
    onError: (err: any) => {
      toast({ title: "Error saving config", description: err.message, variant: "destructive" });
    },
  });

  const analogConfigs = configs.filter((c) => c.channel_type === "analog");
  const diConfigs = configs.filter((c) => c.channel_type === "digital_in");
  const doConfigs = configs.filter((c) => c.channel_type === "digital_out");

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to={`/devices/${id}`}>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground border border-white/5 bg-background/30">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings size={22} className="text-accent" /> Device Configuration
              </h1>
              <p className="text-sm text-muted-foreground">{device?.nickname || device?.name || "Loading gateway info..."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-white/10 hover:bg-muted/80 text-foreground" onClick={() => queryClient.invalidateQueries({ queryKey: ["device-channel-config", id] })}>
              <RefreshCw size={14} className="mr-1.5 animate-spin-slow" /> Revert
            </Button>
            <Button className="gradient-brand text-primary-foreground font-semibold" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
              <Save size={14} className="mr-1.5" /> {saveConfig.isPending ? "Saving..." : "Save Config"}
            </Button>
          </div>
        </div>

        {/* Device Settings */}
        <Card className="border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground">General Gateway Parameters</CardTitle>
            <CardDescription>Main identification tags and local physical interface address</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Device Nickname</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Main Pump" className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modbus Address</Label>
              <Input value={modbusAddr} onChange={(e) => setModbusAddr(e.target.value)} placeholder="0x01" className="font-mono bg-background border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wi-Fi Max Disconnect Time (Seconds)</Label>
              <Input type="number" min="10" value={wifiMaxDisconnectTime} onChange={(e) => setWifiMaxDisconnectTime(Number(e.target.value))} placeholder="900" className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">MAC Address</Label>
              <Input value={device?.mac_address || ""} disabled className="font-mono text-muted-foreground bg-muted border-border opacity-85" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">State</Label>
              <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  device?.is_online ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${device?.is_online ? "bg-accent channel-pulse" : "bg-muted-foreground"}`} />
                  {device?.is_online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status LED Mode</Label>
              <div className="flex items-center justify-between h-10 px-3 rounded-md border border-border bg-background">
                <span className="text-xs text-foreground font-semibold">Enable Board LED Indications</span>
                <Switch checked={!ledDisabled} onCheckedChange={(checked) => setLedDisabled(!checked)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analog Channel Config */}
        <Card className="border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} className="text-accent" /> Analog Input Channels
            </CardTitle>
            <CardDescription>Setup ranges (0-10V or 4-20mA) and engineering scale limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {analogConfigs.map((ch) => (
              <div key={ch.channel_number} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end p-4 rounded-xl bg-muted/30 border border-border">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CH{ch.channel_number} Custom Label</Label>
                  <Input
                    value={ch.label}
                    onChange={(e) => updateConfig("analog", ch.channel_number, "label", e.target.value)}
                    className="h-9 text-sm bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Signal Range</Label>
                  <Select
                    value={ch.data_mode}
                    onValueChange={(v) => updateConfig("analog", ch.channel_number, "data_mode", v)}
                  >
                    <SelectTrigger className="h-9 text-sm bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-10V">0-10V</SelectItem>
                      <SelectItem value="4-20mA">4-20mA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Engineering Unit</Label>
                  <Input
                    value={ch.unit}
                    onChange={(e) => updateConfig("analog", ch.channel_number, "unit", e.target.value)}
                    className="h-9 text-sm bg-background border-border text-foreground font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Min Scale</Label>
                  <Input
                    type="number"
                    value={ch.min_value}
                    onChange={(e) => updateConfig("analog", ch.channel_number, "min_value", parseFloat(e.target.value))}
                    className="h-9 text-sm font-mono bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max Scale</Label>
                  <Input
                    type="number"
                    value={ch.max_value}
                    onChange={(e) => updateConfig("analog", ch.channel_number, "max_value", parseFloat(e.target.value))}
                    className="h-9 text-sm font-mono bg-background border-border text-foreground"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Digital Input Config */}
        <Card className="border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap size={16} className="text-primary" /> Digital Input Channels
            </CardTitle>
            <CardDescription>Custom tags for discrete inputs</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {diConfigs.map((ch) => (
              <div key={ch.channel_number} className="flex items-end gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">DI {ch.channel_number} Custom Label</Label>
                  <Input
                    value={ch.label}
                    onChange={(e) => updateConfig("digital_in", ch.channel_number, "label", e.target.value)}
                    className="h-9 text-sm bg-background border-border text-foreground"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Digital Output Config */}
        <Card className="border-border bg-card shadow-sm relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base flex items-center gap-2">
              <ToggleRight size={16} className="text-accent" /> Digital Output Channels
            </CardTitle>
            <CardDescription>Custom labels for discrete actuators/relays</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {doConfigs.map((ch) => (
              <div key={ch.channel_number} className="flex items-end gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">DO {ch.channel_number} Custom Label</Label>
                  <Input
                    value={ch.label}
                    onChange={(e) => updateConfig("digital_out", ch.channel_number, "label", e.target.value)}
                    className="h-9 text-sm bg-background border-border text-foreground"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Local database sync notes */}
        <Card className="border-primary/20 shadow-md bg-primary/5">
          <CardContent className="p-4 flex gap-3 text-xs text-muted-foreground font-sans">
            <Info className="text-primary shrink-0" size={16} />
            <p className="leading-relaxed">
              <strong className="text-foreground">Local Synchronization:</strong> Channel configurations are instantly compiled into the local SQLite database. In the physical system, devices fetch their configurations via the <code className="bg-background/80 px-1 py-0.5 rounded font-mono text-[10px]">/device-status</code> API to automatically adjust their electrical ranges.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default DeviceConfig;

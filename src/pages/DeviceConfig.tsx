import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, RefreshCw, Settings, Activity, Zap, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      // Save device nickname/modbus
      await supabase
        .from("devices")
        .update({ nickname, modbus_address: modbusAddr })
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
      toast({ title: "Configuration saved", description: "Settings will sync on next device connection." });
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/devices/${id}`}>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings size={22} className="text-primary" /> Device Configuration
              </h1>
              <p className="text-sm text-muted-foreground">{device?.nickname || device?.name || "Loading..."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["device-channel-config", id] })}>
              <RefreshCw size={14} className="mr-1.5" /> Sync
            </Button>
            <Button className="gradient-brand text-primary-foreground" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
              <Save size={14} className="mr-1.5" /> {saveConfig.isPending ? "Saving..." : "Save Config"}
            </Button>
          </div>
        </div>

        {/* Device Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Device Nickname</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Main Pump" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Modbus Address</Label>
              <Input value={modbusAddr} onChange={(e) => setModbusAddr(e.target.value)} placeholder="0x01" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">MAC Address</Label>
              <Input value={device?.mac_address || ""} disabled className="font-mono text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Input value={device?.is_online ? "Online" : "Offline"} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Analog Channel Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} className="text-channel-analog" /> Analog Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analogConfigs.map((ch) => (
                <div key={ch.channel_number} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CH{ch.channel_number} Label</Label>
                    <Input
                      value={ch.label}
                      onChange={(e) => updateConfig("analog", ch.channel_number, "label", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <Select
                      value={ch.data_mode}
                      onValueChange={(v) => updateConfig("analog", ch.channel_number, "data_mode", v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-10V">0-10V</SelectItem>
                        <SelectItem value="4-20mA">4-20mA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <Input
                      value={ch.unit}
                      onChange={(e) => updateConfig("analog", ch.channel_number, "unit", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Min</Label>
                    <Input
                      type="number"
                      value={ch.min_value}
                      onChange={(e) => updateConfig("analog", ch.channel_number, "min_value", parseFloat(e.target.value))}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Max</Label>
                    <Input
                      type="number"
                      value={ch.max_value}
                      onChange={(e) => updateConfig("analog", ch.channel_number, "max_value", parseFloat(e.target.value))}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Digital Input Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap size={16} className="text-channel-digital-in" /> Digital Inputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {diConfigs.map((ch) => (
                <div key={ch.channel_number} className="flex items-end gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">DI{ch.channel_number} Label</Label>
                    <Input
                      value={ch.label}
                      onChange={(e) => updateConfig("digital_in", ch.channel_number, "label", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Digital Output Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ToggleRight size={16} className="text-channel-digital-out" /> Digital Outputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doConfigs.map((ch) => (
                <div key={ch.channel_number} className="flex items-end gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">DO{ch.channel_number} Label</Label>
                    <Input
                      value={ch.label}
                      onChange={(e) => updateConfig("digital_out", ch.channel_number, "label", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sync info */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Device Sync:</strong> Configuration changes are saved to the cloud. When the physical device polls for updates via the <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">/device-status</code> endpoint, it will receive the latest channel configuration and apply it locally.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default DeviceConfig;

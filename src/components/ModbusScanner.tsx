import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Play, Square, RefreshCw, Plus, Trash2, Cpu, Settings, Check, HelpCircle,
  Database, FileJson, ArrowRightLeft, Radio, Sliders, PlayCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  requestAndOpenPort,
  closeLocalPort,
  isLocalPortOpen,
  readLocalHoldingRegisters,
  readLocalInputRegisters,
  writeLocalSingleRegister,
  writeLocalMultipleRegisters,
  decodeWords,
  encodeWords,
  mapLocalReadings,
  groupIntoBlocks,
  autoDetectLocalSettings
} from "@/lib/webSerialModbus";

// Sparkline component for displaying historical data trends
const Sparkline = ({ data }: { data: number[] }) => {
  if (!data || data.length < 2) return <span className="text-muted-foreground text-xs font-mono">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 20 - ((val - min) / range) * 16;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="w-24 h-6 stroke-primary stroke-[1.5] fill-none overflow-visible">
      <polyline points={points} />
    </svg>
  );
};

interface ModbusScannerProps {
  device: {
    id: string;
    name: string;
    mac_address: string;
  };
}

const PRESET_TEMPLATES = [
  {
    name: "EM6400NG",
    manufacturer: "Schneider Electric",
    slave_id: 1,
    baud_rate: 19200,
    parity: "even",
    stop_bits: 1,
    data_bits: 8,
    registers: [
      { address: 2698, label: "Active Energy Delivered", data_type: "float32_be", unit: "kWh", group_name: "Energy", function_code: 3, scale: 1.0, display_order: 1 },
      { address: 2700, label: "Active Energy Received", data_type: "float32_be", unit: "kWh", group_name: "Energy", function_code: 3, scale: 1.0, display_order: 2 },
      { address: 2702, label: "Active Energy Total", data_type: "float32_be", unit: "kWh", group_name: "Energy", function_code: 3, scale: 1.0, display_order: 3 },
      { address: 2998, label: "Current A", data_type: "float32_be", unit: "A", group_name: "Current", function_code: 4, scale: 1.0, display_order: 4 },
      { address: 3000, label: "Current B", data_type: "float32_be", unit: "A", group_name: "Current", function_code: 4, scale: 1.0, display_order: 5 },
      { address: 3002, label: "Current C", data_type: "float32_be", unit: "A", group_name: "Current", function_code: 4, scale: 1.0, display_order: 6 },
      { address: 3008, label: "Current Avg", data_type: "float32_be", unit: "A", group_name: "Current", function_code: 4, scale: 1.0, display_order: 7 },
      { address: 3018, label: "Voltage A-B", data_type: "float32_be", unit: "V", group_name: "Voltage", function_code: 4, scale: 1.0, display_order: 8 },
      { address: 3020, label: "Voltage B-C", data_type: "float32_be", unit: "V", group_name: "Voltage", function_code: 4, scale: 1.0, display_order: 9 },
      { address: 3022, label: "Voltage C-A", data_type: "float32_be", unit: "V", group_name: "Voltage", function_code: 4, scale: 1.0, display_order: 10 },
      { address: 3024, label: "Voltage L-L Avg", data_type: "float32_be", unit: "V", group_name: "Voltage", function_code: 4, scale: 1.0, display_order: 11 },
      { address: 3052, label: "Active Power A", data_type: "float32_be", unit: "kW", group_name: "Power", function_code: 4, scale: 1.0, display_order: 12 },
      { address: 3054, label: "Active Power B", data_type: "float32_be", unit: "kW", group_name: "Power", function_code: 4, scale: 1.0, display_order: 13 },
      { address: 3056, label: "Active Power C", data_type: "float32_be", unit: "kW", group_name: "Power", function_code: 4, scale: 1.0, display_order: 14 },
      { address: 3058, label: "Active Power Total", data_type: "float32_be", unit: "kW", group_name: "Power", function_code: 4, scale: 1.0, display_order: 15 },
      { address: 3066, label: "Reactive Power Total", data_type: "float32_be", unit: "kVAR", group_name: "Power", function_code: 4, scale: 1.0, display_order: 16 },
      { address: 3074, label: "Apparent Power Total", data_type: "float32_be", unit: "kVA", group_name: "Power", function_code: 4, scale: 1.0, display_order: 17 }
    ]
  },
  {
    name: "M1M12",
    manufacturer: "ABB",
    slave_id: 1,
    baud_rate: 9600,
    parity: "even",
    stop_bits: 1,
    data_bits: 8,
    registers: [
      { address: 100, label: "Watts Total", data_type: "float32_le", unit: "W", group_name: "Power", function_code: 3, scale: 1.0, display_order: 1 },
      { address: 102, label: "Watts L1", data_type: "float32_le", unit: "W", group_name: "Power", function_code: 3, scale: 1.0, display_order: 2 },
      { address: 104, label: "Watts L2", data_type: "float32_le", unit: "W", group_name: "Power", function_code: 3, scale: 1.0, display_order: 3 },
      { address: 106, label: "Watts L3", data_type: "float32_le", unit: "W", group_name: "Power", function_code: 3, scale: 1.0, display_order: 4 },
      { address: 116, label: "PF Ave. (Inst.)", data_type: "float32_le", unit: "", group_name: "Power Factor", function_code: 3, scale: 1.0, display_order: 5 },
      { address: 118, label: "PF L1 phase", data_type: "float32_le", unit: "", group_name: "Power Factor", function_code: 3, scale: 1.0, display_order: 6 },
      { address: 120, label: "PF L2 phase", data_type: "float32_le", unit: "", group_name: "Power Factor", function_code: 3, scale: 1.0, display_order: 7 },
      { address: 122, label: "PF L3 phase", data_type: "float32_le", unit: "", group_name: "Power Factor", function_code: 3, scale: 1.0, display_order: 8 },
      { address: 124, label: "VA total", data_type: "float32_le", unit: "VA", group_name: "Power", function_code: 3, scale: 1.0, display_order: 9 },
      { address: 126, label: "VA L1 phase", data_type: "float32_le", unit: "VA", group_name: "Power", function_code: 3, scale: 1.0, display_order: 10 },
      { address: 128, label: "VA L2 phase", data_type: "float32_le", unit: "VA", group_name: "Power", function_code: 3, scale: 1.0, display_order: 11 },
      { address: 130, label: "VA L3 phase", data_type: "float32_le", unit: "VA", group_name: "Power", function_code: 3, scale: 1.0, display_order: 12 },
      { address: 132, label: "VLL average", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 13 },
      { address: 134, label: "V L12 line", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 14 },
      { address: 136, label: "V L23 line", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 15 },
      { address: 138, label: "V L31 line", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 16 },
      { address: 140, label: "VLN average", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 17 },
      { address: 142, label: "V L1 phase", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 18 },
      { address: 144, label: "V L2 phase", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 19 },
      { address: 146, label: "V L3 phase", data_type: "float32_le", unit: "V", group_name: "Voltage", function_code: 3, scale: 1.0, display_order: 20 },
      { address: 148, label: "Current Total", data_type: "float32_le", unit: "A", group_name: "Current", function_code: 3, scale: 1.0, display_order: 21 },
      { address: 150, label: "Current L1 phase", data_type: "float32_le", unit: "A", group_name: "Current", function_code: 3, scale: 1.0, display_order: 22 },
      { address: 152, label: "Current L2 phase", data_type: "float32_le", unit: "A", group_name: "Current", function_code: 3, scale: 1.0, display_order: 23 },
      { address: 154, label: "Current L3 phase", data_type: "float32_le", unit: "A", group_name: "Current", function_code: 3, scale: 1.0, display_order: 24 },
      { address: 156, label: "Frequency", data_type: "float32_le", unit: "Hz", group_name: "Frequency", function_code: 3, scale: 1.0, display_order: 25 },
      { address: 158, label: "Wh Received", data_type: "float32_le", unit: "Wh", group_name: "Energy", function_code: 3, scale: 1.0, display_order: 26 },
      { address: 160, label: "VAh Received", data_type: "float32_le", unit: "VAh", group_name: "Energy", function_code: 3, scale: 1.0, display_order: 27 },
      { address: 216, label: "Load Hours Received", data_type: "uint32_le", unit: "h", group_name: "Time", function_code: 3, scale: 1.0, display_order: 28 }
    ]
  }
];

export default function ModbusScanner({ device }: ModbusScannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasWebSerial = typeof navigator !== "undefined" && "serial" in navigator;

  // Connection settings
  const [baudRate, setBaudRate] = useState<number>(19200);
  const [parity, setParity] = useState<"none" | "even" | "odd">("even");
  const [stopBits, setStopBits] = useState<1 | 2>(1);
  const [dataBits, setDataBits] = useState<7 | 8>(8);
  const [slaveId, setSlaveId] = useState<number>(1);

  const [connectedPort, setConnectedPort] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [authorizedPorts, setAuthorizedPorts] = useState<any[]>([]);
  const [selectedPortIdx, setSelectedPortIdx] = useState<number>(-1);

  // Scanning control
  const [scanning, setScanning] = useState<boolean>(false);
  const [pollInterval, setPollInterval] = useState<number>(2000);
  const [autoSaveToDb, setAutoSaveToDb] = useState<boolean>(false);

  // Diagnostics feed & logs
  const [feedEntries, setFeedEntries] = useState<any[]>([]);
  const [logEntries, setLogEntries] = useState<{ ts: string; msg: string; type: "info" | "success" | "warn" | "error" }[]>([]);

  // Selected sub-device in Supabase
  const [selectedModbusDeviceId, setSelectedModbusDeviceId] = useState<string>("");

  // Readings state: registers ID -> { value, label, unit, history }
  const [readings, setReadings] = useState<Map<string, { value: number; label: string; unit: string; history: number[] }>>(new Map());

  // Manual Modbus ops state
  const [manualFc, setManualFc] = useState<string>("3");
  const [manualAddress, setManualAddress] = useState<number>(0);
  const [manualCount, setManualCount] = useState<number>(1);
  const [manualDataType, setManualDataType] = useState<string>("uint16");
  const [manualWriteVal, setManualWriteVal] = useState<string>("");
  const [manualResult, setManualResult] = useState<any>(null);
  const [manualPending, setManualPending] = useState<boolean>(false);

  // Autodetect settings
  const [showAutoDetect, setShowAutoDetect] = useState<boolean>(false);
  const [autoDetectSlaveId, setAutoDetectSlaveId] = useState<number>(1);
  const [autoDetectTestAddr, setAutoDetectTestAddr] = useState<number>(2698);
  const [autoDetectTestFc, setAutoDetectTestFc] = useState<number>(3);

  // New modbus device forms
  const [newDeviceName, setNewDeviceName] = useState<string>("");
  const [newDeviceManufacturer, setNewDeviceManufacturer] = useState<string>("");
  const [newDeviceSlaveId, setNewDeviceSlaveId] = useState<number>(1);
  const [newDevicePreset, setNewDevicePreset] = useState<string>("");

  // Query Modbus Devices under this IoT Device from Supabase
  const { data: modbusDevices = [], refetch: refetchModbusDevices } = useQuery({
    queryKey: ["modbus-devices", device.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modbus_devices")
        .select("*")
        .eq("device_id", device.id);
      if (error) throw error;
      return data;
    }
  });

  // Query registers under selected Modbus Device
  const { data: registers = [], refetch: refetchRegisters } = useQuery({
    queryKey: ["modbus-registers", selectedModbusDeviceId],
    queryFn: async () => {
      if (!selectedModbusDeviceId) return [];
      const { data, error } = await supabase
        .from("modbus_registers")
        .select("*")
        .eq("modbus_device_id", selectedModbusDeviceId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedModbusDeviceId
  });

  // Automatically select first modbus device on load
  useEffect(() => {
    const devices = modbusDevices || [];
    if (devices.length > 0 && !selectedModbusDeviceId) {
      setSelectedModbusDeviceId(devices[0].id);
      setBaudRate(devices[0].baud_rate);
      setParity(devices[0].parity as any);
      setStopBits(devices[0].stop_bits as any);
      setDataBits(devices[0].data_bits as any);
      setSlaveId(devices[0].slave_id);
    }
  }, [modbusDevices, selectedModbusDeviceId]);

  // Load local ports
  const loadPorts = async () => {
    const nav = navigator as any;
    if (hasWebSerial && nav.serial) {
      try {
        const list = await nav.serial.getPorts();
        setAuthorizedPorts(list);
        if (list.length > 0) {
          setSelectedPortIdx(0);
        }
      } catch (err: any) {
        console.error("getPorts error:", err.message);
      }
    }
  };

  useEffect(() => {
    loadPorts();
  }, []);

  // Web Serial dynamic listener
  useEffect(() => {
    if (!hasWebSerial) return;
    const nav = navigator as any;

    const handleDisconnect = async () => {
      await closeLocalPort();
      setConnectedPort(false);
      setScanning(false);
      addLog("Local USB port physically disconnected.", "warn");
      loadPorts();
    };

    const handleConnect = () => {
      loadPorts();
      addLog("New USB serial adapter detected.", "info");
    };

    nav.serial.addEventListener("disconnect", handleDisconnect);
    nav.serial.addEventListener("connect", handleConnect);
    return () => {
      nav.serial.removeEventListener("disconnect", handleDisconnect);
      nav.serial.removeEventListener("connect", handleConnect);
    };
  }, [hasWebSerial]);

  const addLog = (msg: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogEntries(prev => [{ ts, msg, type }, ...prev].slice(0, 500));
  };

  const authorizeNewPort = async () => {
    const nav = navigator as any;
    try {
      const port = await nav.serial.requestPort();
      await loadPorts();
      addLog("Successfully authorized new serial port.", "success");
    } catch (err: any) {
      toast({ title: "Authorization Cancelled", description: err.message, variant: "destructive" });
    }
  };

  const handleConnectPort = async () => {
    setConnecting(true);
    try {
      const targetPort = authorizedPorts[selectedPortIdx];
      await requestAndOpenPort(baudRate, parity, stopBits, dataBits, targetPort);
      setConnectedPort(true);
      addLog(`Port connected: ${baudRate} Baud, Parity: ${parity}, Stop: ${stopBits}`, "success");
      toast({ title: "Port Opened", description: "Successfully connected to serial device." });
    } catch (err: any) {
      addLog(`Failed to open port: ${err.message}`, "error");
      toast({ title: "Port Error", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectPort = async () => {
    setScanning(false);
    await closeLocalPort();
    setConnectedPort(false);
    setReadings(new Map());
    addLog("Port connection closed.", "info");
  };

  // Add new modbus device mapping
  const addModbusDevice = useMutation({
    mutationFn: async () => {
      if (!newDeviceName.trim()) throw new Error("Device name is required");

      let presetRegs: any[] = [];
      let initialBaud = baudRate;
      let initialParity = parity;
      let initialStop = stopBits;
      let initialData = dataBits;
      let initialSlave = newDeviceSlaveId;

      if (newDevicePreset && newDevicePreset !== "custom") {
        const found = PRESET_TEMPLATES.find(p => p.name === newDevicePreset);
        if (found) {
          presetRegs = found.registers;
          initialBaud = found.baud_rate;
          initialParity = found.parity as any;
          initialStop = found.stop_bits as any;
          initialData = found.data_bits as any;
          initialSlave = found.slave_id;
        }
      }

      // 1. Insert device config profile
      const { data: dev, error: devErr } = await supabase
        .from("modbus_devices")
        .insert({
          device_id: device.id,
          name: newDeviceName,
          manufacturer: newDeviceManufacturer,
          slave_id: initialSlave,
          baud_rate: initialBaud,
          parity: initialParity,
          stop_bits: initialStop,
          data_bits: initialData
        })
        .select()
        .single();

      if (devErr) throw devErr;

      // 2. Insert mapped registers if preset selected
      if (presetRegs.length > 0) {
        const regsToInsert = presetRegs.map(r => ({
          modbus_device_id: dev.id,
          address: r.address,
          function_code: r.function_code,
          label: r.label,
          data_type: r.data_type,
          scale: r.scale,
          unit: r.unit,
          group_name: r.group_name,
          display_order: r.display_order
        }));

        const { error: regErr } = await supabase
          .from("modbus_registers")
          .insert(regsToInsert);

        if (regErr) throw regErr;
      }

      return dev;
    },
    onSuccess: (data) => {
      toast({ title: "Modbus Device Added", description: `Successfully created ${data.name}.` });
      refetchModbusDevices();
      setSelectedModbusDeviceId(data.id);
      setNewDeviceName("");
      setNewDeviceManufacturer("");
      setNewDevicePreset("");
    },
    onError: (err: any) => {
      toast({ title: "Creation Failed", description: err.message, variant: "destructive" });
    }
  });

  // Delete Modbus device
  const deleteModbusDevice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modbus_devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Device Deleted", description: "Modbus device profile has been removed." });
      refetchModbusDevices();
      setSelectedModbusDeviceId("");
    }
  });

  // Autodetect settings scanning
  const runAutoDetect = async () => {
    setDetecting(true);
    addLog(`Auto Mode started. Scanning configurations for Slave ID ${autoDetectSlaveId}...`, "warn");
    try {
      const targetPort = authorizedPorts[selectedPortIdx];
      if (!targetPort) throw new Error("Please authorize and select a port first.");

      await requestAndOpenPort(19200, "even", 1, 8, targetPort);
      const config = await autoDetectLocalSettings(autoDetectSlaveId, autoDetectTestAddr, autoDetectTestFc);

      setBaudRate(config.baudRate);
      setParity(config.parity);
      setStopBits(config.stopBits as any);
      setSlaveId(autoDetectSlaveId);
      setConnectedPort(true);

      addLog(`Auto Mode discovered parameters: ${config.baudRate} Baud, Parity: ${config.parity}, Stop: ${config.stopBits}`, "success");
      toast({ title: "Configuration Discovered!", description: `Found device at ${config.baudRate} Baud, Parity: ${config.parity}` });
      setShowAutoDetect(false);
    } catch (err: any) {
      addLog(`Auto-detect failed: ${err.message}`, "error");
      toast({ title: "Auto-detect Failed", description: err.message, variant: "destructive" });
      await closeLocalPort();
      setConnectedPort(false);
    } finally {
      setDetecting(false);
    }
  };

  // Main polling loop
  useEffect(() => {
    if (!scanning || !connectedPort || !registers || registers.length === 0) return;

    let active = true;
    let timerId: any = null;

    const runPoll = async () => {
      const blocks = groupIntoBlocks(registers || []);
      const allReadings: any[] = [];
      const nowTime = new Date().toLocaleTimeString();

      for (const block of blocks) {
        if (!active) return;
        try {
          // 50ms spacing between packets to let bus settle
          await new Promise(resolve => setTimeout(resolve, 50));

          let rawWords: number[] = [];
          if (block.fc === 4) {
            rawWords = await readLocalInputRegisters(slaveId, block.startAddress, block.count);
          } else {
            rawWords = await readLocalHoldingRegisters(slaveId, block.startAddress, block.count);
          }

          const blockReadings = mapLocalReadings(rawWords, block.startAddress, block.registers);
          allReadings.push(...blockReadings);
        } catch (err: any) {
          if (active) {
            addLog(`Error reading address ${block.startAddress}: ${err.message}`, "error");
            // 300ms sleep on error to let device serial engine reset
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      if (allReadings.length > 0 && active) {
        // Update local readings state (table & sparklines)
        setReadings(prev => {
          const next = new Map(prev);
          for (const item of allReadings) {
            const ex = next.get(item.registerId) ?? { history: [] };
            const history = [...ex.history, item.value].slice(-60);
            next.set(item.registerId, {
              value: item.value,
              label: item.label,
              unit: item.unit,
              history
            });
          }
          return next;
        });

        // Add to live feed entries
        setFeedEntries(prev => {
          const newEntries = allReadings.map(item => ({
            ts: nowTime,
            label: item.label,
            value: item.value,
            unit: item.unit
          }));
          return [...newEntries, ...prev].slice(0, 1000);
        });

        // Dynamic database sync
        if (autoSaveToDb) {
          try {
            const rowsToInsert = allReadings.map(item => ({
              modbus_device_id: selectedModbusDeviceId,
              register_id: item.registerId,
              raw_value: String(item.value),
              scaled_value: item.value
            }));

            const { error } = await supabase
              .from("modbus_readings")
              .insert(rowsToInsert);

            if (error) throw error;
          } catch (dbErr: any) {
            console.error("Database auto-save error:", dbErr.message);
          }
        }
      }

      if (active) {
        timerId = setTimeout(runPoll, pollInterval);
      }
    };

    runPoll();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [scanning, connectedPort, registers, pollInterval, slaveId, autoSaveToDb, selectedModbusDeviceId]);

  // Execute manual Modbus operations
  const runManualOp = async () => {
    if (!connectedPort) {
      toast({ title: "Disconnected", description: "Serial port is not open.", variant: "destructive" });
      return;
    }
    setManualPending(true);
    setManualResult(null);

    const fcNum = Number(manualFc);
    try {
      if (fcNum === 3 || fcNum === 4) {
        // READ holding or input
        let rawWords: number[] = [];
        if (fcNum === 4) {
          rawWords = await readLocalInputRegisters(slaveId, manualAddress, manualCount);
        } else {
          rawWords = await readLocalHoldingRegisters(slaveId, manualAddress, manualCount);
        }

        let decodedVal = null;
        try {
          decodedVal = decodeWords(rawWords, manualDataType);
        } catch (_) {}

        setManualResult({
          status: "success",
          operation: "read",
          raw: rawWords,
          decoded: decodedVal,
          ts: new Date().toLocaleTimeString()
        });
        addLog(`Manual read success: FC0${fcNum} Address ${manualAddress}, Raw: [${rawWords.join(",")}], Decoded: ${decodedVal}`, "success");
      } else {
        // WRITE holding
        let words: number[] = [];
        if (manualDataType === "raw") {
          words = manualWriteVal.split(",").map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
        } else {
          words = encodeWords(manualWriteVal, manualDataType);
        }

        if (words.length === 0) throw new Error("No valid write values parsed.");

        if (fcNum === 6 && words.length === 1) {
          await writeLocalSingleRegister(slaveId, manualAddress, words[0]);
        } else {
          await writeLocalMultipleRegisters(slaveId, manualAddress, words);
        }

        setManualResult({
          status: "success",
          operation: "write",
          wrote: words,
          ts: new Date().toLocaleTimeString()
        });
        addLog(`Manual write success: FC${fcNum} Address ${manualAddress}, Wrote: [${words.join(",")}]`, "success");
      }
    } catch (err: any) {
      setManualResult({ status: "error", message: err.message, ts: new Date().toLocaleTimeString() });
      addLog(`Manual command failed: ${err.message}`, "error");
    } finally {
      setManualPending(false);
    }
  };

  const getPortLabel = (port: any, idx: number) => {
    const info = port.getInfo();
    if (info.usbVendorId !== undefined) {
      const vid = "0x" + info.usbVendorId.toString(16).toUpperCase().padStart(4, "0");
      const pid = "0x" + info.usbProductId.toString(16).toUpperCase().padStart(4, "0");
      return `USB Serial Port #${idx + 1} (VID: ${vid}, PID: ${pid})`;
    }
    return `Serial Adapter #${idx + 1}`;
  };

  return (
    <div className="space-y-6">
      {/* Port Connection & Configuration Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>RS-485 Modbus Port Connection</span>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
                  scanning ? "bg-primary/20 text-primary animate-pulse" :
                  connectedPort ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    scanning ? "bg-primary" :
                    connectedPort ? "bg-success glow-success" : "bg-muted-foreground"
                  }`} />
                  {scanning ? "Polling Bus" : connectedPort ? "Connected" : "Disconnected"}
                </span>
              </div>
            </CardTitle>
            <CardDescription>Configure physical RS-485 serial params and connection profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasWebSerial && (
              <div className="bg-destructive/15 text-destructive border border-destructive/20 rounded-lg p-3 text-xs">
                ⚠️ <strong>Browser Compatibility Error:</strong> Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera to perform direct serial scanning.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                <label className="text-xs font-semibold text-muted-foreground">Authorized USB Port</label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={String(selectedPortIdx)}
                    onValueChange={(val) => setSelectedPortIdx(Number(val))}
                    disabled={connectedPort || authorizedPorts.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="No ports found" />
                    </SelectTrigger>
                    <SelectContent>
                      {authorizedPorts.map((p, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {getPortLabel(p, idx)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={authorizeNewPort}
                    disabled={connectedPort || !hasWebSerial}
                    title="Request USB serial port authorization"
                  >
                    <Plus size={15} />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Baud Rate</label>
                <Select value={String(baudRate)} onValueChange={(val) => setBaudRate(Number(val))} disabled={connectedPort}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => (
                      <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Parity</label>
                <Select value={parity} onValueChange={(val: any) => setParity(val)} disabled={connectedPort}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (N)</SelectItem>
                    <SelectItem value="even">Even (E)</SelectItem>
                    <SelectItem value="odd">Odd (O)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Stop Bits</label>
                <Select value={String(stopBits)} onValueChange={(val: any) => setStopBits(Number(val) as any)} disabled={connectedPort}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Bit</SelectItem>
                    <SelectItem value="2">2 Bits</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Slave ID</label>
                <Input
                  type="number"
                  className="h-9 text-center"
                  min={1} max={247}
                  value={slaveId}
                  onChange={e => setSlaveId(Number(e.target.value))}
                  disabled={connectedPort}
                />
              </div>

              <div className="flex items-end gap-1.5 col-span-2 md:col-span-1">
                {!connectedPort ? (
                  <>
                    <Button
                      className="w-full bg-success hover:bg-success/90 text-success-foreground h-9 font-medium"
                      onClick={handleConnectPort}
                      disabled={!hasWebSerial || connecting || detecting || authorizedPorts.length === 0}
                    >
                      {connecting && <RefreshCw size={14} className="mr-1.5 animate-spin" />}
                      Connect
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary shrink-0"
                      onClick={() => setShowAutoDetect(!showAutoDetect)}
                      disabled={!hasWebSerial || connecting || detecting || authorizedPorts.length === 0}
                    >
                      🔍 Auto
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" variant="destructive" h-9 onClick={handleDisconnectPort}>
                    Disconnect
                  </Button>
                )}
              </div>
            </div>

            {/* Auto-detect settings panel */}
            <AnimatePresence>
              {showAutoDetect && !connectedPort && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border border-primary/20 bg-primary/5 rounded-lg p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5"><Sliders size={13} /> Auto-Detect Configuration Setup</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Test Slave ID</span>
                      <Input type="number" className="h-8" min={1} max={247} value={autoDetectSlaveId} onChange={e => setAutoDetectSlaveId(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Register Address</span>
                      <Input type="number" className="h-8" min={0} value={autoDetectTestAddr} onChange={e => setAutoDetectTestAddr(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Function Code</span>
                      <Select value={String(autoDetectTestFc)} onValueChange={val => setAutoDetectTestFc(Number(val))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">FC 03 (Holding)</SelectItem>
                          <SelectItem value="4">FC 04 (Input)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <Button size="sm" className="w-full h-8" onClick={runAutoDetect} disabled={detecting}>
                        {detecting ? "Scanning..." : "Start Scan"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setShowAutoDetect(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Selected Modbus device detail */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Cpu size={16} className="text-primary" /> Slaves & Seeding</CardTitle>
            <CardDescription>Select Modbus slave configs or seed templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Active Modbus Device</label>
              <div className="flex items-center gap-1.5">
                <Select
                  value={selectedModbusDeviceId}
                  onValueChange={(val) => {
                    setSelectedModbusDeviceId(val);
                    const dev = (modbusDevices || []).find(d => d.id === val);
                    if (dev) {
                      setBaudRate(dev.baud_rate);
                      setParity(dev.parity as any);
                      setStopBits(dev.stop_bits as any);
                      setDataBits(dev.data_bits as any);
                      setSlaveId(dev.slave_id);
                    }
                  }}
                  disabled={scanning}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Add a slave profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(modbusDevices || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} (ID: {d.slave_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModbusDeviceId && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-destructive/20 text-destructive hover:bg-destructive/5 shrink-0"
                    onClick={() => deleteModbusDevice.mutate(selectedModbusDeviceId)}
                    disabled={scanning}
                    title="Delete this Modbus device configuration"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-border my-3" />

            {/* Seed Device / New Device Profile Form */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-muted-foreground block">🆕 Setup New Modbus Slave Profile</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Device Name</span>
                  <Input placeholder="e.g. EM6400NG" className="h-8" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Template Preset</span>
                  <Select value={newDevicePreset} onValueChange={(val) => {
                    setNewDevicePreset(val);
                    if (val && val !== "custom") setNewDeviceName(val);
                  }}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom Setup (Blank)</SelectItem>
                      {PRESET_TEMPLATES.map(p => (
                        <SelectItem key={p.name} value={p.name}>{p.name} ({p.manufacturer})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => addModbusDevice.mutate()}
                disabled={addModbusDevice.isPending || !newDeviceName.trim()}
              >
                {addModbusDevice.isPending ? "Configuring..." : "💾 Register & Save Device"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Monitoring, Feed and Diagnostics Tabs */}
      <Tabs defaultValue="values" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted border border-border rounded-lg p-2 flex-wrap">
          <TabsList className="bg-muted">
            <TabsTrigger value="values" className="flex items-center gap-1.5"><Activity size={14} /> Live values</TabsTrigger>
            <TabsTrigger value="feed" className="flex items-center gap-1.5"><Radio size={14} /> Data feed</TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5"><Sliders size={14} /> Diagnostics</TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1.5"><Cpu size={14} /> Terminal Logs</TabsTrigger>
          </TabsList>

          {/* Scanner Polling Toolbar */}
          <div className="flex items-center gap-4 text-sm ml-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Database size={13} /> Sync to Cloud</label>
              <Switch checked={autoSaveToDb} onCheckedChange={setAutoSaveToDb} />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-semibold">Interval:</span>
              <Select value={String(pollInterval)} onValueChange={val => setPollInterval(Number(val))} disabled={scanning}>
                <SelectTrigger className="h-8 w-20 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1.0s</SelectItem>
                  <SelectItem value="2000">2.0s</SelectItem>
                  <SelectItem value="5000">5.0s</SelectItem>
                  <SelectItem value="10000">10.0s</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              {!scanning ? (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1 h-8"
                  onClick={() => {
                    if (!connectedPort) {
                      toast({ title: "Port Offline", description: "Please connect the serial port first.", variant: "destructive" });
                      return;
                    }
                    if (!registers || registers.length === 0) {
                      toast({ title: "No Registers", description: "Active device has no registers configured.", variant: "destructive" });
                      return;
                    }
                    setScanning(true);
                    addLog("Live RS-485 Modbus scanning loop started.", "success");
                  }}
                  disabled={!connectedPort || !registers || registers.length === 0}
                >
                  <Play size={13} className="fill-current" /> Start Scan
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="font-medium flex items-center gap-1 h-8"
                  onClick={() => {
                    setScanning(false);
                    addLog("Live RS-485 Modbus scanning loop stopped.", "info");
                  }}
                >
                  <Square size={13} className="fill-current" /> Stop Scan
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Values Table */}
        <TabsContent value="values" className="m-0">
          <Card className="border-border">
            <CardContent className="p-0">
              {!registers || registers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Cpu size={36} className="text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold">No registers mapped to this device.</p>
                  <p className="text-xs">Setup a preset template or add registers to begin monitoring.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-16">Offset</TableHead>
                      <TableHead>Register Label</TableHead>
                      <TableHead className="w-24">FC</TableHead>
                      <TableHead className="w-24">Data Type</TableHead>
                      <TableHead className="text-right w-32">Current Value</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                      <TableHead className="text-center w-32">60s Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(registers || []).map((reg) => {
                      const reading = readings.get(reg.id);
                      return (
                        <TableRow key={reg.id} className="hover:bg-muted/10 font-mono text-xs">
                          <TableCell className="font-semibold text-muted-foreground">#{reg.address}</TableCell>
                          <TableCell className="font-sans font-medium text-sm text-foreground">{reg.label}</TableCell>
                          <TableCell className="text-muted-foreground">FC 0{reg.function_code}</TableCell>
                          <TableCell className="text-muted-foreground">{reg.data_type}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-foreground">
                            {reading ? reading.value.toFixed(3) : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-sans">{reg.unit || "—"}</TableCell>
                          <TableCell className="flex justify-center items-center py-3">
                            <Sparkline data={reading?.history || []} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Data Feed */}
        <TabsContent value="feed" className="m-0">
          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Historical Data Log Feed</CardTitle>
                <CardDescription>Rolling sequential feed of active scan registers</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFeedEntries([])}>Clear Feed</Button>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto font-mono text-xs">
              {feedEntries.length === 0 ? (
                <div className="flex justify-center items-center py-12 text-muted-foreground text-sm font-sans">
                  No scan readings captured yet. Start the scanning loop to populate feed.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-24">Timestamp</TableHead>
                      <TableHead>Register</TableHead>
                      <TableHead className="text-right w-32">Read Value</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedEntries.map((e, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/10">
                        <TableCell className="text-muted-foreground">{e.ts}</TableCell>
                        <TableCell className="font-sans font-medium text-foreground">{e.label}</TableCell>
                        <TableCell className="text-right font-semibold text-foreground">{e.value.toFixed(3)}</TableCell>
                        <TableCell className="text-muted-foreground font-sans">{e.unit || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Modbus Diagnostics */}
        <TabsContent value="manual" className="m-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50 md:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Direct Modbus Commands</CardTitle>
                <CardDescription>Send raw diagnostic frames to Modbus slave</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-semibold">Function Code</span>
                  <Select value={manualFc} onValueChange={setManualFc}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">FC 03 (Read Holding)</SelectItem>
                      <SelectItem value="4">FC 04 (Read Input)</SelectItem>
                      <SelectItem value="6">FC 06 (Write Single)</SelectItem>
                      <SelectItem value="16">FC 16 (Write Multiple)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-semibold">Register Address Offset</span>
                  <Input type="number" className="h-8" min={0} value={manualAddress} onChange={e => setManualAddress(Number(e.target.value))} />
                </div>

                {(manualFc === "3" || manualFc === "4") && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Register Count</span>
                    <Input type="number" className="h-8" min={1} max={125} value={manualCount} onChange={e => setManualCount(Number(e.target.value))} />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-semibold">Data Decoding Type</span>
                  <Select value={manualDataType} onValueChange={setManualDataType}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uint16">Unsigned 16-Bit (uint16)</SelectItem>
                      <SelectItem value="int16">Signed 16-Bit (int16)</SelectItem>
                      <SelectItem value="float32_be">Big-Endian Float (float32_be)</SelectItem>
                      <SelectItem value="float32_le">Word-Swapped Float (float32_le)</SelectItem>
                      <SelectItem value="uint32_be">Big-Endian Long (uint32_be)</SelectItem>
                      <SelectItem value="uint32_le">Word-Swapped Long (uint32_le)</SelectItem>
                      <SelectItem value="raw">Raw Integer Array (write only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(manualFc === "6" || manualFc === "16") && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground font-semibold">Write Value(s)</span>
                    <Input
                      placeholder={manualFc === "6" ? "e.g. 100" : "Comma separated: e.g. 100,200"}
                      className="h-8"
                      value={manualWriteVal}
                      onChange={e => setManualWriteVal(e.target.value)}
                    />
                  </div>
                )}

                <Button className="w-full h-8 font-medium" onClick={runManualOp} disabled={manualPending || !connectedPort}>
                  {manualPending ? "Sending..." : "🚀 Execute Transaction"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Diagnostic Transaction Output</CardTitle>
                <CardDescription>Inspect manual frame request responses in raw formats</CardDescription>
              </CardHeader>
              <CardContent className="font-mono text-xs max-h-[350px] overflow-y-auto">
                {!manualResult ? (
                  <div className="flex justify-center items-center py-20 text-muted-foreground text-sm font-sans">
                    Execute a direct transaction to view response values.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-muted-foreground">Transaction Time: {manualResult.ts}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        manualResult.status === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      }`}>
                        {manualResult.status === "success" ? "SUCCESS" : "FAILED"}
                      </span>
                    </div>

                    {manualResult.status === "success" ? (
                      <div className="space-y-2">
                        {manualResult.operation === "read" ? (
                          <>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase font-sans">Raw Registers Words (16-bit)</span>
                              <div className="bg-muted/50 p-2.5 rounded font-mono text-foreground font-semibold">
                                [{manualResult.raw.join(", ")}]
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase font-sans">Decoded Output</span>
                              <div className="bg-muted/50 p-2.5 rounded font-mono text-primary font-bold text-sm">
                                {manualResult.decoded !== null ? String(manualResult.decoded) : "Failed to decode (check count/data type)"}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-sans">Wrote Registers Words (16-bit)</span>
                            <div className="bg-muted/50 p-2.5 rounded font-mono text-foreground font-semibold">
                              [{manualResult.wrote.join(", ")}]
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-destructive/15 text-destructive border border-destructive/20 rounded p-2.5 font-sans">
                        Error executing Modbus frame: {manualResult.message}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Terminal logs tab */}
        <TabsContent value="logs" className="m-0">
          <Card className="border-border bg-black/90">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-success font-mono">dev-terminal-logs (~/rs485-bus)</CardTitle>
                  <CardDescription className="text-muted-foreground/60 text-xs">Real-time serial channel read output stream</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-success" onClick={() => setLogEntries([])}>Clear Terminal</Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 font-mono text-[11px] leading-relaxed max-h-[380px] overflow-y-auto text-success-foreground">
              {logEntries.length === 0 ? (
                <div className="text-muted-foreground/40 py-12 text-center text-xs">
                  Console idle. Transaction diagnostic messages will print here.
                </div>
              ) : (
                <div className="space-y-1">
                  {logEntries.map((log, idx) => {
                    const color =
                      log.type === "success" ? "text-success" :
                      log.type === "error" ? "text-destructive" :
                      log.type === "warn" ? "text-warning" : "text-muted-foreground";
                    return (
                      <div key={idx} className="flex items-start gap-2 border-b border-border py-0.5">
                        <span className="text-muted-foreground/50 w-20 shrink-0">{log.ts}</span>
                        <span className={`font-semibold shrink-0 ${color}`}>
                          {log.type === "success" ? "[ OK ]" :
                           log.type === "error" ? "[FAIL]" :
                           log.type === "warn" ? "[WARN]" : "[INFO]"}
                        </span>
                        <span className="text-muted-foreground/90 whitespace-pre-wrap">{log.msg}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

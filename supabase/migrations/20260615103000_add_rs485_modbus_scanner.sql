-- Create modbus_devices table
CREATE TABLE public.modbus_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manufacturer TEXT DEFAULT '',
  slave_id INTEGER NOT NULL DEFAULT 1,
  baud_rate INTEGER NOT NULL DEFAULT 9600,
  parity TEXT NOT NULL DEFAULT 'none',
  stop_bits INTEGER NOT NULL DEFAULT 1,
  data_bits INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modbus_devices ENABLE ROW LEVEL SECURITY;

-- Create modbus_registers table
CREATE TABLE public.modbus_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modbus_device_id UUID NOT NULL REFERENCES public.modbus_devices(id) ON DELETE CASCADE,
  address INTEGER NOT NULL,
  function_code INTEGER NOT NULL DEFAULT 3,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'float32_be',
  scale REAL NOT NULL DEFAULT 1.0,
  unit TEXT DEFAULT '',
  group_name TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modbus_device_id, address, function_code)
);

ALTER TABLE public.modbus_registers ENABLE ROW LEVEL SECURITY;

-- Create modbus_readings table
CREATE TABLE public.modbus_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modbus_device_id UUID NOT NULL REFERENCES public.modbus_devices(id) ON DELETE CASCADE,
  register_id UUID NOT NULL REFERENCES public.modbus_registers(id) ON DELETE CASCADE,
  raw_value TEXT DEFAULT '',
  scaled_value REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modbus_readings ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_modbus_devices_updated_at
BEFORE UPDATE ON public.modbus_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modbus_registers_updated_at
BEFORE UPDATE ON public.modbus_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- modbus_devices policies
CREATE POLICY "Users can view own modbus devices" ON public.modbus_devices
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = modbus_devices.device_id
        AND (devices.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own modbus devices" ON public.modbus_devices
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = modbus_devices.device_id
        AND (devices.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own modbus devices" ON public.modbus_devices
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = modbus_devices.device_id
        AND (devices.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can delete own modbus devices" ON public.modbus_devices
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = modbus_devices.device_id
        AND (devices.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- modbus_registers policies
CREATE POLICY "Users can view modbus registers" ON public.modbus_registers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.modbus_devices md
      JOIN public.devices d ON d.id = md.device_id
      WHERE md.id = modbus_registers.modbus_device_id
        AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can manage modbus registers" ON public.modbus_registers
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.modbus_devices md
      JOIN public.devices d ON d.id = md.device_id
      WHERE md.id = modbus_registers.modbus_device_id
        AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- modbus_readings policies
CREATE POLICY "Users can view modbus readings" ON public.modbus_readings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.modbus_devices md
      JOIN public.devices d ON d.id = md.device_id
      WHERE md.id = modbus_readings.modbus_device_id
        AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Insert readings for modbus devices" ON public.modbus_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.modbus_devices
      WHERE modbus_devices.id = modbus_readings.modbus_device_id
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.modbus_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modbus_devices;


-- Channel configuration table to persist channel labels and settings
CREATE TABLE public.device_channel_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('analog', 'digital_in', 'digital_out')),
  channel_number INTEGER NOT NULL CHECK (channel_number BETWEEN 1 AND 4),
  label TEXT NOT NULL DEFAULT '',
  data_mode TEXT DEFAULT '0-10V',
  unit TEXT DEFAULT '',
  min_value REAL DEFAULT 0,
  max_value REAL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, channel_type, channel_number)
);

-- Enable RLS
ALTER TABLE public.device_channel_config ENABLE ROW LEVEL SECURITY;

-- Owner can view config for their approved devices
CREATE POLICY "Owner can view channel config"
ON public.device_channel_config
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM devices
  WHERE devices.id = device_channel_config.device_id
    AND devices.owner_id = auth.uid()
    AND devices.approval_status = 'approved'
));

-- Admins can view all channel config
CREATE POLICY "Admins can view all channel config"
ON public.device_channel_config
FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Owner can insert channel config
CREATE POLICY "Owner can insert channel config"
ON public.device_channel_config
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM devices
  WHERE devices.id = device_channel_config.device_id
    AND devices.owner_id = auth.uid()
));

-- Owner can update channel config
CREATE POLICY "Owner can update channel config"
ON public.device_channel_config
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM devices
  WHERE devices.id = device_channel_config.device_id
    AND devices.owner_id = auth.uid()
));

-- Admins can update any channel config
CREATE POLICY "Admins can update any channel config"
ON public.device_channel_config
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Owner can delete channel config
CREATE POLICY "Owner can delete channel config"
ON public.device_channel_config
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM devices
  WHERE devices.id = device_channel_config.device_id
    AND devices.owner_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_device_channel_config_updated_at
BEFORE UPDATE ON public.device_channel_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow users to delete their own devices
CREATE POLICY "Owner can delete own devices"
ON public.devices
FOR DELETE
USING (auth.uid() = owner_id);

-- Allow admins to delete any device
CREATE POLICY "Admins can delete any device"
ON public.devices
FOR DELETE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Allow admins to insert channel config
CREATE POLICY "Admins can insert channel config"
ON public.device_channel_config
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Admins can delete channel config
CREATE POLICY "Admins can delete channel config"
ON public.device_channel_config
FOR DELETE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

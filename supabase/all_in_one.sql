
-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- Create device status enum
CREATE TYPE public.device_status AS ENUM ('pending', 'approved', 'rejected');

-- Create user subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'suspended');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  factory_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  subscription_status subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mac_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'New Device',
  nickname TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_status device_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  modbus_address TEXT DEFAULT '0x01',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Device data / readings table
CREATE TABLE public.device_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  analog_ch1 REAL DEFAULT 0,
  analog_ch1_mode TEXT DEFAULT '0-10V',
  analog_ch2 REAL DEFAULT 0,
  analog_ch2_mode TEXT DEFAULT '0-10V',
  analog_ch3 REAL DEFAULT 0,
  analog_ch3_mode TEXT DEFAULT '0-10V',
  analog_ch4 REAL DEFAULT 0,
  analog_ch4_mode TEXT DEFAULT '0-10V',
  digital_in1 BOOLEAN DEFAULT false,
  digital_in2 BOOLEAN DEFAULT false,
  digital_in3 BOOLEAN DEFAULT false,
  digital_in4 BOOLEAN DEFAULT false,
  digital_out1 BOOLEAN DEFAULT false,
  digital_out2 BOOLEAN DEFAULT false,
  digital_out3 BOOLEAN DEFAULT false,
  digital_out4 BOOLEAN DEFAULT false,
  rtc_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_readings ENABLE ROW LEVEL SECURITY;

-- Device history / events log
CREATE TABLE public.device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  -- Default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles: admins can read all, only super_admin can insert/update
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Devices: owner sees approved devices, admins see all
CREATE POLICY "Owner can view approved devices" ON public.devices FOR SELECT USING (auth.uid() = owner_id AND approval_status = 'approved');
CREATE POLICY "Admins can view all devices" ON public.devices FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update own devices" ON public.devices FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can update any device" ON public.devices FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- Device readings: owner of device can read, admins can read all
CREATE POLICY "Device owner can view readings" ON public.device_readings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_readings.device_id AND devices.owner_id = auth.uid() AND devices.approval_status = 'approved')
);
CREATE POLICY "Admins can view all readings" ON public.device_readings FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anon can insert readings" ON public.device_readings FOR INSERT WITH CHECK (true);

-- Device events: same as readings
CREATE POLICY "Device owner can view events" ON public.device_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_events.device_id AND devices.owner_id = auth.uid() AND devices.approval_status = 'approved')
);
CREATE POLICY "Admins can view all events" ON public.device_events FOR SELECT USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert events" ON public.device_events FOR INSERT WITH CHECK (true);

-- Fix permissive insert policies for device_readings and device_events
-- Require that the device_id references an existing device
DROP POLICY "Anon can insert readings" ON public.device_readings;
CREATE POLICY "Insert readings for existing devices" ON public.device_readings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_readings.device_id)
);

DROP POLICY "Anyone can insert events" ON public.device_events;
CREATE POLICY "Insert events for existing devices" ON public.device_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_events.device_id)
);

-- Fix ALL policies to be PERMISSIVE (default) instead of RESTRICTIVE
-- This allows OR logic: user OR admin can access

-- PROFILES
DROP POLICY "Users can view own profile" ON public.profiles;
DROP POLICY "Admins can view all profiles" ON public.profiles;
DROP POLICY "Users can update own profile" ON public.profiles;
DROP POLICY "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- USER_ROLES
DROP POLICY "Users can view own role" ON public.user_roles;
DROP POLICY "Admins can view all roles" ON public.user_roles;
DROP POLICY "Super admin can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- DEVICES
DROP POLICY "Owner can view approved devices" ON public.devices;
DROP POLICY "Admins can view all devices" ON public.devices;
DROP POLICY "Users can insert devices" ON public.devices;
DROP POLICY "Owner can update own devices" ON public.devices;
DROP POLICY "Admins can update any device" ON public.devices;

CREATE POLICY "Owner can view approved devices" ON public.devices FOR SELECT TO authenticated USING (auth.uid() = owner_id AND approval_status = 'approved');
CREATE POLICY "Admins can view all devices" ON public.devices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert devices" ON public.devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update own devices" ON public.devices FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins can update any device" ON public.devices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- DEVICE_READINGS
DROP POLICY "Device owner can view readings" ON public.device_readings;
DROP POLICY "Admins can view all readings" ON public.device_readings;
DROP POLICY "Insert readings for existing devices" ON public.device_readings;

CREATE POLICY "Device owner can view readings" ON public.device_readings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_readings.device_id AND devices.owner_id = auth.uid() AND devices.approval_status = 'approved')
);
CREATE POLICY "Admins can view all readings" ON public.device_readings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert readings for existing devices" ON public.device_readings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_readings.device_id)
);

-- DEVICE_EVENTS
DROP POLICY "Device owner can view events" ON public.device_events;
DROP POLICY "Admins can view all events" ON public.device_events;
DROP POLICY "Insert events for existing devices" ON public.device_events;

CREATE POLICY "Device owner can view events" ON public.device_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_events.device_id AND devices.owner_id = auth.uid() AND devices.approval_status = 'approved')
);
CREATE POLICY "Admins can view all events" ON public.device_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert events for existing devices" ON public.device_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.devices WHERE devices.id = device_events.device_id)
);

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

-- Enable realtime for device_readings and devices tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_events;

-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_on_offline BOOLEAN NOT NULL DEFAULT true,
  email_on_alert BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prefs" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prefs" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prefs" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

-- Create table for storing database snapshots
CREATE TABLE public.database_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  snapshot_data JSONB NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.database_snapshots ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage snapshots
CREATE POLICY "Super admins can view snapshots"
  ON public.database_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can create snapshots"
  ON public.database_snapshots FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete snapshots"
  ON public.database_snapshots FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));
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

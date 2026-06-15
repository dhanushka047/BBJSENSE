
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

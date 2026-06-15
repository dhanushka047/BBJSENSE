
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

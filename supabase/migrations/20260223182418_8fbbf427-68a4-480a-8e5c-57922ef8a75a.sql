
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


-- Enable realtime for device_readings and devices tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_events;

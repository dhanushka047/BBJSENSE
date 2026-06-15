
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

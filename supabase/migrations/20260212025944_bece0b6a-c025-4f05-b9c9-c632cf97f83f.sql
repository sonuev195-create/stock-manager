
-- Add delete password to settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS delete_password text DEFAULT NULL;

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.attributes ADD COLUMN IF NOT EXISTS description text;
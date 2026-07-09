
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands public read" ON public.brands FOR SELECT USING (true);
CREATE POLICY "brands admin all" ON public.brands FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER brands_slug BEFORE INSERT OR UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  symbol text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units public read" ON public.units FOR SELECT USING (true);
CREATE POLICY "units admin all" ON public.units FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER units_slug BEFORE INSERT OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  values text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes TO authenticated;
GRANT ALL ON public.attributes TO service_role;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attributes public read" ON public.attributes FOR SELECT USING (true);
CREATE POLICY "attributes admin all" ON public.attributes FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER attributes_slug BEFORE INSERT OR UPDATE ON public.attributes FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER attributes_updated BEFORE UPDATE ON public.attributes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

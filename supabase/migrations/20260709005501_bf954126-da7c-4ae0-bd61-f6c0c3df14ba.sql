
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS weight_value numeric,
  ADD COLUMN IF NOT EXISTS weight_unit text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.generate_ean13()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE base text := ''; i int; sum_val int := 0; digit int; check_digit int;
BEGIN
  FOR i IN 1..12 LOOP base := base || floor(random()*10)::int::text; END LOOP;
  FOR i IN 1..12 LOOP
    digit := substring(base from i for 1)::int;
    IF i % 2 = 0 THEN sum_val := sum_val + digit*3; ELSE sum_val := sum_val + digit; END IF;
  END LOOP;
  check_digit := (10 - (sum_val % 10)) % 10;
  RETURN base || check_digit::text;
END; $$;

CREATE OR REPLACE FUNCTION public.products_autofill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base_slug text; candidate text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.slugify(NEW.name);
    IF base_slug = '' THEN base_slug := 'product'; END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.products WHERE slug = candidate AND id <> NEW.id) LOOP
      candidate := base_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    NEW.slug := candidate;
  END IF;
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    NEW.sku := 'SKU-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    LOOP
      candidate := public.generate_ean13();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE barcode = candidate AND id <> NEW.id);
    END LOOP;
    NEW.barcode := candidate;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS products_autofill_trg ON public.products;
CREATE TRIGGER products_autofill_trg
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_autofill();

UPDATE public.products SET name = name;

ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN sku SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN barcode SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products(slug);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products(sku);
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_key ON public.products(barcode);

DROP POLICY IF EXISTS "product-media public read" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin insert" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin update" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin delete" ON storage.objects;

CREATE POLICY "product-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "product-media admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "product-media admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "product-media admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));

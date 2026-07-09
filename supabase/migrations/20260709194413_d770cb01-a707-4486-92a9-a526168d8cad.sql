
-- =========================
-- Enums
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- =========================
-- Profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE admin_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'avatar_url');
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') INTO admin_exists;
  IF NOT admin_exists THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'admin');
  ELSE INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'user'); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.taxonomy_autofill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug='' THEN
    NEW.slug := public.slugify(NEW.name);
    IF NEW.slug='' THEN NEW.slug := substr(md5(random()::text),1,6); END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_ean13()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE base text := ''; i int; sum_val int := 0; digit int; check_digit int;
BEGIN
  FOR i IN 1..12 LOOP base := base || floor(random()*10)::int::text; END LOOP;
  FOR i IN 1..12 LOOP digit := substring(base from i for 1)::int;
    IF i%2=0 THEN sum_val := sum_val + digit*3; ELSE sum_val := sum_val + digit; END IF;
  END LOOP;
  check_digit := (10 - (sum_val % 10)) % 10;
  RETURN base || check_digit::text;
END; $$;

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug text,
  sku text,
  barcode text,
  unit TEXT NOT NULL DEFAULT '1 pc',
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  cost_price numeric,
  tax_percent numeric,
  stock integer,
  low_stock_alert integer,
  product_type text NOT NULL DEFAULT 'simple',
  supplier_id uuid,
  rating NUMERIC(3,2) NOT NULL DEFAULT 4.5,
  reviews INTEGER NOT NULL DEFAULT 0,
  tag TEXT,
  img TEXT,
  category TEXT NOT NULL,
  subcategory text,
  brand TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  images text[] NOT NULL DEFAULT '{}',
  video_url text,
  description text,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight_value numeric,
  weight_unit text,
  tags text[] NOT NULL DEFAULT '{}',
  seo_title text,
  seo_description text,
  seo_keywords text[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.products_autofill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base_slug text; candidate text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug='' THEN
    base_slug := public.slugify(NEW.name);
    IF base_slug='' THEN base_slug := 'product'; END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.products WHERE slug=candidate AND id<>NEW.id) LOOP
      candidate := base_slug || '-' || substr(md5(random()::text),1,4);
    END LOOP;
    NEW.slug := candidate;
  END IF;
  IF NEW.sku IS NULL OR NEW.sku='' THEN
    NEW.sku := 'SKU-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8));
  END IF;
  IF NEW.barcode IS NULL OR NEW.barcode='' THEN
    LOOP candidate := public.generate_ean13();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE barcode=candidate AND id<>NEW.id);
    END LOOP;
    NEW.barcode := candidate;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER products_autofill_trg BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_autofill();
CREATE UNIQUE INDEX products_slug_key ON public.products(slug);
CREATE UNIQUE INDEX products_sku_key ON public.products(sku);
CREATE UNIQUE INDEX products_barcode_key ON public.products(barcode);

CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home', line1 TEXT NOT NULL, line2 TEXT, city TEXT NOT NULL, phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0, address JSONB, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid()=user_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL, price NUMERIC(10,2) NOT NULL, qty INTEGER NOT NULL DEFAULT 1, img TEXT
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR private.has_role(auth.uid(),'admin')))
);
CREATE POLICY "Users insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=auth.uid())
);

CREATE TABLE public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlist TO authenticated;
GRANT ALL ON public.wishlist TO service_role;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlist FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, description text, image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin all" ON public.categories FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_autofill BEFORE INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, description text, image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
CREATE INDEX subcategories_category_idx ON public.subcategories(category_id);
GRANT SELECT ON public.subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcategories public read" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "subcategories admin all" ON public.subcategories FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subcategories_autofill BEFORE INSERT OR UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE, description text, image_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands public read" ON public.brands FOR SELECT USING (true);
CREATE POLICY "brands admin all" ON public.brands FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER brands_autofill BEFORE INSERT OR UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE, symbol text, description text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units public read" ON public.units FOR SELECT USING (true);
CREATE POLICY "units admin all" ON public.units FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER units_autofill BEFORE INSERT OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE, values text[] NOT NULL DEFAULT '{}', description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes TO authenticated;
GRANT ALL ON public.attributes TO service_role;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attributes public read" ON public.attributes FOR SELECT USING (true);
CREATE POLICY "attributes admin all" ON public.attributes FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER attributes_autofill BEFORE INSERT OR UPDATE ON public.attributes FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();
CREATE TRIGGER attributes_updated_at BEFORE UPDATE ON public.attributes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text UNIQUE, contact_name text, email text, phone text,
  address text, description text, image_url text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers readable by all" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Admins manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER suppliers_autofill BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.taxonomy_autofill();

ALTER TABLE public.products ADD CONSTRAINT products_supplier_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE TABLE public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL, attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sku text, barcode text, cost_price numeric, price numeric NOT NULL DEFAULT 0, discount_price numeric,
  stock integer NOT NULL DEFAULT 0, low_stock_alert integer, image_url text,
  is_active boolean NOT NULL DEFAULT true, position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_variations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variations TO authenticated;
GRANT ALL ON public.product_variations TO service_role;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variations readable by all" ON public.product_variations FOR SELECT USING (true);
CREATE POLICY "Admins manage variations" ON public.product_variations FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE INDEX product_variations_product_idx ON public.product_variations(product_id);
CREATE TRIGGER product_variations_updated_at BEFORE UPDATE ON public.product_variations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Purchase module
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  shipping numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchases" ON public.purchases FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_items_purchase_idx ON public.purchase_items(purchase_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase items" ON public.purchase_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_purchase_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.variation_id IS NOT NULL THEN
      UPDATE public.product_variations SET stock = COALESCE(stock,0) + NEW.quantity::int WHERE id = NEW.variation_id;
    ELSE
      UPDATE public.products SET stock = COALESCE(stock,0) + NEW.quantity::int, in_stock = true WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.variation_id IS NOT NULL THEN
      UPDATE public.product_variations SET stock = COALESCE(stock,0) - OLD.quantity::int WHERE id = OLD.variation_id;
    ELSE
      UPDATE public.products SET stock = COALESCE(stock,0) - OLD.quantity::int WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER purchase_items_stock_ins AFTER INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_stock();
CREATE TRIGGER purchase_items_stock_del AFTER DELETE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_stock();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- product-media storage policies
DROP POLICY IF EXISTS "product-media public read" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin insert" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin update" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin delete" ON storage.objects;
CREATE POLICY "product-media public read" ON storage.objects FOR SELECT USING (bucket_id='product-media');
CREATE POLICY "product-media admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='product-media' AND private.has_role(auth.uid(),'admin'));
CREATE POLICY "product-media admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='product-media' AND private.has_role(auth.uid(),'admin'));
CREATE POLICY "product-media admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='product-media' AND private.has_role(auth.uid(),'admin'));

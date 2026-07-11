
CREATE TABLE public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer text,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text NOT NULL,
  reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_returns TO authenticated;
GRANT ALL ON public.sales_returns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_return_items TO authenticated;
GRANT ALL ON public.sales_return_items TO service_role;

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sales_returns" ON public.sales_returns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage sales_return_items" ON public.sales_return_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sales returns INCREASE stock (goods coming back), opposite of purchase returns
CREATE OR REPLACE FUNCTION public.apply_sales_return_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO parent_status FROM public.sales_returns WHERE id = NEW.return_id;
    IF parent_status = 'voided' THEN RETURN NEW; END IF;
    IF NEW.variation_id IS NOT NULL THEN
      UPDATE public.product_variations
        SET stock = COALESCE(stock,0) + NEW.quantity::int
        WHERE id = NEW.variation_id;
    ELSE
      UPDATE public.products
        SET stock = COALESCE(stock,0) + NEW.quantity::int,
            in_stock = true
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status FROM public.sales_returns WHERE id = OLD.return_id;
    IF parent_status = 'voided' THEN RETURN OLD; END IF;
    IF OLD.variation_id IS NOT NULL THEN
      UPDATE public.product_variations
        SET stock = COALESCE(stock,0) - OLD.quantity::int
        WHERE id = OLD.variation_id;
    ELSE
      UPDATE public.products
        SET stock = COALESCE(stock,0) - OLD.quantity::int,
            in_stock = (COALESCE(stock,0) - OLD.quantity::int) > 0
        WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_sales_return_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE it record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'voided' AND NEW.status = 'completed' THEN
      FOR it IN SELECT * FROM public.sales_return_items WHERE return_id = NEW.id LOOP
        IF it.variation_id IS NOT NULL THEN
          UPDATE public.product_variations SET stock = COALESCE(stock,0) + it.quantity::int WHERE id = it.variation_id;
        ELSE
          UPDATE public.products
            SET stock = COALESCE(stock,0) + it.quantity::int, in_stock = true
            WHERE id = it.product_id;
        END IF;
      END LOOP;
    ELSIF OLD.status = 'completed' AND NEW.status = 'voided' THEN
      FOR it IN SELECT * FROM public.sales_return_items WHERE return_id = NEW.id LOOP
        IF it.variation_id IS NOT NULL THEN
          UPDATE public.product_variations SET stock = COALESCE(stock,0) - it.quantity::int WHERE id = it.variation_id;
        ELSE
          UPDATE public.products
            SET stock = COALESCE(stock,0) - it.quantity::int,
                in_stock = (COALESCE(stock,0) - it.quantity::int) > 0
            WHERE id = it.product_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_sales_return_stock
AFTER INSERT OR DELETE ON public.sales_return_items
FOR EACH ROW EXECUTE FUNCTION public.apply_sales_return_stock();

CREATE TRIGGER trg_sales_return_status_change
AFTER UPDATE ON public.sales_returns
FOR EACH ROW EXECUTE FUNCTION public.handle_sales_return_status_change();

CREATE TRIGGER trg_sales_returns_updated_at
BEFORE UPDATE ON public.sales_returns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_sales_return_items_return ON public.sales_return_items(return_id);
CREATE INDEX idx_sales_returns_order ON public.sales_returns(order_id);
CREATE INDEX idx_sales_returns_date ON public.sales_returns(return_date DESC);

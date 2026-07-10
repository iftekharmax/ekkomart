
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
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

CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_returns TO authenticated;
GRANT ALL ON public.purchase_returns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_return_items TO authenticated;
GRANT ALL ON public.purchase_return_items TO service_role;

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage purchase_returns" ON public.purchase_returns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage purchase_return_items" ON public.purchase_return_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.apply_purchase_return_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.variation_id IS NOT NULL THEN
      UPDATE public.product_variations
        SET stock = COALESCE(stock,0) - NEW.quantity::int
        WHERE id = NEW.variation_id;
    ELSE
      UPDATE public.products
        SET stock = COALESCE(stock,0) - NEW.quantity::int,
            in_stock = (COALESCE(stock,0) - NEW.quantity::int) > 0
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.variation_id IS NOT NULL THEN
      UPDATE public.product_variations
        SET stock = COALESCE(stock,0) + OLD.quantity::int
        WHERE id = OLD.variation_id;
    ELSE
      UPDATE public.products
        SET stock = COALESCE(stock,0) + OLD.quantity::int,
            in_stock = true
        WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_apply_purchase_return_stock
AFTER INSERT OR DELETE ON public.purchase_return_items
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_return_stock();

CREATE TRIGGER trg_purchase_returns_updated_at
BEFORE UPDATE ON public.purchase_returns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_purchase_return_items_return ON public.purchase_return_items(return_id);
CREATE INDEX idx_purchase_returns_supplier ON public.purchase_returns(supplier_id);
CREATE INDEX idx_purchase_returns_purchase ON public.purchase_returns(purchase_id);

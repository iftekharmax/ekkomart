
CREATE TABLE public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT ALL ON public.stock_adjustments TO service_role;

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stock adjustments"
  ON public.stock_adjustments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.apply_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.variation_id IS NOT NULL THEN
      UPDATE public.product_variations SET stock = COALESCE(stock,0) + NEW.quantity WHERE id = NEW.variation_id;
    ELSE
      UPDATE public.products
      SET stock = COALESCE(stock,0) + NEW.quantity,
          in_stock = (COALESCE(stock,0) + NEW.quantity) > 0
      WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.variation_id IS NOT NULL THEN
      UPDATE public.product_variations SET stock = COALESCE(stock,0) - OLD.quantity WHERE id = OLD.variation_id;
    ELSE
      UPDATE public.products
      SET stock = COALESCE(stock,0) - OLD.quantity,
          in_stock = (COALESCE(stock,0) - OLD.quantity) > 0
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_apply_stock_adjustment
AFTER INSERT OR DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_adjustment();

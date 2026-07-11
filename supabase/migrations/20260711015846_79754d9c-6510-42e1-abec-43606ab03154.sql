
ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

CREATE OR REPLACE FUNCTION public.handle_sales_return_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE it record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'voided' AND NEW.status = 'completed' THEN
      NEW.voided_at := NULL;
      NEW.voided_by := NULL;
      NEW.void_reason := NULL;
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
      IF NEW.voided_at IS NULL THEN NEW.voided_at := now(); END IF;
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
END; $function$;

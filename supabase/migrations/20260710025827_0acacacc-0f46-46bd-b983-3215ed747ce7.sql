
-- Trigger to handle status transitions between 'completed' and 'voided' on purchase_returns.
CREATE OR REPLACE FUNCTION public.handle_purchase_return_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE it record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- voided -> completed: re-apply stock decrease
    IF OLD.status = 'voided' AND NEW.status = 'completed' THEN
      FOR it IN SELECT * FROM public.purchase_return_items WHERE return_id = NEW.id LOOP
        IF it.variation_id IS NOT NULL THEN
          UPDATE public.product_variations SET stock = COALESCE(stock,0) - it.quantity::int WHERE id = it.variation_id;
        ELSE
          UPDATE public.products
            SET stock = COALESCE(stock,0) - it.quantity::int,
                in_stock = (COALESCE(stock,0) - it.quantity::int) > 0
            WHERE id = it.product_id;
        END IF;
      END LOOP;
    -- completed -> voided: restore stock
    ELSIF OLD.status = 'completed' AND NEW.status = 'voided' THEN
      FOR it IN SELECT * FROM public.purchase_return_items WHERE return_id = NEW.id LOOP
        IF it.variation_id IS NOT NULL THEN
          UPDATE public.product_variations SET stock = COALESCE(stock,0) + it.quantity::int WHERE id = it.variation_id;
        ELSE
          UPDATE public.products
            SET stock = COALESCE(stock,0) + it.quantity::int,
                in_stock = true
            WHERE id = it.product_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_purchase_return_status_change ON public.purchase_returns;
CREATE TRIGGER trg_purchase_return_status_change
AFTER UPDATE OF status ON public.purchase_returns
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_return_status_change();

-- Skip the item-insert stock trigger when parent return is already voided
CREATE OR REPLACE FUNCTION public.apply_purchase_return_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO parent_status FROM public.purchase_returns WHERE id = NEW.return_id;
    IF parent_status = 'voided' THEN RETURN NEW; END IF;
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
    SELECT status INTO parent_status FROM public.purchase_returns WHERE id = OLD.return_id;
    -- If parent already voided, stock was already restored; skip.
    IF parent_status = 'voided' THEN RETURN OLD; END IF;
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

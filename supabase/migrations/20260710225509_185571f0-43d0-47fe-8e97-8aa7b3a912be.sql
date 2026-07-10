
-- Atomic POS sale creation: locks stock rows, validates, inserts order+items, decrements stock.
CREATE OR REPLACE FUNCTION public.pos_create_sale(
  _items jsonb,
  _discount numeric DEFAULT 0,
  _tax numeric DEFAULT 0,
  _paid numeric DEFAULT 0,
  _payment_method text DEFAULT 'cash',
  _customer text DEFAULT NULL
)
RETURNS TABLE(id uuid, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _total numeric := 0;
  _note text;
  it jsonb;
  cur_stock int;
  qty int;
  pid uuid;
  vid uuid;
  iname text;
  iprice numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT private.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  -- Lock rows in a deterministic order to avoid deadlocks
  FOR it IN SELECT * FROM jsonb_array_elements(_items) ORDER BY value->>'product_id', COALESCE(value->>'variation_id','') LOOP
    pid := (it->>'product_id')::uuid;
    vid := NULLIF(it->>'variation_id','')::uuid;
    qty := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    iprice := COALESCE((it->>'price')::numeric, 0);
    iname := COALESCE(it->>'name','');
    _subtotal := _subtotal + iprice * qty;

    IF vid IS NOT NULL THEN
      SELECT stock INTO cur_stock FROM public.product_variations WHERE id = vid FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Variation not found: %', iname; END IF;
      IF cur_stock < qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', iname, cur_stock; END IF;
    ELSE
      SELECT stock INTO cur_stock FROM public.products WHERE id = pid FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Product not found: %', iname; END IF;
      IF cur_stock < qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', iname, cur_stock; END IF;
    END IF;
  END LOOP;

  _total := GREATEST(0, _subtotal - COALESCE(_discount,0) + COALESCE(_tax,0));
  _note := jsonb_build_object(
    'pos', true,
    'subtotal', _subtotal,
    'discount', COALESCE(_discount,0),
    'tax', COALESCE(_tax,0),
    'paid', COALESCE(_paid,0),
    'payment_method', COALESCE(_payment_method,'cash'),
    'customer', _customer
  )::text;

  INSERT INTO public.orders (user_id, status, total, note)
    VALUES (_uid, 'delivered', _total, _note)
    RETURNING orders.id INTO _order_id;

  -- Insert order items and decrement stock
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (it->>'product_id')::uuid;
    vid := NULLIF(it->>'variation_id','')::uuid;
    qty := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    iprice := COALESCE((it->>'price')::numeric, 0);
    iname := COALESCE(it->>'name','');

    INSERT INTO public.order_items (order_id, product_id, name, price, qty, img)
      VALUES (_order_id, pid, iname, iprice, qty, NULLIF(it->>'img',''));

    IF vid IS NOT NULL THEN
      UPDATE public.product_variations SET stock = stock - qty WHERE id = vid;
    ELSE
      UPDATE public.products SET stock = COALESCE(stock,0) - qty, in_stock = (COALESCE(stock,0) - qty) > 0 WHERE id = pid;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _order_id, _total;
END; $$;

REVOKE ALL ON FUNCTION public.pos_create_sale(jsonb, numeric, numeric, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_create_sale(jsonb, numeric, numeric, numeric, text, text) TO authenticated;

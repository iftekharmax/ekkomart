
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.pos_create_sale(_items jsonb, _discount numeric DEFAULT 0, _tax numeric DEFAULT 0, _paid numeric DEFAULT 0, _payment_method text DEFAULT 'cash'::text, _customer text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, total numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _total numeric := 0;
  _note text;
  it jsonb;
  req record;
  cur_stock int;
  qty int;
  pid uuid;
  vid uuid;
  iname text;
  parent_name text;
  variation_name text;
  line_name text;
  iprice numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT private.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := NULLIF(it->>'product_id','')::uuid;
    qty := COALESCE((it->>'qty')::int, 0);
    iprice := COALESCE((it->>'price')::numeric, 0);
    iname := COALESCE(NULLIF(it->>'name',''), 'Item');
    parent_name := NULLIF(it->>'parent_name','');
    variation_name := NULLIF(it->>'variation_name','');
    line_name := COALESCE(NULLIF(concat_ws(' - ', parent_name, variation_name), ''), iname);

    IF pid IS NULL THEN RAISE EXCEPTION 'Invalid product for %', line_name; END IF;
    IF qty < 1 THEN RAISE EXCEPTION 'Invalid quantity for %', line_name; END IF;
    IF iprice < 0 THEN RAISE EXCEPTION 'Invalid price for %', line_name; END IF;
    _subtotal := _subtotal + iprice * qty;
  END LOOP;

  FOR req IN
    SELECT
      CASE WHEN NULLIF(value->>'variation_id','') IS NOT NULL THEN 'variation' ELSE 'product' END AS kind,
      COALESCE(NULLIF(value->>'variation_id','')::uuid, NULLIF(value->>'product_id','')::uuid) AS stock_id,
      SUM((value->>'qty')::int)::int AS requested_qty,
      MIN(COALESCE(NULLIF(concat_ws(' - ', NULLIF(value->>'parent_name',''), NULLIF(value->>'variation_name','')), ''), NULLIF(value->>'name',''), 'Item')) AS item_name
    FROM jsonb_array_elements(_items)
    GROUP BY kind, stock_id
    ORDER BY kind, stock_id
  LOOP
    IF req.kind = 'variation' THEN
      SELECT public.product_variations.stock INTO cur_stock FROM public.product_variations WHERE public.product_variations.id = req.stock_id FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Variation not found: %', req.item_name; END IF;
      IF cur_stock < req.requested_qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', req.item_name, cur_stock; END IF;
    ELSE
      SELECT public.products.stock INTO cur_stock FROM public.products WHERE public.products.id = req.stock_id FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Product not found: %', req.item_name; END IF;
      IF cur_stock < req.requested_qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', req.item_name, cur_stock; END IF;
    END IF;
  END LOOP;

  _total := GREATEST(0, _subtotal - COALESCE(_discount,0) + COALESCE(_tax,0));
  _note := jsonb_build_object('pos', true, 'subtotal', _subtotal, 'discount', COALESCE(_discount,0), 'tax', COALESCE(_tax,0), 'paid', COALESCE(_paid,0), 'payment_method', COALESCE(_payment_method,'cash'), 'customer', _customer)::text;

  INSERT INTO public.orders (user_id, status, total, note) VALUES (_uid, 'delivered', _total, _note) RETURNING public.orders.id INTO _order_id;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (it->>'product_id')::uuid;
    vid := NULLIF(it->>'variation_id','')::uuid;
    qty := (it->>'qty')::int;
    iprice := COALESCE((it->>'price')::numeric, 0);
    iname := COALESCE(NULLIF(it->>'name',''), 'Item');
    parent_name := NULLIF(it->>'parent_name','');
    variation_name := NULLIF(it->>'variation_name','');
    line_name := COALESCE(NULLIF(concat_ws(' - ', parent_name, variation_name), ''), iname);

    INSERT INTO public.order_items (order_id, product_id, variation_id, name, price, qty, img)
      VALUES (_order_id, pid, vid, line_name, iprice, qty, NULLIF(it->>'img',''));

    IF vid IS NOT NULL THEN
      UPDATE public.product_variations SET stock = public.product_variations.stock - qty WHERE public.product_variations.id = vid;
    ELSE
      UPDATE public.products SET stock = COALESCE(public.products.stock,0) - qty, in_stock = (COALESCE(public.products.stock,0) - qty) > 0 WHERE public.products.id = pid;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _order_id, _total;
END;
$function$;

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

  CREATE TEMP TABLE IF NOT EXISTS pos_stock_requests (
    kind text NOT NULL,
    stock_id uuid NOT NULL,
    qty int NOT NULL,
    item_name text NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pos_stock_requests;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := NULLIF(it->>'product_id','')::uuid;
    vid := NULLIF(it->>'variation_id','')::uuid;
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
    INSERT INTO pos_stock_requests(kind, stock_id, qty, item_name)
      VALUES (CASE WHEN vid IS NOT NULL THEN 'variation' ELSE 'product' END, COALESCE(vid, pid), qty, line_name);
  END LOOP;

  FOR req IN
    SELECT kind, stock_id, SUM(qty)::int AS requested_qty, MIN(item_name) AS item_name
    FROM pos_stock_requests
    GROUP BY kind, stock_id
    ORDER BY kind, stock_id
  LOOP
    IF req.kind = 'variation' THEN
      SELECT stock INTO cur_stock FROM public.product_variations WHERE id = req.stock_id FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Variation not found: %', req.item_name; END IF;
      IF cur_stock < req.requested_qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', req.item_name, cur_stock; END IF;
    ELSE
      SELECT stock INTO cur_stock FROM public.products WHERE id = req.stock_id FOR UPDATE;
      IF cur_stock IS NULL THEN RAISE EXCEPTION 'Product not found: %', req.item_name; END IF;
      IF cur_stock < req.requested_qty THEN RAISE EXCEPTION 'Insufficient stock for %: only % available', req.item_name, cur_stock; END IF;
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

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (it->>'product_id')::uuid;
    vid := NULLIF(it->>'variation_id','')::uuid;
    qty := (it->>'qty')::int;
    iprice := COALESCE((it->>'price')::numeric, 0);
    iname := COALESCE(NULLIF(it->>'name',''), 'Item');
    parent_name := NULLIF(it->>'parent_name','');
    variation_name := NULLIF(it->>'variation_name','');
    line_name := COALESCE(NULLIF(concat_ws(' - ', parent_name, variation_name), ''), iname);

    INSERT INTO public.order_items (order_id, product_id, name, price, qty, img)
      VALUES (_order_id, pid, line_name, iprice, qty, NULLIF(it->>'img',''));

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
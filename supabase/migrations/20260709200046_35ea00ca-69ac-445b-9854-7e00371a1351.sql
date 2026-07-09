
DROP POLICY IF EXISTS "Suppliers readable by all" ON public.suppliers;
CREATE POLICY "Admins read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Products are public" ON public.products;
CREATE POLICY "Admins read products" ON public.products FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Variations readable by all" ON public.product_variations;
CREATE POLICY "Admins read variations" ON public.product_variations FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.suppliers FROM anon;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_variations FROM anon;

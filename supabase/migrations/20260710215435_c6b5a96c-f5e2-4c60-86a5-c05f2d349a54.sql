
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete order items" ON public.order_items FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
